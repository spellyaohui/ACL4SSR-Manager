import { apiOk } from "@/lib/api";
import { currentSession } from "@/lib/auth";

export async function GET() {
  const session = await currentSession();
  return apiOk({ authenticated: Boolean(session), user: session ? { name: "admin" } : null });
}
