import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { normalizeType } from "@/lib/posts";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "参加にはログインが必要です" }, { status: 401 });
  const body = (await request.json()) as { type?: unknown; postId?: unknown };
  const type = normalizeType(body.type);
  const postId = typeof body.postId === "string" ? body.postId : "";
  if (!type || !postId)
    return NextResponse.json({ error: "対象が正しくありません" }, { status: 400 });
  const { error } = await supabase.rpc("join_post", { p_type: type, p_post_id: postId });
  if (error) return NextResponse.json({ error: error.message }, { status: 409 });
  return NextResponse.json({ ok: true });
}
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  const body = (await request.json()) as { type?: unknown; postId?: unknown };
  const type = normalizeType(body.type);
  const postId = typeof body.postId === "string" ? body.postId : "";
  if (!type || !postId)
    return NextResponse.json({ error: "対象が正しくありません" }, { status: 400 });
  const { error } = await supabase
    .from("participations")
    .delete()
    .eq("user_id", user.id)
    .eq("post_type", type)
    .eq("post_id", postId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
