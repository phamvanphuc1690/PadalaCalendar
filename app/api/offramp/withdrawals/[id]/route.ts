import { getWithdrawal, submitSignedWithdrawal } from '@/server/controller/offramp.controller';
import { compose } from '@/server/middleware/compose';
import { withAuth } from '@/server/middleware/withAuth';
import { withError } from '@/server/middleware/withError';
import { withRateLimit } from '@/server/middleware/withRateLimit';

export const GET = compose(withError, withAuth, withRateLimit)(getWithdrawal);
export const POST = compose(withError, withAuth, withRateLimit)(submitSignedWithdrawal);
