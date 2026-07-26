import { describe, expect, it } from 'vitest';
import { createSseResponse } from '@/server/lib/sseStream';

async function readAll(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return '';
  const decoder = new TextDecoder();
  let out = '';
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (value) out += decoder.decode(value, { stream: true });
  }
  return out;
}

describe('sseStream', () => {
  it('emits initial retry + connected frame, then user frames', async () => {
    const res = createSseResponse((emit) => {
      emit('hello', { name: 'world' });
    });
    expect(res.headers.get('Content-Type')).toContain('text/event-stream');
    expect(res.headers.get('Cache-Control')).toContain('no-cache');
    const body = await readAll(res);
    expect(body).toContain('retry: 5000');
    expect(body).toContain('event: hello');
    expect(body).toContain('"name":"world"');
  });

  it('closes the stream on signal abort', async () => {
    const ac = new AbortController();
    const req = new Request('http://localhost/stream', { signal: ac.signal });
    const res = createSseResponse((emit, signal) => {
      const t = setTimeout(() => emit('x', { ok: true }), 1000);
      signal.addEventListener('abort', () => clearTimeout(t));
    });
    void req;
    ac.abort();
    await expect(readAll(res)).resolves.toBeDefined();
  });
});
