import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://pickleball-omega-ruby.vercel.app'),
  title: 'みんなでピックル！！｜ピックルボール仲間を見つけよう',
  description: '練習会・大会メンバー・イベントを探して参加できる、ピックルボールのコミュニティアプリ。',
  openGraph: {
    title: 'みんなでピックル！！',
    description: '近くの練習会・大会メンバー・イベントを見つけよう。',
    type: 'website',
    locale: 'ja_JP',
    siteName: 'みんなでピックル！！',
  },
  twitter: {
    card: 'summary',
    title: 'みんなでピックル！！',
    description: '近くの練習会・大会メンバー・イベントを見つけよう。',
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body className="antialiased">{children}</body>
    </html>
  );
}
