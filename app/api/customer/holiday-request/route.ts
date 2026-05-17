import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      lineUserId?: string;
      requestType?: "single" | "range";
      date?: string;
      startDate?: string;
      endDate?: string;
      reason?: string;
    };

    const lineUserId = body.lineUserId?.trim();
    if (!lineUserId) {
      return NextResponse.json({ ok: false, message: "lineUserId が必要です。" }, { status: 400 });
    }

    const { data: customer, error: customerError } = await supabaseAdmin
      .from("m_customers")
      .select("id,tenant_id")
      .eq("line_user_id", lineUserId)
      .single();

    if (customerError) {
      return NextResponse.json({ ok: false, message: customerError.message }, { status: 500 });
    }

    await supabaseAdmin.from("t_line_link_events").insert({
      tenant_id: customer.tenant_id,
      target_type: "customer",
      target_id: customer.id,
      line_user_id: lineUserId,
      event_type: "link",
      payload: {
        kind: "holiday_request",
        requestType: body.requestType,
        date: body.date,
        startDate: body.startDate,
        endDate: body.endDate,
        reason: body.reason ?? null,
      },
      occurred_at: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "不明なエラー";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
