import { createWallet, listWallets } from '@/server/controller/wallet.controller';
import { compose } from '@/server/middleware/compose';
import { withAuth } from '@/server/middleware/withAuth';
import { withError } from '@/server/middleware/withError';

export const GET = compose(withError, withAuth)(listWallets);
export const POST = compose(withError, withAuth)(createWallet);
