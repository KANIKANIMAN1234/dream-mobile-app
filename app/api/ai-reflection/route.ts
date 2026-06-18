import { NextResponse } from "next/server";
import { generateReflection, type ReflectionInput } from "@/lib/aiReflection";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<ReflectionInput>;
    const title = body.title?.trim() ?? "業務振り返り";
    const meetingDate = body.meetingDate?.trim() ?? new Date().toISOString().slice(0, 10);
    const participants = body.participants?.trim() ?? "";
    const notes = body.notes?.trim() ?? "";
    const context = body.context ?? "daily";

    if (!notes) {
      return NextResponse.json({ ok: false, message: "振り返りメモを入力してください。" }, { status: 400 });
    }

    const result = generateReflection({ title, meetingDate, participants, notes, context });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "不明なエラー";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
