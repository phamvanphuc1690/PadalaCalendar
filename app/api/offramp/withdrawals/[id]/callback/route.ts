import { anchorCallback } from '@/server/controller/offramp.controller';
import { compose } from '@/server/middleware/compose';
import { withError } from '@/server/middleware/withError';

export const POST = compose(withError)(anchorCallback);
