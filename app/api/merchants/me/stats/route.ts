import { getMerchantStats } from '@/server/controller/stats.controller';
import { compose } from '@/server/middleware/compose';
import { withAuth } from '@/server/middleware/withAuth';
import { withError } from '@/server/middleware/withError';
import { withRateLimit } from '@/server/middleware/withRateLimit';

export const GET = compose(withError, withAuth, withRateLimit)(getMerchantStats);
