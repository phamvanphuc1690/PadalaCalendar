import { deleteWallet, getWallet, updateWallet } from '@/server/controller/wallet.controller';
import { compose } from '@/server/middleware/compose';
import { withAuth } from '@/server/middleware/withAuth';
import { withError } from '@/server/middleware/withError';

export const GET = compose(withError, withAuth)(getWallet);
export const PATCH = compose(withError, withAuth)(updateWallet);
export const DELETE = compose(withError, withAuth)(deleteWallet);
