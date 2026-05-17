import { POST as canonicalPOST } from "@/app/api/line/webhook/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return canonicalPOST(req);
}
