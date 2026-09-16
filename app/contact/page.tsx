"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export default function ContactPage() {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    const body = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "送信できませんでした");
      setSent(true);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "送信できませんでした");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#fbfaf8] px-4 py-10 text-zinc-800">
      <section className="mx-auto max-w-lg rounded-xl border border-zinc-200 bg-white p-6 md:p-8">
        <Link href="/" className="text-sm font-bold text-primary">← みんなでピックル！！へ戻る</Link>
        <h1 className="mt-6 text-2xl font-black">お問い合わせ</h1>
        <p className="mt-2 text-sm leading-6 text-zinc-500">不具合、ご意見、運営へのご相談はこちらからお送りください。</p>
        {sent ? (
          <div className="mt-8 rounded-xl bg-pink-50 p-5">
            <h2 className="font-black">送信しました</h2>
            <p className="mt-2 text-sm text-zinc-600">管理者が内容を確認します。</p>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-8 space-y-5">
            <label className="block">
              <span className="mb-2 block text-sm font-bold">お名前</span>
              <Input name="name" required maxLength={80} className="h-11 rounded-lg" />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-bold">返信用メールアドレス</span>
              <Input name="email" type="email" required maxLength={200} className="h-11 rounded-lg" />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-bold">お問い合わせ内容</span>
              <Textarea name="message" required maxLength={2000} rows={7} className="rounded-lg" />
            </label>
            <p className="text-xs leading-5 text-zinc-500">
              送信すると<Link href="/privacy" className="underline">プライバシーポリシー</Link>に同意したものとみなします。
            </p>
            {message && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{message}</p>}
            <Button type="submit" disabled={saving} className="h-11 w-full font-bold">
              {saving ? "送信中…" : "お問い合わせを送信"}
            </Button>
          </form>
        )}
      </section>
    </main>
  );
}
