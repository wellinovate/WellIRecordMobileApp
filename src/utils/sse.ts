// Reads the Assistant's server-sent events: lines of `data: {json}` separated by a blank line.
export type AssistantEvent = { notice?: string; delta?: string; error?: string; done?: boolean };

export function parseAssistantEvents(buffer: string): { events: AssistantEvent[]; rest: string } {
  const parts = buffer.split('\n\n');
  const rest = parts.pop() ?? '';
  const events: AssistantEvent[] = [];
  for (const part of parts) {
    const line = part.split('\n').find((l) => l.startsWith('data:'));
    if (!line) continue;
    try {
      events.push(JSON.parse(line.slice(5).trim()));
    } catch {
      // ignore a broken event
    }
  }
  return { events, rest };
}
