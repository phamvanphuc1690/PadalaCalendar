import { fail, fromError, ok } from '@/server/lib/http';
import { markScheduleSent } from '@/server/service/remittance.service';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await req.json();
    if (!body.txHash) return fail('INVALID_INPUT', 'txHash is required');
    const data = await markScheduleSent(id, body.txHash);
    return ok(data);
  } catch (err) {
    return fromError(err);
  }
}
