import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { count, normalizeType, required, tableFor, type PostType } from "@/lib/posts";

type Raw = Record<string, unknown>;

function mapPost(type: PostType, row: Raw, counts: Record<string, number>, joined: Set<string>) {
  const id = String(row.id);
  return {
    type,
    id,
    author_id: row.author_id,
    title: type === "event" ? row.event_name : row.title,
    held_on: type === "member" ? row.tournament_date : row.held_on,
    start_time: type === "member" ? "" : row.start_time,
    end_time: type === "member" ? "" : row.end_time,
    venue: row.venue,
    prefecture: row.prefecture,
    capacity: row.capacity,
    fee: type === "member" ? 0 : row.fee,
    level: type === "event" ? "" : row.level,
    category: type === "practice" ? "" : type === "member" ? row.category : row.event_type,
    description: row.description,
    organizer:
      type === "practice"
        ? row.organizer_name
        : type === "member"
          ? row.author_name
          : row.organizer,
    status: row.status,
    created_at: row.created_at,
    participant_count: counts[`${type}:${id}`] ?? 0,
    secondary_title: type === "member" ? row.tournament_name : "",
    deadline: type === "member" ? row.deadline : "",
    application_method: type === "event" ? row.application_method : "",
    viewer_joined: joined.has(`${type}:${id}`) ? 1 : 0,
  };
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const queries = await Promise.all([
      supabase.from("practice_posts").select("*").order("held_on").limit(100),
      supabase.from("member_posts").select("*").order("tournament_date").limit(100),
      supabase.from("event_posts").select("*").order("held_on").limit(100),
      supabase.rpc("get_post_participation_counts"),
      user
        ? supabase.from("participations").select("post_type,post_id").eq("user_id", user.id)
        : Promise.resolve({ data: [], error: null }),
    ]);
    const firstError = queries.find((result) => result.error)?.error;
    if (firstError) throw firstError;
    const countMap: Record<string, number> = {};
    (queries[3].data ?? []).forEach((row: Raw) => {
      countMap[`${row.post_type}:${row.post_id}`] = Number(row.participant_count);
    });
    const joined = new Set(
      (queries[4].data ?? []).map((row: Raw) => `${row.post_type}:${row.post_id}`),
    );
    let posts = [
      ...(queries[0].data ?? []).map((row) => mapPost("practice", row, countMap, joined)),
      ...(queries[1].data ?? []).map((row) => mapPost("member", row, countMap, joined)),
      ...(queries[2].data ?? []).map((row) => mapPost("event", row, countMap, joined)),
    ];
    const p = request.nextUrl.searchParams;
    const type = normalizeType(p.get("type"));
    const q = p.get("q")?.toLowerCase();
    if (type) posts = posts.filter((x) => x.type === type);
    if (q)
      posts = posts.filter((x) =>
        [x.title, x.venue, x.description, x.secondary_title].some((v) =>
          String(v).toLowerCase().includes(q),
        ),
      );
    for (const key of ["prefecture", "level", "category"] as const) {
      const value = p.get(key);
      if (value) posts = posts.filter((x) => x[key] === value);
    }
    const date = p.get("date");
    if (date) posts = posts.filter((x) => x.held_on === date);
    const scope = p.get("scope");
    if (scope === "mine") {
      if (!user) return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
      posts = posts.filter((x) => x.author_id === user.id);
    }
    if (scope === "joined") {
      if (!user) return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
      posts = posts.filter((x) => x.viewer_joined);
    }
    posts.sort(
      (a, b) =>
        String(a.held_on).localeCompare(String(b.held_on)) ||
        String(b.created_at).localeCompare(String(a.created_at)),
    );
    return NextResponse.json({ posts });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "読み込みに失敗しました" },
      { status: 500 },
    );
  }
}

function values(type: PostType, body: Record<string, unknown>, userId: string) {
  if (type === "practice")
    return {
      author_id: userId,
      title: required(body, "title"),
      held_on: required(body, "heldOn"),
      start_time: required(body, "startTime"),
      end_time: required(body, "endTime"),
      venue: required(body, "venue"),
      prefecture: required(body, "prefecture"),
      capacity: count(body, "capacity"),
      fee: count(body, "fee", true),
      level: required(body, "level"),
      description: required(body, "description"),
      organizer_name: required(body, "organizer"),
    };
  if (type === "member")
    return {
      author_id: userId,
      tournament_name: required(body, "tournamentName"),
      tournament_date: required(body, "heldOn"),
      venue: required(body, "venue"),
      prefecture: required(body, "prefecture"),
      title: required(body, "title"),
      capacity: count(body, "capacity"),
      category: required(body, "category"),
      level: required(body, "level"),
      description: required(body, "description"),
      deadline: required(body, "deadline"),
      author_name: required(body, "organizer"),
    };
  return {
    author_id: userId,
    event_name: required(body, "title"),
    event_type: required(body, "category"),
    held_on: required(body, "heldOn"),
    start_time: required(body, "startTime"),
    end_time: required(body, "endTime"),
    venue: required(body, "venue"),
    prefecture: required(body, "prefecture"),
    fee: count(body, "fee", true),
    capacity: count(body, "capacity"),
    description: required(body, "description"),
    organizer: required(body, "organizer"),
    application_method: required(body, "applicationMethod"),
  };
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "投稿にはログインが必要です" }, { status: 401 });
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const type = normalizeType(body.type);
    if (!type) throw new Error("募集種別が正しくありません");
    const { data, error } = await supabase
      .from(tableFor[type])
      .insert(values(type, body, user.id) as never)
      .select("id")
      .single();
    if (error) throw error;
    return NextResponse.json({ id: data.id, type }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "投稿に失敗しました" },
      { status: 400 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const type = normalizeType(body.type);
    const id = required(body, "id");
    if (!type) throw new Error("対象が正しくありません");
    const patch =
      body.action === "edit"
        ? values(type, body, user.id)
        : { status: body.status === "closed" ? "closed" : "open" };
    const { error } = await supabase.from(tableFor[type]).update(patch as never).eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "更新に失敗しました" },
      { status: 400 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  const body = (await request.json()) as Record<string, unknown>;
  const type = normalizeType(body.type);
  const id = typeof body.id === "string" ? body.id : "";
  if (!type || !id) return NextResponse.json({ error: "対象が正しくありません" }, { status: 400 });
  const { error } = await supabase.from(tableFor[type]).delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 403 });
  return NextResponse.json({ ok: true });
}
