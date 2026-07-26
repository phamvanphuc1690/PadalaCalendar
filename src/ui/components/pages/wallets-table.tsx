'use client';

import { Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { AddressBadge } from '@/ui/components/shared/address-badge';
import { EmptyState } from '@/ui/components/shared/empty-state';
import { Button } from '@/ui/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/ui/components/ui/table';
import type { Wallet } from '@/ui/hooks/useWallets';

export function WalletsTable({
  wallets,
  onDelete,
}: {
  wallets: Wallet[];
  onDelete: (id: string) => void;
}) {
  const t = useTranslations('Wallets');
  if (wallets.length === 0) {
    return <EmptyState title={t('empty')} />;
  }
  return (
    <div className="rounded-md border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('table.headers.label')}</TableHead>
            <TableHead>{t('table.headers.publicKey')}</TableHead>
            <TableHead>{t('table.headers.network')}</TableHead>
            <TableHead className="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {wallets.map((w) => (
            <TableRow key={w.id}>
              <TableCell className="font-medium">{w.label}</TableCell>
              <TableCell>
                <AddressBadge publicKey={w.publicKey} />
              </TableCell>
              <TableCell className="text-muted-foreground">{w.network}</TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onDelete(w.id)}
                  aria-label={t('table.actions.delete')}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
