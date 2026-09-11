"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [accepted, setAccepted] = useState(false);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("error")) {
      setMessage("ログインを完了できませんでした。もう一度お試しください。");
    }
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accepted) {
      setMessage("利用規約とプライバシーポリシーへの同意が必要です。");
      return;
    }
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
    if (!accepted) {
      setMessage("利用規約とプライバシーポリシーへの同意が必要です。");
      return;
    }
    setGoogleLoading(true);
    setMessage("");
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback`, skipBrowserRedirect: true },
      });
      if (error || !data.url) throw error ?? new Error("Missing authorization URL");
      window.location.assign(data.url);
    } catch {
      setMessage("Googleログインを開始できませんでした。時間をおいてもう一度お試しください。");
      setGoogleLoading(false);
    }
  }
  return (
    <main className="grid min-h-screen place-items-center bg-[#fbfaf8] px-4 py-8">
      <section className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 md:p-8">
        <Link href="/" className="font-black">
          みんなでピックル！！
        </Link>
        <h1 className="mt-8 text-2xl font-black">
          {mode === "login" ? "ログイン" : "アカウントを作成"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          投稿や参加予定をあなたのアカウントに保存します。
        </p>
        <label className="mt-6 flex items-start gap-3 rounded-lg bg-zinc-50 p-3 text-xs leading-5 text-zinc-600">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(event) => setAccepted(event.target.checked)}
            className="mt-0.5 size-4 accent-pink-600"
          />
          <span>
            <Link href="/terms" className="underline">利用規約</Link>と
            <Link href="/privacy" className="underline">プライバシーポリシー</Link>に同意します。
          </span>
        </label>
        <Button onClick={google} disabled={loading || googleLoading || !accepted} variant="outline" className="mt-4 h-11 w-full rounded-lg border-zinc-300">
          {googleLoading ? "Googleへ移動しています…" : "Googleアカウントで続ける"}
        </Button>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">はじめての方はアカウントが作成され、登録済みの方はログインできます。</p>
        {message && <p role="alert" className="mt-4 rounded-lg bg-pink-50 p-3 text-sm text-zinc-700">{message}</p>}
        <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          または
          <span className="h-px flex-1 bg-border" />
        </div>
        <form onSubmit={submit} className="space-y-4">
          <label className="block">
            <span className="mb-2 block text-sm font-bold">メールアドレス</span>
            <Input name="email" type="email" required className="h-11 rounded-lg" />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-bold">パスワード</span>
            <Input
              name="password"
              type="password"
              required
              minLength={8}
              className="h-11 rounded-lg"
            />
          </label>
          <Button type="submit" disabled={loading || googleLoading || !accepted} className="h-11 w-full rounded-lg font-bold">
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
