import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://pickleball-omega-ruby.vercel.app'),
  title: 'Pickle Link｜宮崎でピックルボールしよう',
  description: 'ピックルボールでつながる。宮崎の練習会・大会メンバー・イベントを探せる地域コミュニティ。',
  openGraph: {
    title: 'Pickle Link',
    description: 'ピックルボールでつながる。宮崎の練習会・大会メンバー・イベントを探そう。',
    type: 'website',
    locale: 'ja_JP',
    siteName: 'Pickle Link',
  },
  twitter: {
    card: 'summary',
    title: 'Pickle Link',
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
