"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email"));
    const password = String(data.get("password"));
    const supabase = createClient();
    const result =
      mode === "login"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });
    if (result.error) setMessage(result.error.message);
    else if (mode === "signup" && !result.data.session)
      setMessage("確認メールを送りました。メール内のリンクを開いてください。");
    else window.location.href = "/";
    setLoading(false);
  }
  async function google() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=/` },
    });
  }
  return (
    <main className="grid min-h-screen place-items-center px-4">
      <section className="w-full max-w-md rounded-[2rem] border border-pink-100 bg-white p-7 shadow-xl shadow-pink-100/60">
        <Link href="/" className="flex items-center gap-2 font-black">
          <span className="grid size-10 place-items-center rounded-2xl bg-primary text-white">
            <Sparkles className="size-5" />
          </span>
          Pickle Link
        </Link>
        <h1 className="mt-8 text-2xl font-black">
          {mode === "login" ? "ログイン" : "アカウントを作成"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          投稿や参加予定をあなたのアカウントに保存します。
        </p>
        <Button onClick={google} variant="outline" className="mt-6 h-11 w-full rounded-xl">
          Googleで続ける
        </Button>
        <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          または
          <span className="h-px flex-1 bg-border" />
        </div>
        <form onSubmit={submit} className="space-y-4">
          <label className="block">
            <span className="mb-2 block text-sm font-bold">メールアドレス</span>
            <Input name="email" type="email" required className="h-11 rounded-xl" />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-bold">パスワード</span>
            <Input
              name="password"
              type="password"
              required
              minLength={8}
              className="h-11 rounded-xl"
            />
          </label>
          {message && <p className="rounded-xl bg-pink-50 p-3 text-sm text-zinc-700">{message}</p>}
          <Button disabled={loading} className="h-11 w-full rounded-xl font-bold">
            {loading ? "処理中…" : mode === "login" ? "ログイン" : "登録する"}
          </Button>
        </form>
        <button
          onClick={() => {
            setMode(mode === "login" ? "signup" : "login");
            setMessage("");
          }}
          className="mt-5 w-full text-sm font-bold text-primary"
        >
          {mode === "login" ? "はじめての方はこちら" : "すでにアカウントをお持ちの方"}
        </button>
      </section>
    </main>
  );
}
