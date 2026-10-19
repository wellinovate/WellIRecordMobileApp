// Live WelliRecord assistant. The app sends the conversation; this calls Claude with the WelliRecord
// knowledge base and streams the answer back. It sends no account data or records to the model.
import express, { Request, RequestHandler, Response } from 'express';
import { ASSISTANT_SYSTEM_PROMPT } from './data/assistantKnowledge';

export const MAX_TURNS = 20;
export const MAX_CHARS = 2000;

export type ChatTurn = { role: 'user' | 'assistant'; content: string };

// Keeps the last turns, trims long ones, drops empties, and makes sure the list starts and ends with the user.
export function cleanTurns(input: unknown): ChatTurn[] | null {
  if (!Array.isArray(input)) return null;
  let turns: ChatTurn[] = [];
  for (const t of input) {
    const role = t?.role === 'assistant' ? 'assistant' : t?.role === 'user' ? 'user' : null;
    const content = String(t?.content ?? '').trim().slice(0, MAX_CHARS);
    if (!role || !content) continue;
    const last = turns[turns.length - 1];
    if (last && last.role === role) last.content = `${last.content}\n${content}`.slice(0, MAX_CHARS);
    else turns.push({ role, content });
  }
  turns = turns.slice(-MAX_TURNS);
  while (turns.length && turns[0].role !== 'user') turns.shift();
  if (!turns.length || turns[turns.length - 1].role !== 'user') return null;
  return turns;
}

// Words that suggest an emergency or self-harm. The app shows a fixed notice at once, before the model answers.
const EMERGENCY = [
  /\b(can'?t|cannot|struggling to|difficulty|trouble)\s+breath/i,
  /\bnot breathing\b/i,
  /\bchest (pain|tight)/i,
  /\b(heavy|severe|won'?t stop|uncontrolled)\s+bleeding\b/i,
  /\bbleeding (a lot|heavily|badly)\b/i,
  /\b(seizure|convulsion|fitting)\b/i,
  /\bstroke\b/i,
  /\bunconscious|passed out|collapsed|not waking|won'?t wake\b/i,
  /\boverdose|poison(ed|ing)?\b/i,
  /\bsuicid|kill myself|end my life|want to die|take my own life\b/i,
];
export const EMERGENCY_NOTICE =
  'If this is an emergency, call 112 now or go to the nearest hospital, and ask someone near you to help. Do not wait for a reply here.';
export const isEmergency = (text: string) => EMERGENCY.some((r) => r.test(text));

// Reads server-sent events from the model and returns the text pieces and what is left unread.
export function parseSse(buffer: string): { deltas: string[]; rest: string; done: boolean; error?: string } {
  const deltas: string[] = [];
  let done = false;
  let error: string | undefined;
  const events = buffer.split('\n\n');
  const rest = events.pop() ?? '';
  for (const ev of events) {
    const line = ev.split('\n').find((l) => l.startsWith('data:'));
    if (!line) continue;
    try {
      const j = JSON.parse(line.slice(5).trim());
      if (j.type === 'content_block_delta' && j.delta?.type === 'text_delta' && j.delta.text) deltas.push(j.delta.text);
      else if (j.type === 'message_stop') done = true;
      else if (j.type === 'error') error = String(j.error?.message || 'error');
    } catch { /* ignore a malformed event */ }
  }
  return { deltas, rest, done, error };
}

export type ModelCall = (turns: ChatTurn[], signal: AbortSignal) => Promise<Response | { ok: boolean; status: number; body: any; json: () => Promise<any> }>;

export const anthropicCall = (apiKey: string, model: string): ModelCall => (turns, signal) =>
  fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model, max_tokens: 700, stream: true, system: ASSISTANT_SYSTEM_PROMPT, messages: turns }),
  });

export interface AssistantDeps {
  getAuthUserId: (req: Request) => string | null;
  limiter: RequestHandler;
  call: ModelCall | null; // null when no API key is set
}

export function createAssistantRouter(deps: AssistantDeps) {
  const router = express.Router();

  router.get('/assistant/status', (_req, res) => res.json({ success: true, live: Boolean(deps.call) }));

  // Body: { messages: [{ role, content }] }. Answer: server-sent events { notice? } { delta } then { done: true }.
  router.post('/assistant/message', deps.limiter, async (req: Request, res: Response) => {
    if (!deps.getAuthUserId(req)) return res.status(401).json({ success: false, message: 'Sign in to use the Assistant.' });
    const turns = cleanTurns(req.body?.messages);
    if (!turns) return res.status(400).json({ success: false, message: 'Type a question first.' });
    if (!deps.call) {
      return res.status(503).json({ success: false, code: 'not_configured', message: 'The live Assistant is not switched on yet.' });
    }

    const ctrl = new AbortController();
    res.on('close', () => ctrl.abort());
    const timer = setTimeout(() => ctrl.abort(), 45_000);
    try {
      const upstream: any = await deps.call(turns, ctrl.signal);
      if (!upstream.ok) {
        console.error('[assistant] model returned', upstream.status);
        return res.status(502).json({ success: false, message: 'The Assistant is busy. Try again in a moment.' });
      }
      res.status(200);
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders?.();
      const send = (o: object) => res.write(`data: ${JSON.stringify(o)}\n\n`);
      if (isEmergency(turns[turns.length - 1].content)) send({ notice: EMERGENCY_NOTICE });

      const reader = upstream.body.getReader ? upstream.body.getReader() : null;
      const decoder = new TextDecoder();
      let buf = '';
      let sent = 0;
      const feed = (chunk: string) => {
        buf += chunk;
        const p = parseSse(buf);
        buf = p.rest;
        for (const d of p.deltas) { send({ delta: d }); sent += d.length; }
        return p;
      };
      if (reader) {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          const p = feed(decoder.decode(value, { stream: true }));
          if (p.error) { send({ error: 'The Assistant stopped early. Try again.' }); break; }
        }
      } else {
        for await (const value of upstream.body) feed(decoder.decode(value, { stream: true }));
      }
      feed('\n\n');
      if (!sent) send({ error: 'The Assistant did not answer. Try again.' });
      send({ done: true });
      res.end();
    } catch (err: any) {
      if (err?.name !== 'AbortError') console.error('[assistant] failed:', err?.message || err);
      if (!res.headersSent) return res.status(502).json({ success: false, message: 'The Assistant is busy. Try again in a moment.' });
      try { res.write(`data: ${JSON.stringify({ error: 'The connection dropped. Try again.' })}\n\n`); res.end(); } catch { /* closed */ }
    } finally {
      clearTimeout(timer);
    }
  });

  return router;
}
