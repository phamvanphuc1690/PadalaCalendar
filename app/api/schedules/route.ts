import { fromError, ok } from '@/server/lib/http';
import { getSchedules } from '@/server/service/remittance.service';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const recipientId = url.searchParams.get('recipientId') ?? undefined;
    const status = url.searchParams.get('status') ?? undefined;
    const data = await getSchedules(recipientId, status);
    return ok(data);
  } catch (err) {
    return fromError(err);
  }
}
