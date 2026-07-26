import { createInvoice, listInvoices } from '@/server/controller/invoice.controller';
import { withIdempotency } from '@/server/lib/idempotency';
import { compose } from '@/server/middleware/compose';
import { withAuth } from '@/server/middleware/withAuth';
import { withError } from '@/server/middleware/withError';
import { withRateLimit } from '@/server/middleware/withRateLimit';

export const GET = compose(withError, withAuth, withRateLimit)(listInvoices);
export const POST = compose(withError, withAuth, withRateLimit, withIdempotency())(createInvoice);
