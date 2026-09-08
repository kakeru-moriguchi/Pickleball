import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  const body = (await request.json()) as Record<string, unknown>;
  const value = (key: string) => (typeof body[key] === "string" ? body[key].trim() : "");
  const displayName = value("displayName");
  if (!displayName) {
    return NextResponse.json({ error: "表示名を入力してください" }, { status: 422 });
  }
  const { data, error } = await supabase
    .from("users")
    .update({
      display_name: displayName,
      prefecture: value("prefecture"),
      level: value("level"),
    })
    .eq("id", user.id)
    .select("id,email,display_name,prefecture,level,role")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, user: data });
}
