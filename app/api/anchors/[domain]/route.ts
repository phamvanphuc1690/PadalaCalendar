import { getAnchorInfo } from '@/server/controller/anchor.controller';
import { compose } from '@/server/middleware/compose';
import { withError } from '@/server/middleware/withError';
import { withRateLimit } from '@/server/middleware/withRateLimit';

export const GET = compose(withError, withRateLimit)(getAnchorInfo);
