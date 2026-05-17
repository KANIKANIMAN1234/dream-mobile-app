import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { DashboardResponse } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { lineUserId?: string };
    const lineUserId = body.lineUserId?.trim();
    if (!lineUserId) {
      return NextResponse.json<DashboardResponse>(
        { ok: false, message: "lineUserId が必要です。" },
        { status: 400 },
      );
    }

    const { data: customer, error: customerError } = await supabaseAdmin
      .from("m_customers")
      .select("id,tenant_id")
      .eq("line_user_id", lineUserId)
      .single();

    if (customerError) {
      return NextResponse.json<DashboardResponse>(
        { ok: false, message: customerError.message },
        { status: 500 },
      );
    }

    const customerId = customer.id;
    const tenantId = customer.tenant_id;

    const [ordersRes, deliveriesRes] = await Promise.all([
      supabaseAdmin
        .from("t_invoices")
        .select("invoice_date,total_amount,status")
        .eq("tenant_id", tenantId)
        .eq("customer_id", customerId)
        .order("invoice_date", { ascending: false })
        .limit(6),
      supabaseAdmin
        .from("t_deliveries")
        .select("delivery_date,status")
        .eq("tenant_id", tenantId)
        .eq("customer_id", customerId)
        .order("delivery_date", { ascending: true })
        .limit(6),
    ]);

    if (ordersRes.error) {
      return NextResponse.json<DashboardResponse>(
        { ok: false, message: ordersRes.error.message },
        { status: 500 },
      );
    }
    if (deliveriesRes.error) {
      return NextResponse.json<DashboardResponse>(
        { ok: false, message: deliveriesRes.error.message },
        { status: 500 },
      );
    }

    const orders =
      ordersRes.data?.map((row) => ({
        month: String(row.invoice_date).slice(0, 7),
        total_amount: Number(row.total_amount ?? 0),
        status: String(row.status ?? ""),
      })) ?? [];

    const deliveries =
      deliveriesRes.data?.map((row) => ({
        delivery_date: String(row.delivery_date),
        status: String(row.status ?? ""),
      })) ?? [];

    const notices = [
      {
        title: "来週の配達予定",
        body: "毎週金曜17:00に配達予定をお知らせします。",
        created_at: new Date().toISOString(),
      },
    ];

    return NextResponse.json<DashboardResponse>({
      ok: true,
      orders,
      deliveries,
      notices,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "不明なエラー";
    return NextResponse.json<DashboardResponse>({ ok: false, message }, { status: 500 });
  }
}
