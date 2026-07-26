import { streamInvoiceBySignedId } from '@/server/controller/invoice.controller';
import { compose } from '@/server/middleware/compose';
import { withError } from '@/server/middleware/withError';
import { withRateLimitSse } from '@/server/middleware/withRateLimitSse';

export const GET = compose(withError, withRateLimitSse)(streamInvoiceBySignedId);
