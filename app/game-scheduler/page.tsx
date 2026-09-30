import type { Metadata } from "next";
import { GameScheduler } from "@/components/game-scheduler";

export const metadata: Metadata = {
  title: "ゲーム進行｜みんなでピックル！！",
  description: "出場・休憩・ペア・対戦相手の偏りを抑えたピックルボール練習会のゲーム進行表。",
};

export default function GameSchedulerPage() {
  return <GameScheduler />;
}
