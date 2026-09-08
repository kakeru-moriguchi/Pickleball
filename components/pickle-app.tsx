"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronRight,
  CirclePlus,
  Clock3,
  Dumbbell,
  Home,
  MapPin,
  MapPinned,
  Search,
  Trophy,
  UserRound,
  UsersRound,
  WalletCards,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { developmentSamplePosts, type CommunityPost } from "@/lib/community-post";

type PostType = "practice" | "member" | "event";
type Screen = "home" | PostType | "create" | "mypage" | "admin";
type Post = CommunityPost;
type UserProfile = {
  id: string;
  email: string;
  display_name: string;
  prefecture: string;
  level: string;
  role: string;
};
type Me = {
  signedIn: boolean;
  user?: UserProfile;
};

declare global {
  interface Document {
    modelContext?: {
      registerTool: (tool: unknown, options?: { signal?: AbortSignal }) => void | Promise<void>;
    };
  }
}

const labels: Record<PostType, string> = {
  practice: "練習会",
  member: "大会メンバー",
  event: "イベント",
};
const categoryOptions = ["男子ダブルス", "女子ダブルス", "ミックスダブルス", "団体戦", "その他"];
const eventOptions = ["大会", "交流会", "練習会", "体験会", "講習会", "その他"];
const levelOptions = ["初心者歓迎", "初級", "中級", "上級", "レベル不問"];
const prefectures = [
  "北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県",
  "茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県",
  "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県", "岐阜県", "静岡県", "愛知県",
  "三重県", "滋賀県", "京都府", "大阪府", "兵庫県", "奈良県", "和歌山県",
  "鳥取県", "島根県", "岡山県", "広島県", "山口県", "徳島県", "香川県", "愛媛県", "高知県",
  "福岡県", "佐賀県", "長崎県", "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県",
];

const nav = [
  { screen: "home" as Screen, label: "ホーム", icon: Home },
  { screen: "practice" as Screen, label: "練習会", icon: Dumbbell },
  { screen: "member" as Screen, label: "メンバー", icon: UsersRound },
  { screen: "event" as Screen, label: "イベント", icon: CalendarDays },
  { screen: "mypage" as Screen, label: "マイページ", icon: UserRound },
];

function formatDate(value: string) {
  if (!value) return "日程未定";
  const date = new Date(`${value}T00:00:00`);
  return `${date.getMonth() + 1}月${date.getDate()}日 (${["日", "月", "火", "水", "木", "金", "土"][date.getDay()]})`;
}

function formatTime(value: string) {
  return value ? value.slice(0, 5) : "";
}

function remaining(post: Post) {
  return Math.max(0, post.capacity - post.participant_count);
}

function filterDevelopmentPosts(
  screen: Screen,
  q: string,
  filters: { prefecture: string; date: string; level: string; category: string },
) {
  return developmentSamplePosts.filter((post) => {
    if ((screen === "practice" || screen === "member" || screen === "event") && post.type !== screen)
      return false;
    if (
      q &&
      ![post.title, post.venue, post.description, post.secondary_title].some((value) =>
        value.toLowerCase().includes(q.toLowerCase()),
      )
    )
      return false;
    if (filters.prefecture && post.prefecture !== filters.prefecture) return false;
    if (filters.date && post.held_on !== filters.date) return false;
    if (filters.level && post.level !== filters.level) return false;
    if (filters.category && post.category !== filters.category) return false;
    return true;
  });
}

async function readJson(response: Response) {
  const data = (await response.json()) as { error?: string; [key: string]: unknown };
  if (!response.ok) throw new Error(data.error ?? "処理に失敗しました");
  return data;
}

export function PickleApp() {
  const [screen, setScreen] = useState<Screen>("home");
  const [posts, setPosts] = useState<Post[]>([]);
  const [selected, setSelected] = useState<Post | null>(null);
  const [createType, setCreateType] = useState<PostType | null>(null);
  const [editing, setEditing] = useState<Post | null>(null);
  const [q, setQ] = useState("");
  const [filters, setFilters] = useState({ prefecture: "", date: "", level: "", category: "" });
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [me, setMe] = useState<Me>({ signedIn: false });
  const [mine, setMine] = useState<Post[]>([]);
  const [joined, setJoined] = useState<Post[]>([]);
  const [currentRegion, setCurrentRegion] = useState("宮崎県");

  const loadPosts = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (screen === "practice" || screen === "member" || screen === "event")
      params.set("type", screen);
    if (q) params.set("q", q);
    Object.entries(filters).forEach(([key, value]) => value && params.set(key, value));
    try {
      const data = await readJson(await fetch(`/api/posts?${params}`));
      let nextPosts = data.posts as Post[];
      if (process.env.NODE_ENV === "development" && nextPosts.length === 0) {
        nextPosts = filterDevelopmentPosts(screen, q, filters);
      }
      setPosts(nextPosts);
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        setPosts(filterDevelopmentPosts(screen, q, filters));
        setNotice("");
      } else {
        setNotice(error instanceof Error ? error.message : "読み込みに失敗しました");
      }
    } finally {
      setLoading(false);
    }
  }, [screen, q, filters]);

  useEffect(() => {
    if (screen !== "create" && screen !== "mypage" && screen !== "admin") void loadPosts();
  }, [loadPosts, screen]);
  useEffect(() => {
    void fetch("/api/me")
      .then(readJson)
      .then((data) => setMe(data as unknown as Me))
      .catch(() => {});
  }, []);
  useEffect(() => {
    const saved = window.localStorage.getItem("pickle-link-region");
    if (saved && prefectures.includes(saved)) setCurrentRegion(saved);
  }, []);
  useEffect(() => {
    if (!window.localStorage.getItem("pickle-link-region") && me.user?.prefecture) {
      setCurrentRegion(me.user.prefecture);
    }
  }, [me.user?.prefecture]);
  useEffect(() => {
    if (screen !== "mypage") return;
    Promise.all([
      fetch("/api/posts?scope=mine").then(readJson),
      fetch("/api/posts?scope=joined").then(readJson),
      fetch("/api/me").then(readJson),
    ])
      .then(([a, b, c]) => {
        setMine(a.posts as Post[]);
        setJoined(b.posts as Post[]);
        setMe(c as unknown as Me);
      })
      .catch(() => {});
  }, [screen]);

  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    try {
      void Promise.resolve(
        context.registerTool(
          {
            name: "search_posts",
            title: "募集を検索",
            description:
              "キーワードで練習会・大会メンバー・イベントを検索し、結果を画面に表示します。",
            inputSchema: {
              type: "object",
              properties: { keyword: { type: "string" } },
              required: ["keyword"],
              additionalProperties: false,
            },
            annotations: { readOnlyHint: true, untrustedContentHint: true },
            execute: async (input: unknown) => {
              const keyword = String((input as { keyword?: unknown })?.keyword ?? "").trim();
              setQ(keyword);
              setScreen("home");
              const data = await readJson(
                await fetch(`/api/posts?q=${encodeURIComponent(keyword)}`),
              );
              setPosts(data.posts as Post[]);
              return { count: (data.posts as Post[]).length, keyword };
            },
          },
          { signal: lifecycle.signal },
        ),
      ).catch(() => {});
      void Promise.resolve(
        context.registerTool(
          {
            name: "start_post_creation",
            title: "募集作成を開始",
            description: "指定した募集種別の投稿フォームを画面に開きます。",
            inputSchema: {
              type: "object",
              properties: { type: { type: "string", enum: ["practice", "member", "event"] } },
              required: ["type"],
              additionalProperties: false,
            },
            annotations: { readOnlyHint: false, untrustedContentHint: false },
            execute: (input: unknown) => {
              const type = (input as { type?: PostType })?.type;
              if (!type || !labels[type]) throw new Error("募集種別が正しくありません");
              setCreateType(type);
              setScreen("create");
              return { started: true, type };
            },
          },
          { signal: lifecycle.signal },
        ),
      ).catch(() => {});
    } catch {
      /* Unsupported WebMCP contexts fail silently. */
    }
    return () => lifecycle.abort();
  }, []);

  const go = (next: Screen) => {
    setScreen(next);
    setSelected(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const openCreate = (type?: PostType) => {
    setEditing(null);
    setCreateType(type ?? null);
    go("create");
  };
  const openEdit = (post: Post) => {
    setEditing(post);
    setCreateType(post.type);
    go("create");
  };
  const changeRegion = (region: string) => {
    setCurrentRegion(region);
    window.localStorage.setItem("pickle-link-region", region);
  };
  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    void loadPosts();
  };

  async function participate(post: Post) {
    if (post.is_demo) {
      setNotice("これは開発用サンプルです。実際の募集では参加できます");
      return;
    }
    try {
      await readJson(
        await fetch("/api/participations", {
          method: post.viewer_joined ? "DELETE" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: post.type, postId: post.id }),
        }),
      );
      setNotice(post.viewer_joined ? "参加をキャンセルしました" : "参加を受け付けました");
      setSelected(null);
      await loadPosts();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "処理に失敗しました");
    }
  }

  async function manage(post: Post, action: "close" | "delete") {
    try {
      await readJson(
        await fetch("/api/posts", {
          method: action === "delete" ? "DELETE" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: post.id, type: post.type, status: "closed" }),
        }),
      );
      setNotice(action === "delete" ? "投稿を削除しました" : "募集を終了しました");
      go("mypage");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "処理に失敗しました");
    }
  }

  return (
    <div className="min-h-screen pb-28 md:pb-0">
      <header className="sticky top-0 z-30 border-b border-zinc-200 bg-[#fbfaf8]/95 px-4 backdrop-blur-md md:px-8">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-6">
          <button
            onClick={() => go("home")}
            className="flex shrink-0 items-center gap-2.5"
            aria-label="ホームへ"
          >
            <span className="grid size-9 place-items-center rounded-lg bg-primary text-sm font-black text-white">
              PL
            </span>
            <span className="text-lg font-extrabold tracking-tight">Pickle Link</span>
          </button>
          <div className="hidden flex-1 items-center justify-center gap-1 md:flex">
            {nav.map(({ screen: target, label }) => (
              <button
                key={target}
                onClick={() => go(target)}
                className={`border-b-2 px-3 py-5 text-sm font-bold transition ${screen === target ? "border-primary text-primary" : "border-transparent text-zinc-500 hover:text-zinc-900"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <Button
            onClick={() => openCreate()}
            className="hidden h-10 rounded-lg px-4 font-bold md:flex"
          >
            <CirclePlus /> 募集する
          </Button>
        </div>
      </header>

      {notice && (
        <button
          onClick={() => setNotice("")}
          className="fixed left-1/2 top-20 z-50 w-[min(92%,28rem)] -translate-x-1/2 rounded-2xl bg-zinc-900 px-4 py-3 text-sm font-bold text-white shadow-xl"
        >
          {notice}
        </button>
      )}

      <main className="mx-auto max-w-5xl px-4 py-5 md:px-8 md:py-8">
        {screen === "home" && (
          <HomeScreen
            posts={posts}
            loading={loading}
            q={q}
            setQ={setQ}
            onSearch={submitSearch}
            onOpen={setSelected}
            onMore={go}
            onCreate={openCreate}
            region={currentRegion}
            onRegionChange={changeRegion}
          />
        )}
        {(screen === "practice" || screen === "member" || screen === "event") && (
          <ListScreen
            type={screen}
            posts={posts}
            loading={loading}
            q={q}
            setQ={setQ}
            filters={filters}
            setFilters={setFilters}
            onSearch={submitSearch}
            onOpen={setSelected}
            onCreate={() => openCreate(screen)}
          />
        )}
        {screen === "create" && (
          <CreateScreen
            type={createType}
            initial={editing}
            setType={setCreateType}
            onBack={() => go("home")}
            onCreated={() => {
              setEditing(null);
              setNotice(editing ? "募集を更新しました" : "募集を投稿しました");
              go("home");
              void loadPosts();
            }}
          />
        )}
        {screen === "mypage" && (
          <MyPage
            me={me}
            mine={mine}
            joined={joined}
            onOpen={setSelected}
            onEdit={openEdit}
            onManage={manage}
            onAdmin={() => go("admin")}
            onProfileSaved={(user) => setMe({ signedIn: true, user })}
          />
        )}
        {screen === "admin" && (
          <AdminPage onBack={() => go("mypage")} onOpen={setSelected} onManage={manage} />
        )}
      </main>

      <nav
        aria-label="メインナビゲーション"
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-zinc-200 bg-white/97 px-1 pb-[max(.45rem,env(safe-area-inset-bottom))] pt-1.5 backdrop-blur-md md:hidden"
      >
        {nav.map(({ screen: target, label, icon: Icon }) => (
          <button
            key={target}
            onClick={() => go(target)}
            className={`relative flex min-h-13 flex-col items-center justify-center gap-1 text-[10px] font-bold transition ${screen === target ? "text-primary" : "text-zinc-500"}`}
          >
            {screen === target && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-primary" />}
            <Icon className="size-[19px]" strokeWidth={screen === target ? 2.5 : 2} />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      {screen !== "create" && screen !== "admin" && (
        <Button
          onClick={() => openCreate()}
          className="fixed bottom-[5.5rem] right-4 z-30 h-12 rounded-full px-5 font-bold shadow-lg shadow-black/15 md:hidden"
        >
          <CirclePlus className="size-5" />
          募集する
        </Button>
      )}

      <DetailDialog post={selected} onClose={() => setSelected(null)} onParticipate={participate} />
    </div>
  );
}

function SearchBox({
  q,
  setQ,
  onSearch,
}: {
  q: string;
  setQ: (v: string) => void;
  onSearch: (e: FormEvent) => void;
}) {
  return (
    <form onSubmit={onSearch} className="flex items-center rounded-xl border border-zinc-200 bg-white p-1">
      <Search className="ml-3 size-4.5 text-zinc-400" />
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        aria-label="キーワード検索"
        className="h-10 border-0 bg-transparent text-zinc-900 shadow-none focus-visible:ring-0"
        placeholder="場所・大会名・キーワード"
      />
      <Button className="h-9 rounded-lg px-4">探す</Button>
    </form>
  );
}

function HomeScreen({
  posts,
  loading,
  q,
  setQ,
  onSearch,
  onOpen,
  onMore,
  onCreate,
  region,
  onRegionChange,
}: {
  posts: Post[];
  loading: boolean;
  q: string;
  setQ: (v: string) => void;
  onSearch: (e: FormEvent) => void;
  onOpen: (p: Post) => void;
  onMore: (s: Screen) => void;
  onCreate: (t: PostType) => void;
  region: string;
  onRegionChange: (region: string) => void;
}) {
  const regionalPosts = posts.filter((post) => post.prefecture === region);
  const groups = [
    { type: "practice" as PostType, title: "今週参加できる練習会", link: "練習会をもっと見る" },
    { type: "member" as PostType, title: "大会メンバーを探している人", link: "メンバー募集を見る" },
    { type: "event" as PostType, title: "近くの大会・イベント", link: "イベント一覧を見る" },
  ];
  return (
    <>
      <section className="border-b border-zinc-200 pb-5">
        <label className="inline-flex items-center gap-1.5 text-sm font-bold text-zinc-600">
          <MapPinned className="size-4 text-primary" />
          <NativeSelect
            aria-label="現在の地域"
            value={region}
            onChange={(event) => onRegionChange(event.target.value)}
            className="h-8 min-w-28 border-0 bg-transparent px-1 font-bold text-zinc-700 shadow-none"
          >
            {prefectures.map((prefecture) => (
              <NativeSelectOption key={prefecture}>{prefecture}</NativeSelectOption>
            ))}
          </NativeSelect>
          <span className="text-xs font-medium text-primary">変更</span>
        </label>
        <h1 className="mt-3 text-[1.65rem] font-black leading-tight tracking-tight text-zinc-900 md:text-3xl">
          {region.replace(/[都道府県]$/, "")}でピックルボールしよう。
        </h1>
        <p className="mt-1.5 text-sm leading-6 text-zinc-600">
          近くの練習会と、一緒にプレーする仲間が見つかります。
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:max-w-md">
          <Button onClick={() => onMore("practice")} className="h-10 rounded-lg font-bold">
            練習会を探す
          </Button>
          <Button onClick={() => onMore("member")} variant="outline" className="h-10 rounded-lg border-zinc-300 font-bold">
            メンバーを探す
          </Button>
        </div>
        <div className="mt-4 max-w-xl">
          <SearchBox q={q} setQ={setQ} onSearch={onSearch} />
        </div>
      </section>

      {developmentSamplePosts.some((sample) => posts.some((post) => post.id === sample.id)) && (
        <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          開発用サンプルを表示しています。本番データには保存されません。
        </p>
      )}

      {groups.map((group, index) => (
        <section key={group.type} className={index === 0 ? "mt-6" : "mt-9"}>
          <div className="mb-3 flex items-end justify-between gap-4">
            <h2 className="text-lg font-black tracking-tight md:text-xl">{group.title}</h2>
            <button onClick={() => onMore(group.type)} className="shrink-0 text-xs font-bold text-primary">
              {group.link} <span aria-hidden>›</span>
            </button>
          </div>
          <CardGrid
            posts={regionalPosts.filter((p) => p.type === group.type).slice(0, 3)}
            loading={loading}
            type={group.type}
            onOpen={onOpen}
            onCreate={() => onCreate(group.type)}
          />
        </section>
      ))}
      <section className="mt-9 border-t border-zinc-200 pt-7">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-black">新着の募集</h2>
        </div>
        <CardGrid
          posts={[...regionalPosts].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 3)}
          loading={loading}
          type="practice"
          onOpen={onOpen}
          onCreate={() => onCreate("practice")}
        />
      </section>
    </>
  );
}

function ListScreen({
  type,
  posts,
  loading,
  q,
  setQ,
  filters,
  setFilters,
  onSearch,
  onOpen,
  onCreate,
}: {
  type: PostType;
  posts: Post[];
  loading: boolean;
  q: string;
  setQ: (v: string) => void;
  filters: { prefecture: string; date: string; level: string; category: string };
  setFilters: (v: { prefecture: string; date: string; level: string; category: string }) => void;
  onSearch: (e: FormEvent) => void;
  onOpen: (p: Post) => void;
  onCreate: () => void;
}) {
  return (
    <>
      <div className="flex items-end justify-between border-b border-zinc-200 pb-4">
        <div>
          <p className="text-xs font-bold text-primary">
            {type === "practice" ? "一緒に打てる場所を探す" : type === "member" ? "一緒に大会へ出る仲間を探す" : "近くで開催される予定"}
          </p>
          <h1 className="mt-1 text-2xl font-black tracking-tight">{labels[type]}</h1>
        </div>
        <Button onClick={onCreate} variant="outline" className="hidden rounded-lg md:flex">
          <CirclePlus />
          募集する
        </Button>
      </div>
      <div className="mt-5">
        <SearchBox q={q} setQ={setQ} onSearch={onSearch} />
      </div>
      <div className="mt-3 flex gap-2 overflow-x-auto rounded-xl border border-zinc-200 bg-white p-2">
        <NativeSelect
          value={filters.prefecture}
          onChange={(e) => setFilters({ ...filters, prefecture: e.target.value })}
          className="min-w-32"
        >
          <NativeSelectOption value="">都道府県</NativeSelectOption>
          {prefectures.map((x) => (
            <NativeSelectOption key={x}>{x}</NativeSelectOption>
          ))}
        </NativeSelect>
        <Input
          type="date"
          aria-label="開催日"
          value={filters.date}
          onChange={(e) => setFilters({ ...filters, date: e.target.value })}
          className="w-40"
        />
        {type !== "event" && (
          <NativeSelect
            value={filters.level}
            onChange={(e) => setFilters({ ...filters, level: e.target.value })}
            className="min-w-32"
          >
            <NativeSelectOption value="">レベル</NativeSelectOption>
            {levelOptions.map((x) => (
              <NativeSelectOption key={x}>{x}</NativeSelectOption>
            ))}
          </NativeSelect>
        )}
        {type !== "practice" && (
          <NativeSelect
            value={filters.category}
            onChange={(e) => setFilters({ ...filters, category: e.target.value })}
            className="min-w-32"
          >
            <NativeSelectOption value="">カテゴリー</NativeSelectOption>
            {(type === "event" ? eventOptions : categoryOptions).map((x) => (
              <NativeSelectOption key={x}>{x}</NativeSelectOption>
            ))}
          </NativeSelect>
        )}
      </div>
      <p className="my-4 text-sm font-bold text-zinc-500">
        {loading ? "検索中…" : `${posts.length}件の募集`}
      </p>
      <CardGrid posts={posts} loading={loading} type={type} onOpen={onOpen} onCreate={onCreate} />
    </>
  );
}

function CardGrid({
  posts,
  loading,
  type,
  onOpen,
  onCreate,
}: {
  posts: Post[];
  loading: boolean;
  type: PostType;
  onOpen: (p: Post) => void;
  onCreate: () => void;
}) {
  if (loading)
    return (
      <div className="grid gap-3 md:grid-cols-2">
        {[1, 2, 3].map((x) => (
          <div key={x} className="h-40 animate-pulse rounded-xl border border-zinc-200 bg-white" />
        ))}
      </div>
    );
  if (!posts.length)
    return (
      <div className="rounded-xl border border-dashed border-zinc-300 bg-white px-5 py-7 text-left">
        <p className="font-bold">まだ募集はありません</p>
        <p className="mt-1 text-sm text-zinc-500">この地域の最初の募集を投稿してみませんか。</p>
        <Button onClick={onCreate} variant="outline" className="mt-4 h-9 rounded-lg">
          募集を作る
        </Button>
      </div>
    );
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {posts.map((post) => (
        <PostCard key={`${post.type}-${post.id}`} post={post} onOpen={onOpen} />
      ))}
    </div>
  );
}

function PostCard({ post, onOpen }: { post: Post; onOpen: (p: Post) => void }) {
  if (post.type === "member") return <MemberPostCard post={post} onOpen={onOpen} />;
  if (post.type === "event") return <EventPostCard post={post} onOpen={onOpen} />;
  return <PracticePostCard post={post} onOpen={onOpen} />;
}

function PracticePostCard({ post, onOpen }: { post: Post; onOpen: (p: Post) => void }) {
  const full = post.status === "closed" || post.participant_count >= post.capacity;
  const date = new Date(`${post.held_on}T00:00:00`);
  return (
    <button
      onClick={() => onOpen(post)}
      className="group flex w-full gap-4 rounded-xl border border-zinc-200 bg-white p-4 text-left transition hover:border-pink-300 hover:bg-pink-50/20"
    >
      <div className="flex h-16 w-14 shrink-0 flex-col items-center justify-center rounded-lg bg-pink-50 text-primary">
        <span className="text-[10px] font-bold">{date.getMonth() + 1}月</span>
        <strong className="text-2xl leading-none">{date.getDate()}</strong>
        <span className="mt-0.5 text-[10px]">{["日", "月", "火", "水", "木", "金", "土"][date.getDay()]}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 font-black leading-snug text-zinc-900">{post.title}</h3>
          <ChevronRight className="mt-0.5 size-4 shrink-0 text-zinc-300 transition group-hover:translate-x-0.5" />
        </div>
        <p className="mt-2 text-sm font-semibold text-zinc-700">
          {formatTime(post.start_time)}〜{formatTime(post.end_time)}
        </p>
        <p className="mt-1 flex items-center gap-1.5 truncate text-sm text-zinc-600">
          <MapPin className="size-3.5 shrink-0 text-zinc-400" />
          {post.venue}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-md bg-zinc-100 px-2 py-1 font-semibold text-zinc-700">{post.level || "レベル不問"}</span>
          <span className={`font-black ${full ? "text-zinc-500" : "text-primary"}`}>
            {full ? "満員・終了" : `あと${remaining(post)}名`}
          </span>
          <span className="ml-auto text-zinc-500">主催：{post.organizer}さん</span>
        </div>
        <div className="mt-3">
          <div className="mb-1 flex justify-between text-[10px] text-zinc-400">
            <span>{post.participant_count}名参加</span>
            <span>定員{post.capacity}名</span>
          </div>
          <Progress value={Math.min(100, (post.participant_count / post.capacity) * 100)} />
        </div>
      </div>
    </button>
  );
}

function MemberPostCard({ post, onOpen }: { post: Post; onOpen: (p: Post) => void }) {
  return (
    <article className="rounded-xl border border-zinc-200 bg-white p-4">
      <div className="flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#f4e7e1] font-black text-[#a44d55]">
          {post.organizer.slice(0, 1)}
        </span>
        <div className="min-w-0">
          <p className="font-bold text-zinc-900">{post.organizer}さん</p>
          <p className="truncate text-xs text-zinc-500">{post.secondary_title || formatDate(post.held_on)}</p>
        </div>
      </div>
      <button onClick={() => onOpen(post)} className="mt-3 w-full text-left">
        <p className="text-[1.05rem] font-bold leading-7 text-zinc-800">「{post.title}」</p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-zinc-600">
          <span className="rounded-md bg-pink-50 px-2 py-1 text-primary">{post.category}</span>
          <span className="rounded-md bg-zinc-100 px-2 py-1">{post.level}</span>
          <span className="rounded-md bg-zinc-100 px-2 py-1">{post.prefecture.replace(/[都道府県]$/, "")}</span>
        </div>
        <span className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-primary">
          詳細を見る <ChevronRight className="size-4" />
        </span>
      </button>
    </article>
  );
}

function EventPostCard({ post, onOpen }: { post: Post; onOpen: (p: Post) => void }) {
  const date = new Date(`${post.held_on}T00:00:00`);
  return (
    <button
      onClick={() => onOpen(post)}
      className="group flex w-full overflow-hidden rounded-xl border border-zinc-200 bg-white text-left transition hover:border-[#d86d75]"
    >
      <div className="flex w-[4.5rem] shrink-0 flex-col items-center justify-center bg-[#d86d75] px-2 text-white">
        <span className="text-xs font-bold">{date.getMonth() + 1}月</span>
        <strong className="text-3xl leading-none">{date.getDate()}</strong>
        <span className="mt-1 text-[10px]">{["日", "月", "火", "水", "木", "金", "土"][date.getDay()]}曜日</span>
      </div>
      <div className="min-w-0 flex-1 p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-black text-primary">{post.category || "イベント"}</span>
          <ChevronRight className="size-4 shrink-0 text-zinc-300 transition group-hover:translate-x-0.5" />
        </div>
        <h3 className="mt-1 line-clamp-2 font-black leading-snug text-zinc-900">{post.title}</h3>
        <p className="mt-2 text-sm text-zinc-600">{formatTime(post.start_time)}〜{formatTime(post.end_time)}</p>
        <p className="mt-1 truncate text-sm text-zinc-500">{post.venue}</p>
        <p className="mt-2 text-xs text-zinc-400">主催：{post.organizer}</p>
      </div>
    </button>
  );
}

function DetailDialog({
  post,
  onClose,
  onParticipate,
}: {
  post: Post | null;
  onClose: () => void;
  onParticipate: (p: Post) => void;
}) {
  if (!post) return null;
  const full = post.status === "closed" || post.participant_count >= post.capacity;
  const action = post.viewer_joined
    ? post.type === "member" ? "参加希望をキャンセル" : "参加をキャンセル"
    : post.type === "member" ? "参加希望" : "参加する";
  return (
    <Dialog open={!!post} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-xl border-zinc-200 sm:max-w-lg">
        <DialogHeader>
          <div className="mb-2 flex gap-2">
            <Badge>{labels[post.type]}</Badge>
            <Badge variant="secondary">{post.category || post.level}</Badge>
          </div>
          <DialogTitle className="text-xl font-black leading-snug">{post.title}</DialogTitle>
          <DialogDescription>
            {post.secondary_title || `${post.organizer}さんの募集`}
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 rounded-lg border border-zinc-200 bg-[#fbfaf8] p-4 text-sm">
          <p>
            <CalendarDays className="mb-1 size-4 text-primary" />
            {formatDate(post.held_on)}
          </p>
          <p>
            <Clock3 className="mb-1 size-4 text-primary" />
            {post.start_time ? `${post.start_time}〜${post.end_time}` : "時間は主催者に確認"}
          </p>
          <p>
            <MapPin className="mb-1 size-4 text-primary" />
            {post.prefecture}
            <br />
            {post.venue}
          </p>
          <p>
            <WalletCards className="mb-1 size-4 text-primary" />
            {post.fee ? `${post.fee.toLocaleString()}円` : "無料・要確認"}
          </p>
        </div>
        <div>
          <h4 className="font-black">募集内容</h4>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-zinc-600">
            {post.description}
          </p>
        </div>
        {post.application_method && (
          <div>
            <h4 className="font-black">申込方法</h4>
            <p className="mt-1 text-sm text-zinc-600">{post.application_method}</p>
          </div>
        )}
        <p className="text-sm text-zinc-500">主催：{post.organizer}</p>
        {post.is_demo && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">開発環境だけに表示されるサンプル募集です。</p>
        )}
        <div className="sticky bottom-0 -mx-4 -mb-4 flex items-center gap-4 border-t border-zinc-200 bg-white p-4">
          <div className="min-w-20 text-sm">
            <strong className="text-lg">{post.participant_count}</strong> / {post.capacity}人
          </div>
          <Button
            disabled={!!post.is_demo || (full && !post.viewer_joined)}
            onClick={() => onParticipate(post)}
            variant={post.viewer_joined ? "outline" : "default"}
            className="h-12 flex-1 rounded-lg font-bold"
          >
            {post.is_demo ? "開発用サンプル" : full && !post.viewer_joined ? "満員" : action}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CreateScreen({
  type,
  initial,
  setType,
  onBack,
  onCreated,
}: {
  type: PostType | null;
  initial: Post | null;
  setType: (v: PostType | null) => void;
  onBack: () => void;
  onCreated: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const value = (key: string) => {
    if (!initial) return "";
    const values: Record<string, string | number> = {
      tournamentName: initial.secondary_title,
      title: initial.title,
      heldOn: initial.held_on,
      deadline: initial.deadline,
      startTime: initial.start_time,
      endTime: initial.end_time,
      prefecture: initial.prefecture,
      venue: initial.venue,
      capacity: initial.capacity,
      fee: initial.fee,
      category: initial.category,
      level: initial.level,
      description: initial.description,
      organizer: initial.organizer,
      applicationMethod: initial.application_method,
    };
    return values[key] ?? "";
  };
  if (!type)
    return (
      <>
        <button onClick={onBack} className="text-sm font-bold text-muted-foreground">
          ← 戻る
        </button>
        <h1 className="mt-5 text-2xl font-black">何を募集しますか？</h1>
        <p className="mt-2 text-muted-foreground">投稿したい内容を選んでください。</p>
        <div className="mt-6 grid gap-3 md:grid-cols-3">
          {(
            [
              {
                type: "practice",
                icon: Dumbbell,
                title: "練習会を募集",
                text: "一緒に練習する仲間を集める",
              },
              {
                type: "member",
                icon: UsersRound,
                title: "大会メンバーを募集",
                text: "ペアやチームメンバーを探す",
              },
              {
                type: "event",
                icon: Trophy,
                title: "大会／イベントを掲載",
                text: "大会・交流会・体験会を告知する",
              },
            ] as const
          ).map((item) => (
            <button
              key={item.type}
              onClick={() => setType(item.type)}
              className="group flex items-center gap-4 rounded-xl border border-zinc-200 bg-white p-4 text-left transition hover:border-pink-300 hover:bg-pink-50/20 md:block"
            >
              <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-pink-50 text-primary">
                <item.icon className="size-5" />
              </span>
              <div className="min-w-0 flex-1 md:mt-4">
                <h2 className="font-black">{item.title}</h2>
                <p className="mt-1 text-sm text-zinc-500">{item.text}</p>
              </div>
              <ChevronRight className="size-4 text-zinc-300 md:hidden" />
            </button>
          ))}
        </div>
      </>
    );
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const body = Object.fromEntries(new FormData(event.currentTarget));
    try {
      await readJson(
        await fetch("/api/posts", {
          method: initial ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...body,
            type,
            id: initial?.id,
            action: initial ? "edit" : undefined,
          }),
        }),
      );
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "投稿に失敗しました");
    } finally {
      setSaving(false);
    }
  }
  return (
    <>
      <button
        onClick={() => (initial ? onBack() : setType(null))}
        className="text-sm font-bold text-muted-foreground"
      >
        ← {initial ? "マイページへ" : "種類を選び直す"}
      </button>
      <div className="mt-5">
        <Badge>{labels[type]}</Badge>
        <h1 className="mt-3 text-2xl font-black">{initial ? "募集を編集" : "募集内容を入力"}</h1>
      </div>
      <form
        onSubmit={submit}
        className="mt-6 space-y-6 rounded-xl border border-zinc-200 bg-white p-5 md:p-8"
      >
        {type === "member" && (
          <Field
            label="大会名"
            name="tournamentName"
            placeholder="例：関東オープン2026"
            defaultValue={value("tournamentName")}
          />
        )}
        <Field
          label={type === "event" ? "イベント名" : "募集タイトル"}
          name="title"
          placeholder={
            type === "practice" ? "例：土曜の朝活ピックルボール" : "わかりやすいタイトル"
          }
          defaultValue={value("title")}
        />
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="開催日" name="heldOn" type="date" defaultValue={value("heldOn")} />
          {type === "member" ? (
            <Field label="募集期限" name="deadline" type="date" defaultValue={value("deadline")} />
          ) : (
            <>
              <Field
                label="開始時間"
                name="startTime"
                type="time"
                defaultValue={value("startTime")}
              />
              <Field label="終了時間" name="endTime" type="time" defaultValue={value("endTime")} />
            </>
          )}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <SelectField
            label="都道府県"
            name="prefecture"
            options={prefectures}
            defaultValue={value("prefecture")}
          />
          <Field
            label="開催場所"
            name="venue"
            placeholder="体育館・施設名"
            defaultValue={value("venue")}
          />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Field
            label={type === "member" ? "募集人数" : "定員"}
            name="capacity"
            type="number"
            placeholder="8"
            defaultValue={value("capacity")}
          />
          {type !== "member" && (
            <Field
              label="参加費（円）"
              name="fee"
              type="number"
              placeholder="0"
              defaultValue={value("fee")}
            />
          )}
        </div>
        {type === "event" ? (
          <SelectField
            label="イベント種類"
            name="category"
            options={eventOptions}
            defaultValue={value("category")}
          />
        ) : type === "member" ? (
          <>
            <SelectField
              label="カテゴリー"
              name="category"
              options={categoryOptions}
              defaultValue={value("category")}
            />
            <SelectField
              label="希望レベル"
              name="level"
              options={levelOptions}
              defaultValue={value("level")}
            />
          </>
        ) : (
          <SelectField
            label="対象レベル"
            name="level"
            options={levelOptions}
            defaultValue={value("level")}
          />
        )}
        <label className="block">
          <span className="mb-2 block text-sm font-bold">募集内容</span>
          <Textarea
            name="description"
            required
            rows={6}
            placeholder="参加者に伝えたい内容、持ち物、注意事項など"
            className="rounded-lg"
            defaultValue={value("description")}
          />
        </label>
        <Field
          label={type === "practice" ? "主催者名" : type === "member" ? "投稿者名" : "主催者"}
          name="organizer"
          placeholder="表示する名前"
          defaultValue={value("organizer")}
        />
        {type === "event" && (
          <Field
            label="申込方法"
            name="applicationMethod"
            placeholder="例：このページの参加ボタンから申込"
            defaultValue={value("applicationMethod")}
          />
        )}{" "}
        {error && (
          <p className="rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">
            {error}
            {error.includes("ログイン") && (
              <>
                {" "}
                —{" "}
                <a href="/login" className="underline">
                  ログインする
                </a>
              </>
            )}
          </p>
        )}
        <Button disabled={saving} className="h-12 w-full rounded-lg text-base font-bold">
          {saving ? "保存中…" : initial ? "変更を保存" : "この内容で投稿する"}
        </Button>
      </form>
    </>
  );
}

function Field({
  label,
  name,
  type = "text",
  placeholder,
  defaultValue,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  defaultValue?: string | number;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold">{label}</span>
      <Input
        name={name}
        type={type}
        placeholder={placeholder}
        defaultValue={defaultValue}
        required
        className="h-11 rounded-lg"
        min={type === "number" ? "0" : undefined}
      />
    </label>
  );
}
function SelectField({
  label,
  name,
  options,
  defaultValue,
  required = true,
}: {
  label: string;
  name: string;
  options: string[];
  defaultValue?: string | number;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold">{label}</span>
      <NativeSelect name={name} required={required} className="w-full" defaultValue={defaultValue}>
        <NativeSelectOption value="">選択してください</NativeSelectOption>
        {options.map((x) => (
          <NativeSelectOption key={x}>{x}</NativeSelectOption>
        ))}
      </NativeSelect>
    </label>
  );
}

function MyPage({
  me,
  mine,
  joined,
  onOpen,
  onEdit,
  onManage,
  onAdmin,
  onProfileSaved,
}: {
  me: Me;
  mine: Post[];
  joined: Post[];
  onOpen: (p: Post) => void;
  onEdit: (p: Post) => void;
  onManage: (p: Post, a: "close" | "delete") => void;
  onAdmin: () => void;
  onProfileSaved: (user: UserProfile) => void;
}) {
  if (!me.signedIn)
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-zinc-200 bg-white p-7 text-center">
        <span className="mx-auto grid size-16 place-items-center rounded-full bg-pink-50 text-primary">
          <UserRound className="size-8" />
        </span>
        <h1 className="mt-5 text-2xl font-black">マイページにログイン</h1>
        <p className="mt-2 text-sm text-muted-foreground">投稿や参加予定をまとめて確認できます。</p>
        <Button
          className="mt-6 h-11 rounded-full px-7"
          render={<a href="/login" />}
        >
          ログインする
        </Button>
      </div>
    );
  return (
    <>
      <div className="rounded-xl border border-zinc-200 bg-white p-5">
        <div className="flex items-center gap-4">
          <span className="grid size-16 place-items-center rounded-full bg-primary text-2xl font-black text-white">
            {me.user?.display_name?.slice(0, 1)}
          </span>
          <div>
            <h1 className="text-2xl font-black">{me.user?.display_name}</h1>
            <p className="text-sm text-muted-foreground">
              {me.user?.prefecture || "地域未設定"}・{me.user?.level || "レベル未設定"}
            </p>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <ProfileEditor me={me} onSaved={onProfileSaved} />
          {me.user?.role === "admin" && (
            <Button onClick={onAdmin} variant="secondary" className="rounded-full">
              管理者画面
            </Button>
          )}
          <Button
            variant="ghost"
            className="ml-auto"
            render={<a href="/auth/signout" />}
          >
            ログアウト
          </Button>
        </div>
      </div>
      <section className="mt-8">
        <h2 className="mb-4 text-xl font-black">自分が投稿した募集</h2>
        {mine.length ? (
          <div className="space-y-3">
            {mine.map((post) => (
              <div key={post.id} className="rounded-xl border border-zinc-200 bg-white p-4">
                <button onClick={() => onOpen(post)} className="w-full text-left">
                  <Badge variant="secondary">{labels[post.type]}</Badge>
                  <h3 className="mt-2 font-black">{post.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {formatDate(post.held_on)}・{post.venue}
                  </p>
                </button>
                <div className="mt-3 flex gap-2 border-t pt-3">
                  <Button onClick={() => onEdit(post)} variant="outline" size="sm">
                    編集
                  </Button>
                  <Button onClick={() => onManage(post, "close")} variant="secondary" size="sm">
                    募集終了
                  </Button>
                  <Button onClick={() => onManage(post, "delete")} variant="destructive" size="sm">
                    削除
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Empty text="投稿した募集はまだありません" />
        )}
      </section>
      <section className="mt-8">
        <h2 className="mb-4 text-xl font-black">参加・参加希望の予定</h2>
        {joined.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {joined.map((p) => (
              <PostCard key={p.id} post={p} onOpen={onOpen} />
            ))}
          </div>
        ) : (
          <Empty text="参加予定はまだありません" />
        )}
      </section>
    </>
  );
}

function ProfileEditor({ me, onSaved }: { me: Me; onSaved: (user: UserProfile) => void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const body = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const data = await readJson(
        await fetch("/api/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
      );
      onSaved(data.user as UserProfile);
      setOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "プロフィールを保存できませんでした");
    } finally {
      setSaving(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button onClick={() => setOpen(true)} variant="outline" className="rounded-full">
        プロフィール編集
      </Button>
      <DialogContent className="rounded-xl">
        <DialogHeader>
          <DialogTitle>プロフィール編集</DialogTitle>
          <DialogDescription>募集や参加者に表示する情報です。</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <Field label="表示名" name="displayName" defaultValue={me.user?.display_name} />
          <SelectField
            label="都道府県"
            name="prefecture"
            options={prefectures}
            defaultValue={me.user?.prefecture}
            required={false}
          />
          <SelectField
            label="レベル"
            name="level"
            options={levelOptions}
            defaultValue={me.user?.level}
            required={false}
          />
          {error && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
              {error}
            </p>
          )}
          <Button type="submit" disabled={saving} className="h-11 w-full">
            {saving ? "保存中…" : "保存する"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-7 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}

function AdminPage({
  onBack,
  onOpen,
  onManage,
}: {
  onBack: () => void;
  onOpen: (p: Post) => void;
  onManage: (p: Post, a: "close" | "delete") => void;
}) {
  const [data, setData] = useState<{
    users?: Array<{ id: string; email: string; display_name: string; role: string }>;
    counts?: Record<string, number>;
    error?: string;
  }>({});
  const [allPosts, setAllPosts] = useState<Post[]>([]);
  useEffect(() => {
    Promise.all([fetch("/api/admin").then(readJson), fetch("/api/posts").then(readJson)])
      .then(([value, posts]) => {
        setData(value as typeof data);
        setAllPosts(posts.posts as Post[]);
      })
      .catch((error) => setData({ error: error.message }));
  }, []);
  const countLabels: Record<string, string> = {
    practices: "練習会",
    members: "メンバー募集",
    events: "イベント",
    users: "ユーザー",
  };
  return (
    <>
      <button onClick={onBack} className="text-sm font-bold text-muted-foreground">
        ← マイページへ
      </button>
      <h1 className="mt-5 text-3xl font-black">管理者画面</h1>
      {data.error ? (
        <p className="mt-6 rounded-2xl bg-red-50 p-5 font-bold text-red-700">{data.error}</p>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            {Object.entries(data.counts ?? {}).map(([key, value]) => (
              <div key={key} className="rounded-xl border border-zinc-200 bg-white p-5">
                <strong className="text-2xl">{value}</strong>
                <p className="text-sm text-muted-foreground">{countLabels[key]}</p>
              </div>
            ))}
          </div>
          <section className="mt-8 rounded-xl border border-zinc-200 bg-white p-5">
            <h2 className="text-xl font-black">投稿・イベント管理</h2>
            <div className="mt-4 divide-y">
              {allPosts.map((post) => (
                <div key={`${post.type}-${post.id}`} className="py-4">
                  <button onClick={() => onOpen(post)} className="w-full text-left">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{labels[post.type]}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(post.held_on)}
                      </span>
                    </div>
                    <p className="mt-2 font-bold">{post.title}</p>
                  </button>
                  <div className="mt-3 flex gap-2">
                    <Button onClick={() => onManage(post, "close")} variant="secondary" size="sm">
                      募集終了
                    </Button>
                    <Button
                      onClick={() => onManage(post, "delete")}
                      variant="destructive"
                      size="sm"
                    >
                      不適切として削除
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </section>
          <section className="mt-8 rounded-xl border border-zinc-200 bg-white p-5">
            <h2 className="text-xl font-black">ユーザー確認</h2>
            <div className="mt-4 divide-y">
              {data.users?.map((user) => (
                <div key={user.id} className="flex items-center justify-between gap-3 py-3">
                  <div>
                    <p className="font-bold">{user.display_name}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </div>
                  <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                    {user.role}
                  </Badge>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </>
  );
}
