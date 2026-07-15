import { createSseResponse } from '@/server/lib/sseStream';
import { getRecentEvents } from '@/server/service/remittance.service';

export const dynamic = 'force-dynamic';

export async function GET() {
  return createSseResponse(async (emit, signal) => {
    const events = await getRecentEvents(10);
    emit('init', { events });

    const poll = setInterval(async () => {
      if (signal.aborted) return;
      try {
        const latest = await getRecentEvents(5);
        emit('update', { events: latest });
      } catch {
        // ignore
      }
    }, 30_000);

    signal.addEventListener('abort', () => clearInterval(poll), { once: true });

    await new Promise<void>((resolve) => {
      signal.addEventListener('abort', () => resolve(), { once: true });
    });
  });
}
