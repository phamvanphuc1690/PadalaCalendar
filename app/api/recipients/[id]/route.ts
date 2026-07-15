import { fail, fromError, ok } from '@/server/lib/http';
import { getRecipient } from '@/server/service/remittance.service';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const data = await getRecipient(id);
    if (!data) return fail('NOT_FOUND', 'Recipient not found', 404);
    return ok(data);
  } catch (err) {
    return fromError(err);
  }
}
