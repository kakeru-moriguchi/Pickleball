import { NextRequest, NextResponse } from "next/server";
import { getGuestId } from "@/lib/guest";
import { createClient } from "@/lib/supabase/server";

type MessageRow = {
  id: string;
  body: string;
  sender_role: "applicant" | "organizer";
  is_mine: boolean;
  created_at: string;
};

function participationId(value: unknown) {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value) ? value : "";
}

export async function GET(request: NextRequest) {
  const id = participationId(request.nextUrl.searchParams.get("participationId"));
  if (!id) return NextResponse.json({ error: "トークが正しくありません" }, { status: 400 });
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_participation_messages", {
    p_participation_id: id,
    p_guest_id: getGuestId(request),
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 403 });
  return NextResponse.json({
    messages: ((data ?? []) as MessageRow[]).map((row) => ({
      id: row.id,
      body: row.body,
      senderRole: row.sender_role,
      isMine: row.is_mine,
      createdAt: row.created_at,
    })),
  });
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { participationId?: unknown; body?: unknown };
  const id = participationId(body.participationId);
  const message = typeof body.body === "string" ? body.body.trim() : "";
  if (!id || !message || message.length > 1000)
    return NextResponse.json({ error: "メッセージを1000文字以内で入力してください" }, { status: 400 });
  const supabase = await createClient();
  const { error } = await supabase.rpc("send_participation_message", {
    p_participation_id: id,
    p_body: message,
    p_guest_id: getGuestId(request),
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 403 });
  return NextResponse.json({ ok: true });
}

export async function PATCH(request: NextRequest) {
  const body = (await request.json()) as { participationId?: unknown; blocked?: unknown };
  const id = participationId(body.participationId);
  if (!id || typeof body.blocked !== "boolean")
    return NextResponse.json({ error: "設定が正しくありません" }, { status: 400 });
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_participation_chat_blocked", {
    p_participation_id: id,
    p_blocked: body.blocked,
    p_guest_id: getGuestId(request),
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 403 });
  return NextResponse.json({ ok: true });
}
