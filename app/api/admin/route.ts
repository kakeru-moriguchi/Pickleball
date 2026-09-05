import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "管理者権限が必要です" }, { status: 403 });
  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin")
    return NextResponse.json({ error: "管理者権限が必要です" }, { status: 403 });
  const [users, practices, members, events] = await Promise.all([
    supabase
      .from("users")
      .select("id,email,display_name,role,created_at")
      .order("created_at", { ascending: false })
      .limit(100),
    supabase.from("practice_posts").select("*", { count: "exact", head: true }),
    supabase.from("member_posts").select("*", { count: "exact", head: true }),
    supabase.from("event_posts").select("*", { count: "exact", head: true }),
  ]);
  if (users.error) return NextResponse.json({ error: users.error.message }, { status: 500 });
  return NextResponse.json({
    users: users.data,
    counts: {
      practices: practices.count ?? 0,
      members: members.count ?? 0,
      events: events.count ?? 0,
      users: users.data.length,
    },
  });
}
