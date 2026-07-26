import { submit as submitConvert } from '@/server/controller/convert.controller';
import { withIdempotency } from '@/server/lib/idempotency';
import { compose } from '@/server/middleware/compose';
import { withAuth } from '@/server/middleware/withAuth';
import { withError } from '@/server/middleware/withError';
import { withRateLimit } from '@/server/middleware/withRateLimit';

export const POST = compose(withError, withAuth, withRateLimit, withIdempotency())(submitConvert);
