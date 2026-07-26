import { eq, sql } from 'drizzle-orm';
import { db } from '@/server/db/client';
import { type AnchorEndpoint, anchorEndpoints } from '@/server/db/schema/anchorEndpoints';
import { AppError } from '@/server/lib/http';
import { fetchStellarToml, type StellarToml } from '@/server/lib/stellarToml';

/**
 * Anchor registry + cache. Looks up a Stellar anchor by domain, fetches
 * its stellar.toml (1h in-process cache + 1h DB cache), and exposes the
 * endpoint URLs the hub needs to talk SEP-24/SEP-38.
 */

const DEFAULT_TTL_SECONDS = 3600;

function extractEndpoints(toml: StellarToml, domain: string) {
  return {
    transferServerSep24: toml.TRANSFER_SERVER_SEP0024 ?? toml.TRANSFER_SERVER ?? null,
    quoteServerSep38: toml.ANCHOR_QUOTE_SERVER ?? null,
    webAuthEndpoint: toml.WEB_AUTH_ENDPOINT ?? null,
    signingKey: toml.SIGNING_KEY ?? null,
    networkPassphrase: toml.NETWORK_PASSPHRASE ?? null,
    supportedAssets: toml.CURRENCIES ?? null,
    fetchedAt: new Date(),
    ttlSeconds: DEFAULT_TTL_SECONDS.toString(),
  };
}

export const anchorService = {
  /**
   * Returns the cached `anchor_endpoints` row for a domain, refreshing it
   * from the live `stellar.toml` if the cache is stale.
   */
  async getOrFetch(domain: string): Promise<AnchorEndpoint> {
    const [existing] = await db
      .select()
      .from(anchorEndpoints)
      .where(eq(anchorEndpoints.domain, domain))
      .limit(1);
    if (existing) {
      const ageSec = (Date.now() - existing.fetchedAt.getTime()) / 1000;
      if (ageSec < Number(existing.ttlSeconds)) {
        return existing;
      }
    }
    const toml = await fetchStellarToml(domain);
    const extracted = extractEndpoints(toml, domain);
    if (existing) {
      const [row] = await db
        .update(anchorEndpoints)
        .set(extracted)
        .where(eq(anchorEndpoints.domain, domain))
        .returning();
      return row;
    }
    const [row] = await db
      .insert(anchorEndpoints)
      .values({ domain, ...extracted })
      .returning();
    return row;
  },

  async listKnown(): Promise<AnchorEndpoint[]> {
    return db.select().from(anchorEndpoints).orderBy(sql`${anchorEndpoints.domain} asc`);
  },

  async get(domain: string): Promise<AnchorEndpoint> {
    const [row] = await db
      .select()
      .from(anchorEndpoints)
      .where(eq(anchorEndpoints.domain, domain))
      .limit(1);
    if (!row) throw new AppError('NOT_FOUND', 'Anchor not found', 404);
    return row;
  },

  /**
   * Returns the SEP-24 / SEP-38 endpoint URLs for a domain, or throws
   * `AppError('NOT_FOUND', ...)` if the anchor is missing the required
   * service declaration in its stellar.toml.
   */
  async resolveEndpoints(
    domain: string,
  ): Promise<{ sep24: string; sep38: string; webAuth: string | null; signingKey: string | null }> {
    if (domain === 'mock') {
      const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/$/, '');
      return {
        sep24: `${appUrl}/api/mock-anchor/sep24`,
        sep38: `${appUrl}/api/mock-anchor/sep38`,
        webAuth: null,
        signingKey: null,
      };
    }
    const row = await this.getOrFetch(domain);
    if (!row.transferServerSep24) {
      throw new AppError('INTERNAL', `Anchor ${domain} has no TRANSFER_SERVER_SEP0024`, 502);
    }
    if (!row.quoteServerSep38) {
      throw new AppError('INTERNAL', `Anchor ${domain} has no ANCHOR_QUOTE_SERVER`, 502);
    }
    return {
      sep24: row.transferServerSep24,
      sep38: row.quoteServerSep38,
      webAuth: row.webAuthEndpoint,
      signingKey: row.signingKey,
    };
  },
};
