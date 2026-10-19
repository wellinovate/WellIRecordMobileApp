import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAssistantEvents } from '../src/utils/sse';

test('assistant events are read across split chunks', () => {
  const full = 'data: {"notice":"Call 112"}\n\ndata: {"delta":"Hel"}\n\ndata: {"delta":"lo"}\n\ndata: {"done":true}\n\n';
  const a = parseAssistantEvents(full.slice(0, 40));
  const b = parseAssistantEvents(a.rest + full.slice(40));
  const all = [...a.events, ...b.events];
  assert.equal(all[0].notice, 'Call 112');
  assert.equal(all.filter((e) => e.delta).map((e) => e.delta).join(''), 'Hello');
  assert.equal(all[all.length - 1].done, true);
  assert.deepEqual(parseAssistantEvents('data: not json\n\n').events, []);
});
