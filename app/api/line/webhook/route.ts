import crypto from "crypto";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LineWebhookEvent = {
  type: string;
  webhookEventId?: string;
  timestamp?: number;
  source?: {
    userId?: string;
    type?: string;
  };
};

function verifySignature(rawBody: string, signature: string, secret: string) {
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("base64");
  return expected === signature;
}

async function handleWebhook(req: Request) {
  const channelSecret = process.env.LINE_CHANNEL_SECRET;
  if (!channelSecret) {
    return NextResponse.json({ ok: false, message: "LINE_CHANNEL_SECRET が未設定です。" }, { status: 500 });
  }

  const signature = req.headers.get("x-line-signature");
  if (!signature) {
    return NextResponse.json({ ok: false, message: "x-line-signature がありません。" }, { status: 400 });
  }

  const rawBody = await req.text();
  if (!verifySignature(rawBody, signature, channelSecret)) {
    return NextResponse.json({ ok: false, message: "署名検証に失敗しました。" }, { status: 401 });
  }

  const body = JSON.parse(rawBody) as { events?: LineWebhookEvent[] };
  const events = body.events ?? [];

  for (const event of events) {
    const lineUserId = event.source?.userId;
    if (!lineUserId) continue;

    let normalizedType: "link" | "unlink" | "relink" | "error";
    if (event.type === "follow") normalizedType = "link";
    else if (event.type === "unfollow") normalizedType = "unlink";
    else if (event.type === "postback") normalizedType = "relink";
    else normalizedType = "error";

    const { data: customer } = await supabaseAdmin
      .from("m_customers")
      .select("id,tenant_id")
      .eq("line_user_id", lineUserId)
      .maybeSingle();

    if (customer) {
      await supabaseAdmin.from("t_line_link_events").insert({
        tenant_id: customer.tenant_id,
        target_type: "customer",
        target_id: customer.id,
        line_user_id: lineUserId,
        event_type: normalizedType,
        payload: {
          eventType: event.type,
          webhookEventId: event.webhookEventId ?? null,
          timestamp: event.timestamp ?? null,
        },
        occurred_at: new Date().toISOString(),
      });
      continue;
    }

    const { data: employee } = await supabaseAdmin
      .from("m_employees")
      .select("id,tenant_id")
      .eq("line_user_id", lineUserId)
      .maybeSingle();

    if (employee) {
      await supabaseAdmin.from("t_line_link_events").insert({
        tenant_id: employee.tenant_id,
        target_type: "employee",
        target_id: employee.id,
        line_user_id: lineUserId,
        event_type: normalizedType,
        payload: {
          eventType: event.type,
          webhookEventId: event.webhookEventId ?? null,
          timestamp: event.timestamp ?? null,
        },
        occurred_at: new Date().toISOString(),
      });
    }
  }

  return NextResponse.json({ ok: true });
}

export async function POST(req: Request) {
  try {
    return await handleWebhook(req);
  } catch (error) {
    const message = error instanceof Error ? error.message : "不明なエラー";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
