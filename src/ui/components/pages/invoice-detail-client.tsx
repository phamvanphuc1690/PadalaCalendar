'use client';

import {
  CheckCircle2,
  ChevronDown,
  Copy,
  ExternalLink,
  Hourglass,
  Smartphone,
  Wallet,
  XCircle,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { QrImage } from '@/ui/components/shared/qr-image';
import { SectionCard } from '@/ui/components/shared/section-card';
import { SkeletonDetail } from '@/ui/components/shared/skeleton-detail';
import { StatusBadge } from '@/ui/components/shared/status-badge';
import { Button } from '@/ui/components/ui/button';
import { Card, CardContent } from '@/ui/components/ui/card';
import { useInvoiceStream } from '@/ui/hooks/useInvoiceStream';
import { useInvoice } from '@/ui/hooks/useInvoices';
import { useToast } from '@/ui/hooks/useToast';
import { explorerTxUrl } from '@/ui/lib/explorer';
import { formatAmount } from '@/ui/lib/format';
import { truncateAddress } from '@/ui/lib/utils';

const EVM_CHAINS = [
  {
    id: 'ethereum-sepolia',
    label: 'Ethereum',
    short: 'Ethereum',
    color: '#627EEA',
    available: true,
  },
  { id: 'base', label: 'Base', short: 'Base', color: '#0052FF', available: true },
  { id: 'optimism', label: 'Optimism', short: 'Optimism', color: '#FF0420', available: true },
  { id: 'arbitrum', label: 'Arbitrum', short: 'Arbitrum', color: '#12AAFF', available: true },
] as const;

type EvmChainId = (typeof EVM_CHAINS)[number]['id'];

export function InvoiceDetailClient({ id }: { id: string }) {
  const t = useTranslations('Invoices');
  const { toast } = useToast();
  const { invoice, loading, refresh } = useInvoice(id);
  const [signedId, setSignedId] = useState<string | null>(null);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [sep7Uri, setSep7Uri] = useState<string | null>(null);
  const [hubEvmAddress, setHubEvmAddress] = useState<string | null>(null);
  const [tab, setTab] = useState<'stellar' | 'evm'>('stellar');
  const [evmChain, setEvmChain] = useState<EvmChainId>('ethereum-sepolia');
  const [chainDropdownOpen, setChainDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (invoice) {
      setSignedId(invoice.signedId);
      setCheckoutUrl(`/checkout/${encodeURIComponent(invoice.signedId)}`);
      setSep7Uri(invoice.sep7Uri ?? null);
      setHubEvmAddress(invoice.hubEvmAddress ?? null);
    }
  }, [invoice]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setChainDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useInvoiceStream(signedId, (snap) => {
    if (snap.invoice.status !== invoice?.status) refresh();
  });

  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  useEffect(() => {
    // Only poll when payment is detected but not yet settled.
    // 'pending' relies on SSE + EVM watcher; no polling needed there.
    const POLL_STATUSES = new Set(['paid', 'settling']);
    if (!invoice || !POLL_STATUSES.has(invoice.status)) return;
    const timer = setInterval(() => {
      void refreshRef.current();
    }, 5000);
    return () => clearInterval(timer);
  }, [invoice?.status]);

  if (loading || !invoice) {
    return <SkeletonDetail />;
  }

  const onCopy = async () => {
    if (!checkoutUrl) return;
    const absolute = `${window.location.origin}${checkoutUrl}`;
    try {
      await navigator.clipboard.writeText(absolute);
      toast.success(t('linkCopied'));
    } catch {
      toast.error(t('copyFailed'));
    }
  };

  const status = invoice.status;
  const Icon =
    status === 'settled'
      ? CheckCircle2
      : status === 'failed' || status === 'expired'
        ? XCircle
        : Hourglass;

  const selectedChain = EVM_CHAINS.find((c) => c.id === evmChain)!;

  const tabBase =
    'flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-all duration-150';
  const tabActive = 'bg-blue-600 text-white shadow-md';
  const tabInactive = 'text-muted-foreground hover:text-foreground';

  return (
    <div className="mx-auto max-w-md space-y-4 px-4 py-12">
      <div className="text-center">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          {t('invoice', { id: invoice.id.slice(0, 6) })}
        </p>
        <h1 className="mt-1 display-thin text-3xl text-foreground">
          {formatAmount(invoice.amountMinor)} {invoice.currency}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{invoice.description ?? '—'}</p>
        <div className="mt-2 flex items-center justify-center gap-2">
          <Icon className="h-4 w-4 text-primary" />
          <StatusBadge status={status} />
        </div>
      </div>

      {(status === 'pending' || status === 'paid' || status === 'settling') && (
        <SectionCard>
          <div className="flex flex-col items-center gap-4">
            {/* ── Tab bar ── */}
            <div className="flex w-full gap-1.5 rounded-2xl bg-muted/60 p-1.5">
              {/* Stellar tab */}
              <button
                type="button"
                onClick={() => setTab('stellar')}
                className={`${tabBase} flex-1 ${tab === 'stellar' ? tabActive : tabInactive}`}
              >
                <Smartphone className="h-4 w-4" />
                Stellar
              </button>

              {/* EVM tab — only when hub address is configured */}
              {hubEvmAddress && (
                <div className="relative flex flex-1" ref={dropdownRef}>
                  <button
                    type="button"
                    onClick={() => {
                      setTab('evm');
                      setChainDropdownOpen((o) => !o);
                    }}
                    className={`${tabBase} w-full gap-1.5 pl-3 pr-2 ${tab === 'evm' ? tabActive : tabInactive}`}
                  >
                    <Wallet className="h-4 w-4 shrink-0" />
                    <span className="flex-1 text-left">
                      {tab === 'evm' ? selectedChain.short : 'EVM'}
                    </span>
                    <ChevronDown
                      className={`h-3.5 w-3.5 shrink-0 transition-transform duration-150 ${chainDropdownOpen ? 'rotate-180' : ''}`}
                    />
                  </button>

                  {/* Dropdown */}
                  {chainDropdownOpen && (
                    <div className="absolute left-0 top-[calc(100%+6px)] z-50 w-full min-w-[180px] overflow-hidden rounded-xl border border-border bg-white shadow-xl dark:bg-zinc-900">
                      {EVM_CHAINS.map((chain, i) => (
                        <button
                          key={chain.id}
                          type="button"
                          disabled={!chain.available}
                          onClick={() => {
                            if (!chain.available) return;
                            setEvmChain(chain.id);
                            setChainDropdownOpen(false);
                          }}
                          className={`flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/60 ${
                            i > 0 ? 'border-t border-border/50' : ''
                          }`}
                        >
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: chain.color }}
                          />
                          <span className="flex-1 font-medium text-foreground">{chain.label}</span>
                          {evmChain === chain.id && (
                            <span className="text-xs font-bold" style={{ color: chain.color }}>
                              ✓
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── QR content ── */}
            {tab === 'stellar' ? (
              sep7Uri ? (
                <>
                  <QrImage value={sep7Uri} size={220} />
                  <p className="text-center text-xs text-muted-foreground">
                    Scan with <strong>Lobstr</strong> or <strong>xBull</strong> on your phone
                  </p>
                </>
              ) : null
            ) : hubEvmAddress ? (
              <QrImage value={hubEvmAddress} size={220} />
            ) : null}

            {/* ── Actions ── */}
            <div className="flex w-full flex-col gap-2">
              <Button
                variant="outline"
                className="rounded-full"
                onClick={onCopy}
                data-testid="copy-link"
              >
                <Copy className="mr-2 h-4 w-4" />
                {t('copyLink')}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">{t('waiting')}</p>
          </div>
        </SectionCard>
      )}

      {(status === 'settled' || status === 'paid' || status === 'settling') && (
        <Card>
          <CardContent className="space-y-2 p-4 text-sm">
            <Row label={t('amount')}>
              {formatAmount(invoice.amountMinor)} {invoice.currency}
            </Row>
            <Row label={t('payment')}>
              <StatusBadge status="paid" />
            </Row>
            <Row label={t('settlement')}>
              <StatusBadge status={status === 'paid' ? 'pending' : status} />
            </Row>
            <Row label={t('destination')}>
              <span className="font-mono text-xs">
                {truncateAddress(invoice.destinationAddress, 8, 6)}
              </span>
            </Row>
            {invoice.settlement?.stellarTxHash ? (
              <Row label={t('stellarTx')}>
                <a
                  href={explorerTxUrl(invoice.network, invoice.settlement.stellarTxHash)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-primary-deep hover:underline"
                >
                  {truncateAddress(invoice.settlement.stellarTxHash, 4, 4)}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </Row>
            ) : null}
            {invoice.evmSourceTxHash ? (
              <Row label="Source Tx">
                <a
                  href={`https://sepolia.etherscan.io/tx/${invoice.evmSourceTxHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-primary-deep hover:underline"
                >
                  {truncateAddress(invoice.evmSourceTxHash, 4, 4)}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </Row>
            ) : null}
          </CardContent>
        </Card>
      )}

      {(status === 'failed' || status === 'expired') && (
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground">
            {status === 'expired' ? t('expiredHint') : t('failedHint')}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span>{children}</span>
    </div>
  );
}
