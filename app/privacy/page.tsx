import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#fbfaf8] px-4 py-10 text-zinc-800">
      <article className="mx-auto max-w-2xl rounded-xl border border-zinc-200 bg-white p-6 md:p-10">
        <Link href="/" className="text-sm font-bold text-primary">← みんなでピックル！！へ戻る</Link>
        <h1 className="mt-6 text-2xl font-black">プライバシーポリシー</h1>
        <p className="mt-2 text-sm text-zinc-500">制定日：2026年9月8日</p>
        <div className="mt-8 space-y-7 text-sm leading-7">
          <section>
            <h2 className="text-base font-bold">取得する情報</h2>
            <p className="mt-2">みんなでピックル！！は、アカウント登録時のメールアドレス、表示名、都道府県、競技レベル、ユーザーが投稿した募集内容および参加情報を取得します。参加・応募時には、氏名、レベル、参加人数、パドル・ネット・ボールの有無を取得します。Googleログインを利用した場合は、Googleから提供される氏名、メールアドレスなどの基本プロフィール情報を取得します。</p>
            <p className="mt-2">アカウントなしでの応募とキャンセルを同じ端末で識別するため、推測困難なランダム識別子をブラウザのCookieに保存します。この識別子は広告目的には利用しません。</p>
          </section>
          <section>
            <h2 className="text-base font-bold">利用目的</h2>
            <p className="mt-2">本人確認、ログイン状態の維持、募集の投稿・参加・管理、地域に応じた情報表示、不正利用の防止、サービス改善およびお問い合わせ対応のために利用します。</p>
          </section>
          <section>
            <h2 className="text-base font-bold">外部サービス</h2>
            <p className="mt-2">認証とデータ保存にSupabase、アプリの配信にVercel、GoogleログインにGoogle OAuthを利用します。各サービスでは、それぞれのプライバシーポリシーに従って情報が取り扱われます。</p>
          </section>
          <section>
            <h2 className="text-base font-bold">第三者提供</h2>
            <p className="mt-2">法令に基づく場合を除き、本人の同意なく個人情報を第三者へ販売または提供しません。サービス運営に必要な範囲で、上記の外部サービスへ情報を送信します。</p>
          </section>
          <section>
            <h2 className="text-base font-bold">削除・お問い合わせ</h2>
            <p className="mt-2">登録情報の確認・修正はマイページから行えます。アカウントや関連データの削除については、<a className="font-bold text-primary underline" href="mailto:kakeru.moriguchi0505@gmail.com">kakeru.moriguchi0505@gmail.com</a> までご連絡ください。</p>
          </section>
          <section>
            <h2 className="text-base font-bold">改定</h2>
            <p className="mt-2">サービス内容や法令の変更に応じて本ポリシーを改定することがあります。重要な変更はアプリ上でお知らせします。</p>
          </section>
        </div>
      </article>
    </main>
  );
}
