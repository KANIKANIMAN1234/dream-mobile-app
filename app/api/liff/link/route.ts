import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      lineUserId?: string;
      customerCode?: string;
      phone?: string;
    };

    const lineUserId = body.lineUserId?.trim();
    const customerCode = body.customerCode?.trim();
    const phone = body.phone?.trim();

    if (!lineUserId || !customerCode || !phone) {
      return NextResponse.json(
        { ok: false, message: "lineUserId, customerCode, phone は必須です。" },
        { status: 400 },
      );
    }

    const { data: customers, error } = await supabaseAdmin
      .from("m_customers")
      .select("id,tenant_id,phone")
      .eq("customer_code", customerCode)
      .eq("phone", phone)
      .limit(2);

    if (error) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
    }

    if (!customers || customers.length === 0) {
      return NextResponse.json({ ok: false, message: "顧客番号と携帯番号を確認してください。" }, { status: 404 });
    }

    if (customers.length > 1) {
      return NextResponse.json(
        { ok: false, message: "複数テナントで顧客が一致しました。管理者へ確認してください。" },
        { status: 409 },
      );
    }

    const customer = customers[0];

    const { error: updateError } = await supabaseAdmin
      .from("m_customers")
      .update({
        line_user_id: lineUserId,
        line_linked_at: new Date().toISOString(),
      })
      .eq("tenant_id", customer.tenant_id)
      .eq("id", customer.id);

    if (updateError) {
      return NextResponse.json({ ok: false, message: updateError.message }, { status: 500 });
    }

    await supabaseAdmin.from("t_line_link_events").insert({
      tenant_id: customer.tenant_id,
      target_type: "customer",
      target_id: customer.id,
      line_user_id: lineUserId,
      event_type: "link",
      payload: { customer_code: customerCode },
      occurred_at: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "不明なエラー";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
