import { created, fromError } from '@/server/lib/http';
import { generateMonthlySchedules } from '@/server/service/remittance.service';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const recipientId = (body as Record<string, unknown>).recipientId as string | undefined;
    const data = await generateMonthlySchedules(recipientId);
    return created(data);
  } catch (err) {
    return fromError(err);
  }
}
