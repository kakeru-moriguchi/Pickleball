import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { normalizeType } from "@/lib/posts";
import { getGuestId, setGuestId } from "@/lib/guest";

type ApplicationBody = {
  type?: unknown;
  postId?: unknown;
  applicantName?: unknown;
  level?: unknown;
  partySize?: unknown;
  hasPaddle?: unknown;
  hasNet?: unknown;
  hasBall?: unknown;
};

type ApplicantRow = {
  id: string;
  applicant_name: string;
  level: string;
  party_size: number;
  has_paddle: boolean;
  has_net: boolean;
  has_ball: boolean;
  created_at: string;
};

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const body = (await request.json()) as ApplicationBody;
  const type = normalizeType(body.type);
  const postId = typeof body.postId === "string" ? body.postId : "";
  const applicantName = typeof body.applicantName === "string" ? body.applicantName.trim() : "";
  const level = typeof body.level === "string" ? body.level : "";
  const partySize = Number(body.partySize);
  if (!type || !postId)
    return NextResponse.json({ error: "対象が正しくありません" }, { status: 400 });
  if (!applicantName || applicantName.length > 80)
    return NextResponse.json({ error: "名前を80文字以内で入力してください" }, { status: 400 });
  if (!Number.isInteger(partySize) || partySize < 1 || partySize > 50)
    return NextResponse.json({ error: "参加人数が正しくありません" }, { status: 400 });

  const currentGuestId = getGuestId(request);
  const guestId = currentGuestId ?? crypto.randomUUID();
  const { error } = await supabase.rpc("join_post", {
    p_type: type,
    p_post_id: postId,
    p_applicant_name: applicantName,
    p_level: level,
    p_party_size: partySize,
    p_has_paddle: body.hasPaddle === true,
    p_has_net: body.hasNet === true,
    p_has_ball: body.hasBall === true,
    p_guest_id: guestId,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 409 });
  const response = NextResponse.json({ ok: true });
  if (!user && !currentGuestId) setGuestId(response, guestId);
  return response;
}
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const body = (await request.json()) as { type?: unknown; postId?: unknown };
  const type = normalizeType(body.type);
  const postId = typeof body.postId === "string" ? body.postId : "";
  if (!type || !postId)
    return NextResponse.json({ error: "対象が正しくありません" }, { status: 400 });
  const guestId = getGuestId(request);
  if (!user && !guestId)
    return NextResponse.json({ error: "この端末の応募情報が見つかりません" }, { status: 401 });
  const { error } = await supabase.rpc("cancel_post_participation", {
    p_type: type,
    p_post_id: postId,
    p_guest_id: guestId,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  const type = normalizeType(request.nextUrl.searchParams.get("type"));
  const postId = request.nextUrl.searchParams.get("postId") ?? "";
  if (!type || !postId)
    return NextResponse.json({ error: "対象が正しくありません" }, { status: 400 });
  const { data, error } = await supabase.rpc("get_post_applicants", {
    p_type: type,
    p_post_id: postId,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 403 });
  return NextResponse.json({
    applicants: ((data ?? []) as ApplicantRow[]).map((row) => ({
      id: row.id,
      applicantName: row.applicant_name,
      level: row.level,
      partySize: row.party_size,
      hasPaddle: row.has_paddle,
      hasNet: row.has_net,
      hasBall: row.has_ball,
      created_at: row.created_at,
    })),
  });
}
