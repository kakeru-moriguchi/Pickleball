import { NextRequest, NextResponse } from "next/server";
import { getGuestId } from "@/lib/guest";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { messageId?: unknown; reason?: unknown; details?: unknown };
  const messageId = typeof body.messageId === "string" ? body.messageId : "";
  const reason = typeof body.reason === "string" ? body.reason : "";
  const details = typeof body.details === "string" ? body.details.trim() : "";
  if (!messageId || !reason || details.length > 1000)
    return NextResponse.json({ error: "通報内容が正しくありません" }, { status: 400 });
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_message_report", {
    p_message_id: messageId,
    p_reason: reason,
    p_details: details,
    p_guest_id: getGuestId(request),
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 403 });
  return NextResponse.json({ ok: true });
}
