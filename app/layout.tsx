import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Pickle Link｜ピックルボール仲間を見つけよう',
  description: '練習会・大会メンバー・イベントを探して参加できる、ピックルボールのコミュニティアプリ。',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body className="antialiased">{children}</body>
    </html>
  );
}
