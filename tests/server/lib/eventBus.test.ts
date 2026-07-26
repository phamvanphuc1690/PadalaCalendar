import { describe, expect, it, vi } from 'vitest';
import { eventBus } from '@/server/lib/eventBus';

describe('eventBus', () => {
  it('subscribes and publishes', async () => {
    const cb = vi.fn();
    const off = eventBus.subscribe('invoice.updated', cb);
    eventBus.publish('invoice.updated', {
      invoiceId: 'a',
      signedId: 'b',
      version: 1,
      status: 'paid',
      paidAt: new Date(),
      settledAt: null,
      occurredAt: new Date(),
    });
    await new Promise((r) => setTimeout(r, 10));
    expect(cb).toHaveBeenCalledTimes(1);
    off();
  });

  it('auto-unsubscribes on abort signal', async () => {
    const cb = vi.fn();
    const ac = new AbortController();
    eventBus.subscribe('invoice.updated', cb, ac.signal);
    ac.abort();
    eventBus.publish('invoice.updated', {
      invoiceId: 'a',
      signedId: 'b',
      version: 1,
      status: 'paid',
      paidAt: new Date(),
      settledAt: null,
      occurredAt: new Date(),
    });
    await new Promise((r) => setTimeout(r, 10));
    expect(cb).not.toHaveBeenCalled();
  });

  it('tracks subscriber count', () => {
    const off1 = eventBus.subscribe('invoice.updated', () => {});
    const off2 = eventBus.subscribe('invoice.updated', () => {});
    expect(eventBus.subscriberCount('invoice.updated')).toBeGreaterThanOrEqual(2);
    off1();
    off2();
  });
});
