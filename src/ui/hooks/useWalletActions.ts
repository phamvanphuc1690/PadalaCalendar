'use client';

import { useCallback, useState } from 'react';
import { apiGet, apiPost } from '@/ui/lib/api';

export type SendBuildRequest = {
  destination: string;
  amount: string;
  memo?: { type: 'text' | 'id' | 'hash'; value: string };
  timeoutSec?: number;
};

export type SendBuildResponse = {
  xdr: string;
  sourceAccount: string;
  destinationAccount: string;
  memo: string | null;
  amount: string;
  asset: { code: string; issuer: string | null };
  expiresAt: string;
};

export type SendSubmitResponse = { txHash: string; ledger: number };

async function callWithIdempotency<T>(
  url: string,
  body: unknown,
  idempotencyKey: string,
): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify(body),
    credentials: 'include',
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error?.message ?? 'Request failed');
  return json.data as T;
}

export function useSendBuild() {
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const build = useCallback(async (input: SendBuildRequest, idempotencyKey: string) => {
    setBuilding(true);
    setError(null);
    try {
      return await callWithIdempotency<SendBuildResponse>(
        '/api/wallet/send/build',
        input,
        idempotencyKey,
      );
    } catch (err) {
      setError((err as Error).message);
      throw err;
    } finally {
      setBuilding(false);
    }
  }, []);

  return { build, building, error };
}

export function useSendSubmit() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(async (signedXdr: string, idempotencyKey: string) => {
    setSubmitting(true);
    setError(null);
    try {
      return await callWithIdempotency<SendSubmitResponse>(
        '/api/wallet/send/submit',
        { signedXdr },
        idempotencyKey,
      );
    } catch (err) {
      setError((err as Error).message);
      throw err;
    } finally {
      setSubmitting(false);
    }
  }, []);

  return { submit, submitting, error };
}

export type ReceiveRequest = {
  amount: string;
  memo?: string;
  origin?: string;
  msg?: string;
};

export type ReceiveResponse = {
  uri: string;
  qrPayload: string;
  destination: string;
  amount: string;
  asset: { code: string; issuer: string | null };
  memo: string | null;
};

export function useReceiveRequest() {
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const request = useCallback(async (input: ReceiveRequest) => {
    setRequesting(true);
    setError(null);
    try {
      return await apiPost<ReceiveResponse>('/api/wallet/receive/request', input);
    } catch (err) {
      setError((err as Error).message);
      throw err;
    } finally {
      setRequesting(false);
    }
  }, []);

  return { request, requesting, error };
}

export type ConvertQuoteRequest = {
  destinationAssetCode: string;
  destinationAssetIssuer?: string;
  amount: string;
  slippageBps?: number;
};

export type SwapQuote = {
  path: Array<{ asset_code?: string; asset_issuer?: string }>;
  sourceAmount: string;
  destinationAmount: string;
  suggestedMinDestination: string;
  destinationAsset: unknown;
};

export type ConvertQuote = SwapQuote & {
  sourceAsset: { code: string; issuer: string | null };
  slippageBps: number;
};

export function useConvertQuote() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const get = useCallback(async (input: ConvertQuoteRequest) => {
    setLoading(true);
    setError(null);
    try {
      return await apiGet<ConvertQuote>('/api/wallet/convert/quote', {
        destinationAssetCode: input.destinationAssetCode,
        destinationAssetIssuer: input.destinationAssetIssuer,
        amount: input.amount,
        slippageBps: input.slippageBps ?? 50,
      });
    } catch (err) {
      setError((err as Error).message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { get, loading, error };
}

export function useConvertBuild() {
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const build = useCallback(async (quote: ConvertQuote, idempotencyKey: string) => {
    setBuilding(true);
    setError(null);
    try {
      return await callWithIdempotency<{ xdr: string; expiresAt: string }>(
        '/api/wallet/convert/build',
        { quote },
        idempotencyKey,
      );
    } catch (err) {
      setError((err as Error).message);
      throw err;
    } finally {
      setBuilding(false);
    }
  }, []);

  return { build, building, error };
}

export function useConvertSubmit() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(async (signedXdr: string, idempotencyKey: string) => {
    setSubmitting(true);
    setError(null);
    try {
      return await callWithIdempotency<SendSubmitResponse>(
        '/api/wallet/convert/submit',
        { signedXdr },
        idempotencyKey,
      );
    } catch (err) {
      setError((err as Error).message);
      throw err;
    } finally {
      setSubmitting(false);
    }
  }, []);

  return { submit, submitting, error };
}
