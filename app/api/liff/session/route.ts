import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { LiffSessionResponse } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { lineUserId?: string };
    const lineUserId = body.lineUserId?.trim();
    if (!lineUserId) {
      return NextResponse.json<LiffSessionResponse>(
        { ok: false, message: "lineUserId が必要です。" },
        { status: 400 },
      );
    }

    const { data: customer, error } = await supabaseAdmin
      .from("m_customers")
      .select("id,tenant_id,customer_code,name,phone,postal_code,address")
      .eq("line_user_id", lineUserId)
      .maybeSingle();

    if (error) {
      return NextResponse.json<LiffSessionResponse>(
        { ok: false, message: error.message },
        { status: 500 },
      );
    }

    if (!customer) {
      return NextResponse.json<LiffSessionResponse>({
        ok: true,
        linked: false,
        message: "初回連携が必要です。",
      });
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("m_customer_profiles")
      .select(
        "emergency_contact_name,emergency_contact_phone,household_size,family_composition,profile_confirmed_at",
      )
      .eq("tenant_id", customer.tenant_id)
      .eq("customer_id", customer.id)
      .maybeSingle();

    if (profileError) {
      return NextResponse.json<LiffSessionResponse>(
        { ok: false, message: profileError.message },
        { status: 500 },
      );
    }

    return NextResponse.json<LiffSessionResponse>({
      ok: true,
      linked: true,
      customer,
      profile,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "不明なエラー";
    return NextResponse.json<LiffSessionResponse>({ ok: false, message }, { status: 500 });
  }
}
