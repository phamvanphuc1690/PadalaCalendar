import { stellar } from '@/server/config/stellar';

export const stellarService = {
  async accountExists(publicKey: string): Promise<boolean> {
    try {
      await stellar.server.loadAccount(publicKey);
      return true;
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 404) return false;
      throw err;
    }
  },
};
