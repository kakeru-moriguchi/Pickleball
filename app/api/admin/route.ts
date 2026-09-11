import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function getAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "管理者権限が必要です" }, { status: 403 }) };
  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return { error: NextResponse.json({ error: "管理者権限が必要です" }, { status: 403 }) };
  return { supabase, user };
}

export async function GET() {
  const auth = await getAdmin();
  if (auth.error) return auth.error;
  const supabase = auth.supabase;
  const [users, practices, members, events, reports, inquiries] = await Promise.all([
    supabase
      .from("users")
      .select("id,email,display_name,role,created_at")
      .order("created_at", { ascending: false })
      .limit(100),
    supabase.from("practice_posts").select("*", { count: "exact", head: true }),
    supabase.from("member_posts").select("*", { count: "exact", head: true }),
    supabase.from("event_posts").select("*", { count: "exact", head: true }),
    supabase.from("reports").select("id,post_type,post_id,reason,details,status,created_at").order("created_at", { ascending: false }).limit(100),
    supabase.from("inquiries").select("id,name,email,message,status,created_at").order("created_at", { ascending: false }).limit(100),
  ]);
  const firstError = [users, practices, members, events, reports, inquiries].find((result) => result.error)?.error;
  if (firstError) return NextResponse.json({ error: firstError.message }, { status: 500 });
  return NextResponse.json({
    users: users.data,
    reports: reports.data ?? [],
    inquiries: inquiries.data ?? [],
    counts: {
      practices: practices.count ?? 0,
      members: members.count ?? 0,
      events: events.count ?? 0,
      users: (users.data ?? []).length,
      reports: (reports.data ?? []).filter((item) => item.status === "open").length,
      inquiries: (inquiries.data ?? []).filter((item) => item.status === "open").length,
    },
  });
}

export async function PATCH(request: NextRequest) {
  const auth = await getAdmin();
  if (auth.error) return auth.error;
  const supabase = auth.supabase;
  const body = (await request.json()) as Record<string, unknown>;
  const target = body.target === "report" || body.target === "inquiry" ? body.target : "";
  const id = typeof body.id === "string" ? body.id : "";
  if (!target || !id) return NextResponse.json({ error: "対象が正しくありません" }, { status: 400 });
  const { error } = await supabase.from(target === "report" ? "reports" : "inquiries")
    .update({ status: "resolved", resolved_at: new Date().toISOString(), resolved_by: auth.user.id }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
