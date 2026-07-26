import { eq } from 'drizzle-orm';
import { db } from '@/server/db/client';
import { recipients, remittances } from '@/server/db/schema';
import { env } from '@/server/config/env';
import { fail, fromError, ok } from '@/server/lib/http';
import { buildSep7PayUri } from '@/server/lib/sep7';
import { usdcToString } from '@/server/lib/usdc';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ scheduleId: string }> },
) {
  try {
    const { scheduleId } = await params;
    const [row] = await db
      .select({ remittance: remittances, recipient: recipients })
      .from(remittances)
      .leftJoin(recipients, eq(remittances.recipientId, recipients.id))
      .where(eq(remittances.id, scheduleId));

    if (!row?.remittance) return fail('NOT_FOUND', 'Remittance not found', 404);
    if (!row.recipient) return fail('NOT_FOUND', 'Recipient not found', 404);

    const amountStr = usdcToString(BigInt(row.recipient.monthlyAmountUsdc));
    const uri = buildSep7PayUri({
      destination: row.recipient.stellarAddress,
      amount: amountStr,
      assetCode: env.USDC_ASSET_CODE,
      assetIssuer: env.USDC_ASSET_ISSUER_TESTNET,
      memo: `RC-${scheduleId}`,
      memoType: 'text',
    });

    return ok({ uri, remittance: row.remittance, recipient: row.recipient });
  } catch (err) {
    return fromError(err);
  }
}
