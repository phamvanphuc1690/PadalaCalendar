import { fromError, ok } from '@/server/lib/http';
import { getRecipients } from '@/server/service/remittance.service';

export async function GET() {
  try {
    const data = await getRecipients();
    return ok(data);
  } catch (err) {
    return fromError(err);
  }
}
