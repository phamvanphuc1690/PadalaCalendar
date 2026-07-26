import { getMerchant, updateMerchant } from '@/server/controller/merchant.controller';
import { compose } from '@/server/middleware/compose';
import { withAuth } from '@/server/middleware/withAuth';
import { withError } from '@/server/middleware/withError';
import { withRateLimit } from '@/server/middleware/withRateLimit';

export const GET = compose(withError, withAuth, withRateLimit)(getMerchant);
export const PATCH = compose(withError, withAuth, withRateLimit)(updateMerchant);
