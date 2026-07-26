import {
  createWithdrawal,
  listWithdrawals,
  startWithdrawal,
} from '@/server/controller/offramp.controller';
import { withIdempotency } from '@/server/lib/idempotency';
import { compose } from '@/server/middleware/compose';
import { withAuth } from '@/server/middleware/withAuth';
import { withError } from '@/server/middleware/withError';
import { withRateLimit } from '@/server/middleware/withRateLimit';

export const GET = compose(withError, withAuth, withRateLimit)(listWithdrawals);
export const POST = compose(
  withError,
  withAuth,
  withRateLimit,
  withIdempotency(),
)(createWithdrawal);
// Internal action: merchant calls this after the anchor returns a webapp URL
// to "start" the withdrawal flow. Mounted on the same route to keep the
// surface small.
export const PATCH = compose(withError, withAuth, withRateLimit)(startWithdrawal);
