import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { confirmation?: unknown };
  if (body.confirmation !== "削除する")
    return NextResponse.json({ error: "確認欄に「削除する」と入力してください" }, { status: 400 });

  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profileError) return NextResponse.json({ error: "アカウント情報を確認できませんでした" }, { status: 500 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secretKey) {
    console.error("Account deletion is not configured: SUPABASE_SECRET_KEY is missing");
    return NextResponse.json({ error: "退会機能の設定が完了していません。管理者へお問い合わせください" }, { status: 503 });
  }

  const admin = createAdminClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  if (profile.role === "admin") {
    const { count, error: countError } = await admin
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin");
    if (countError)
      return NextResponse.json({ error: "管理者情報を確認できませんでした" }, { status: 500 });
    if ((count ?? 0) <= 1)
      return NextResponse.json({ error: "最後の管理者アカウントは削除できません。先に別の管理者を設定してください" }, { status: 409 });
  }
  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) {
    console.error("Account deletion failed", { userId: user.id, message: deleteError.message });
    return NextResponse.json({ error: "アカウントを削除できませんでした" }, { status: 500 });
  }

  await supabase.auth.signOut({ scope: "local" });
  return NextResponse.json({ ok: true });
}
