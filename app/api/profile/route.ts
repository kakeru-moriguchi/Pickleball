import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  const body = (await request.json()) as Record<string, unknown>;
  const value = (key: string) => (typeof body[key] === "string" ? body[key] : "");
  const { error } = await supabase
    .from("users")
    .update({
      display_name: value("displayName"),
      prefecture: value("prefecture"),
      level: value("level"),
    })
    .eq("id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
