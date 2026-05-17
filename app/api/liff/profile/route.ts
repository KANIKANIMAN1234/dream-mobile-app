import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      lineUserId?: string;
      emergency_contact_name?: string;
      emergency_contact_phone?: string;
      household_size?: number;
      family_composition?: string;
      postal_code?: string;
      address?: string;
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

    const { error: upsertError } = await supabaseAdmin.from("m_customer_profiles").upsert(
      {
        tenant_id: customer.tenant_id,
        customer_id: customer.id,
        emergency_contact_name: body.emergency_contact_name || null,
        emergency_contact_phone: body.emergency_contact_phone || null,
        household_size: body.household_size || null,
        family_composition: body.family_composition || null,
        profile_confirmed_at: new Date().toISOString(),
      },
      { onConflict: "tenant_id,customer_id" },
    );

    if (upsertError) {
      return NextResponse.json({ ok: false, message: upsertError.message }, { status: 500 });
    }

    const { error: customerUpdateError } = await supabaseAdmin
      .from("m_customers")
      .update({
        postal_code: body.postal_code?.trim() || null,
        address: body.address?.trim() || null,
      })
      .eq("tenant_id", customer.tenant_id)
      .eq("id", customer.id);

    if (customerUpdateError) {
      return NextResponse.json({ ok: false, message: customerUpdateError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "不明なエラー";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
