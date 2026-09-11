import { NextRequest, NextResponse } from "next/server";
import { getGuestId, setGuestId } from "@/lib/guest";
import { normalizeType } from "@/lib/posts";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const body = (await request.json()) as Record<string, unknown>;
  const type = normalizeType(body.type);
  const postId = typeof body.postId === "string" ? body.postId : "";
  const reason = typeof body.reason === "string" ? body.reason : "";
  const details = typeof body.details === "string" ? body.details.trim() : "";
  if (!type || !postId) return NextResponse.json({ error: "対象が正しくありません" }, { status: 400 });
  if (details.length > 1000) return NextResponse.json({ error: "詳細は1000文字以内で入力してください" }, { status: 400 });

  const currentGuestId = getGuestId(request);
  const guestId = currentGuestId ?? crypto.randomUUID();
  const { error } = await supabase.rpc("create_report", {
    p_type: type,
    p_post_id: postId,
    p_reason: reason,
    p_details: details,
    p_guest_id: guestId,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const response = NextResponse.json({ ok: true }, { status: 201 });
  if (!user && !currentGuestId) setGuestId(response, guestId);
  return response;
}
