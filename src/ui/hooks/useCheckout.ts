'use client';

import { useCallback, useRef, useState } from 'react';
import { apiPost } from '@/ui/lib/api';

export type CustomerChallengeResponse = { challenge: string; expiresAt: string };
export type CustomerVerifyResponse = { token: string; expiresAt: string };
export type CheckoutBuildResponse = { xdr: string; expiresAt: string };
export type CheckoutSubmitResponse = { txHash: string };

export function useCheckout() {
  const [token, setToken] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ref mirror of `token` so async closures (build/submit called immediately
  // after `await verify(...)` in the same handler) always read the latest
  // value. `token` state is still updated for re-renders, but the ref bypasses
  // React's pending-update queue that hasn't been committed yet.
  const tokenRef = useRef<string | null>(null);

  const challenge = useCallback(async (publicKey: string) => {
    setBusy(true);
    setError(null);
    try {
      return await apiPost<CustomerChallengeResponse>('/api/checkout/challenge', { publicKey });
    } catch (err) {
      setError((err as Error).message);
      throw err;
    } finally {
      setBusy(false);
    }
  }, []);

  const verify = useCallback(async (publicKey: string, signedChallengeXdr: string) => {
    setBusy(true);
    setError(null);
    try {
      const data = await apiPost<CustomerVerifyResponse>('/api/checkout/verify', {
        publicKey,
        signedChallengeXdr,
      });
      setToken(data.token);
      setExpiresAt(data.expiresAt);
      tokenRef.current = data.token;
      return data;
    } catch (err) {
      setError((err as Error).message);
      throw err;
    } finally {
      setBusy(false);
    }
  }, []);

  const build = useCallback(async (signedId: string) => {
    const t = tokenRef.current;
    if (!t) throw new Error('Not authenticated as customer');
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/checkout/build', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${t}`,
        },
        body: JSON.stringify({ signedId }),
        credentials: 'include',
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error?.message ?? 'Build failed');
      return json.data as CheckoutBuildResponse;
    } catch (err) {
      setError((err as Error).message);
      throw err;
    } finally {
      setBusy(false);
    }
  }, []);

  const submit = useCallback(async (signedId: string, signedXdr: string) => {
    const t = tokenRef.current;
    if (!t) throw new Error('Not authenticated as customer');
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/checkout/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${t}`,
        },
        body: JSON.stringify({ signedId, signedXdr }),
        credentials: 'include',
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error?.message ?? 'Submit failed');
      return json.data as CheckoutSubmitResponse;
    } catch (err) {
      setError((err as Error).message);
      throw err;
    } finally {
      setBusy(false);
    }
  }, []);

  return { token, expiresAt, busy, error, challenge, verify, build, submit };
}
