import type { Metadata } from 'next';
import { Noto_Sans_JP } from 'next/font/google';
import './globals.css';

const noto = Noto_Sans_JP({ variable: '--font-noto', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Pickle Link｜ピックルボール仲間を見つけよう',
  description: '練習会・大会メンバー・イベントを探して参加できる、ピックルボールのコミュニティアプリ。',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body className={`${noto.variable} antialiased`}>{children}</body>
    </html>
  );
}
