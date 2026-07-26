import { submitPayment } from '@/server/controller/checkout.controller';
import { compose } from '@/server/middleware/compose';
import { withError } from '@/server/middleware/withError';
import { withCustomerAuth } from '@/server/middleware/withMerchant';
import { withRateLimit } from '@/server/middleware/withRateLimit';

export const POST = compose(withError, withCustomerAuth, withRateLimit)(submitPayment);
