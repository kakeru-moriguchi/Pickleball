import Link from "next/link";

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#fbfaf8] px-4 py-10 text-zinc-800">
      <article className="mx-auto max-w-2xl rounded-xl border border-zinc-200 bg-white p-6 md:p-10">
        <Link href="/" className="text-sm font-bold text-primary">← みんなでピックル！！へ戻る</Link>
        <h1 className="mt-6 text-2xl font-black">利用規約</h1>
        <p className="mt-2 text-sm text-zinc-500">制定日：2026年9月8日</p>
        <div className="mt-8 space-y-7 text-sm leading-7">
          <section>
            <h2 className="text-base font-bold">サービスについて</h2>
            <p className="mt-2">みんなでピックル！！は、ピックルボールの練習会、競技メンバーおよびイベントを募集・検索し、参加できるコミュニティサービスです。</p>
          </section>
          <section>
            <h2 className="text-base font-bold">アカウント</h2>
            <p className="mt-2">利用者は正確な情報を登録し、アカウントを適切に管理してください。アカウントを第三者へ貸与または譲渡することはできません。</p>
          </section>
          <section>
            <h2 className="text-base font-bold">投稿と参加</h2>
            <p className="mt-2">投稿者は募集内容、日時、場所、参加費などを正確に記載してください。参加者と主催者の間で発生する連絡、費用の支払い、事故やトラブルについては、当事者間で解決するものとします。</p>
          </section>
          <section>
            <h2 className="text-base font-bold">禁止事項</h2>
            <p className="mt-2">法令違反、虚偽情報、他者への迷惑行為、差別・誹謗中傷、営利目的の無断広告、不正アクセス、サービス運営を妨害する行為を禁止します。</p>
          </section>
          <section>
            <h2 className="text-base font-bold">投稿の管理</h2>
            <p className="mt-2">不適切な投稿や利用規約に反する投稿は、事前の通知なく非表示または削除する場合があります。</p>
          </section>
          <section>
            <h2 className="text-base font-bold">サービスの変更・停止</h2>
            <p className="mt-2">保守、障害、運営上の都合などにより、サービスの内容を変更または一時停止する場合があります。</p>
          </section>
          <section>
            <h2 className="text-base font-bold">お問い合わせ</h2>
            <p className="mt-2">本規約に関するお問い合わせは、<a className="font-bold text-primary underline" href="mailto:kakeru.moriguchi0505@gmail.com">kakeru.moriguchi0505@gmail.com</a> までご連絡ください。</p>
          </section>
        </div>
      </article>
    </main>
  );
}
