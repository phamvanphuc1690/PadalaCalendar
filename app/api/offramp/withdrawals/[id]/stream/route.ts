import { streamWithdrawal } from '@/server/controller/offramp.controller';
import { compose } from '@/server/middleware/compose';
import { withAuth } from '@/server/middleware/withAuth';
import { withError } from '@/server/middleware/withError';
import { withRateLimitSse } from '@/server/middleware/withRateLimitSse';

export const GET = compose(withError, withAuth, withRateLimitSse)(streamWithdrawal);
