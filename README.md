# みんなでピックル！！

ピックルボールの練習会、大会メンバー、イベントを探して参加できるモバイル中心のコミュニティアプリです。

## 技術構成

- Next.js 16 / React 19 / TypeScript
- Tailwind CSS / shadcn UI
- Supabase Auth（メール・パスワード、Google）
- Supabase PostgreSQL + Row Level Security
- Vercel対応

## Supabaseの準備

1. Supabaseで新しいプロジェクトを作成します。
2. SQL Editorで `supabase/migrations/202609050001_initial_schema.sql` を実行します。
3. Authenticationでメール認証を有効にします。
4. Googleログインを使う場合は、Authentication > ProvidersでGoogleを有効にします。
5. Project URLとPublishable keyを `.env.local` に設定します。

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

最初に登録されたユーザーには管理者権限が設定されます。

## ローカル起動

```bash
npm install
npm run dev
```

## Vercelへの公開

GitHubリポジトリをVercelへインポートし、上記2つの環境変数を設定します。Supabase AuthenticationのRedirect URLsには、VercelのURLと `/auth/callback` を追加してください。

## セキュリティ

投稿・プロフィール・参加情報の更新権限はPostgreSQLのRLSで制御しています。秘密鍵やデータベースパスワードはソースコードへ保存しません。
