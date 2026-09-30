"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowRight, ChevronLeft, RotateCcw, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  calculateFairness,
  calculateStats,
  generateRounds,
  swapPlayersInRound,
  type SchedulerParticipant,
  type SchedulerRound,
} from "@/lib/game-scheduler";

type Session = {
  version: 1;
  participants: SchedulerParticipant[];
  rounds: SchedulerRound[];
  currentIndex: number;
  plannedRounds: number;
  courtCount: number;
};

type View = "progress" | "schedule" | "stats";
const STORAGE_KEY = "pickle-link-game-scheduler-v1";

function loadSession(): Session | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Session;
    return parsed.version === 1 && Array.isArray(parsed.participants) && Array.isArray(parsed.rounds)
      ? parsed
      : null;
  } catch {
    return null;
  }
}

export function GameScheduler() {
  const [session, setSession] = useState<Session | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [names, setNames] = useState("");
  const [courtCount, setCourtCount] = useState(1);
  const [roundCount, setRoundCount] = useState(8);
  const [view, setView] = useState<View>("progress");
  const [error, setError] = useState("");
  const [generating, setGenerating] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [newParticipant, setNewParticipant] = useState("");
  const [nextCourtCount, setNextCourtCount] = useState(1);

  useEffect(() => {
    const saved = loadSession();
    if (saved) {
      setSession(saved);
      setNextCourtCount(saved.courtCount);
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded || !session) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  }, [loaded, session]);

  const nameMap = useMemo(
    () => new Map(session?.participants.map((participant) => [participant.id, participant.name]) ?? []),
    [session?.participants],
  );
  const stats = useMemo(
    () => (session ? calculateStats(session.rounds, session.participants) : {}),
    [session],
  );
  const fairness = useMemo(
    () => (session ? calculateFairness(session.rounds, session.participants) : null),
    [session],
  );

  async function createSchedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setGenerating(true);
    setError("");
    await new Promise((resolve) => window.setTimeout(resolve, 20));
    try {
      const participantNames = names
        .split(/\r?\n|,/)
        .map((name) => name.trim())
        .filter(Boolean);
      if (participantNames.length < 4) throw new Error("参加者名を4人以上入力してください");
      if (new Set(participantNames).size !== participantNames.length)
        throw new Error("同じ参加者名が重複しています");
      const participants = participantNames.map((name, index) => ({
        id: `player-${index + 1}`,
        name,
        active: true,
      }));
      const rounds = generateRounds(participants, courtCount, roundCount);
      setSession({ version: 1, participants, rounds, currentIndex: 0, plannedRounds: roundCount, courtCount });
      setNextCourtCount(courtCount);
      setView("progress");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "進行表を作成できませんでした");
    } finally {
      setGenerating(false);
    }
  }

  function regenerateFuture(nextParticipants: SchedulerParticipant[], courts: number, currentSession = session) {
    if (!currentSession) return;
    const history = currentSession.rounds.slice(0, currentSession.currentIndex + 1);
    const remaining = Math.max(0, currentSession.plannedRounds - history.length);
    const future = remaining ? generateRounds(nextParticipants, courts, remaining, history) : [];
    setSession({ ...currentSession, participants: nextParticipants, courtCount: courts, rounds: [...history, ...future] });
  }

  function addParticipant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) return;
    const name = newParticipant.trim();
    if (!name) return;
    if (session.participants.some((participant) => participant.name === name)) {
      setError("同じ名前の参加者が登録されています");
      return;
    }
    const participant: SchedulerParticipant = {
      id: `player-${Date.now().toString(36)}`,
      name,
      active: true,
    };
    setNewParticipant("");
    setError("");
    regenerateFuture([...session.participants, participant], session.courtCount);
  }

  function toggleParticipant(id: string) {
    if (!session) return;
    const next = session.participants.map((participant) =>
      participant.id === id ? { ...participant, active: !participant.active } : participant,
    );
    if (next.filter((participant) => participant.active).length < 4) {
      setError("参加中の人は4人以上必要です");
      return;
    }
    setError("");
    regenerateFuture(next, session.courtCount);
  }

  function applyCourtCount() {
    if (!session) return;
    if (!Number.isInteger(nextCourtCount) || nextCourtCount < 1 || nextCourtCount > 8) {
      setError("コート数は1〜8面で入力してください");
      return;
    }
    setError("");
    regenerateFuture(session.participants, nextCourtCount);
  }

  function selectForSwap(id: string) {
    if (!session) return;
    if (!selectedPlayer) {
      setSelectedPlayer(id);
      return;
    }
    if (selectedPlayer === id) {
      setSelectedPlayer(null);
      return;
    }
    try {
      const changed = swapPlayersInRound(session.rounds[session.currentIndex], selectedPlayer, id);
      const history = [...session.rounds.slice(0, session.currentIndex), changed];
      const remaining = Math.max(0, session.plannedRounds - history.length);
      const future = remaining
        ? generateRounds(session.participants, session.courtCount, remaining, history)
        : [];
      setSession({ ...session, rounds: [...history, ...future] });
      setSelectedPlayer(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "入れ替えできませんでした");
    }
  }

  function reset() {
    if (!window.confirm("現在の進行表を消して、最初から作り直しますか？")) return;
    window.localStorage.removeItem(STORAGE_KEY);
    setSession(null);
    setSelectedPlayer(null);
    setView("progress");
  }

  if (!loaded) return <main className="min-h-screen bg-[#fbfaf8]" />;

  return (
    <div className="min-h-screen bg-[#fbfaf8] pb-28 text-zinc-900">
      <header className="sticky top-0 z-30 border-b border-zinc-200 bg-[#fbfaf8]/95 px-4 backdrop-blur-md">
        <div className="mx-auto flex h-15 max-w-4xl items-center justify-between">
          <Link href="/" className="inline-flex min-h-11 items-center gap-1 text-sm font-bold text-zinc-600">
            <ChevronLeft className="size-4" /> ホーム
          </Link>
          <strong className="text-base">ゲーム進行</strong>
          {session ? (
            <button onClick={reset} className="inline-flex min-h-11 items-center gap-1 text-xs font-bold text-zinc-500">
              <RotateCcw className="size-4" /> 最初から
            </button>
          ) : <span className="w-18" />}
        </div>
      </header>

      {!session ? (
        <SetupForm
          names={names}
          setNames={setNames}
          courtCount={courtCount}
          setCourtCount={setCourtCount}
          roundCount={roundCount}
          setRoundCount={setRoundCount}
          generating={generating}
          error={error}
          onSubmit={createSchedule}
        />
      ) : (
        <main className="mx-auto max-w-4xl px-4 py-5">
          <div className="flex border-b border-zinc-300" role="tablist" aria-label="ゲーム進行表示">
            {([
              ["progress", "現在・次"],
              ["schedule", "全試合"],
              ["stats", "集計"],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setView(value)}
                className={`min-h-11 flex-1 border-b-2 px-2 text-sm font-bold ${view === value ? "border-primary text-primary" : "border-transparent text-zinc-500"}`}
              >
                {label}
              </button>
            ))}
          </div>

          {error && <button onClick={() => setError("")} className="mt-4 w-full border-l-4 border-red-500 bg-red-50 p-3 text-left text-sm text-red-700">{error}</button>}

          {view === "progress" && (
            <ProgressView
              session={session}
              nameMap={nameMap}
              selectedPlayer={selectedPlayer}
              onSelect={selectForSwap}
              newParticipant={newParticipant}
              setNewParticipant={setNewParticipant}
              onAdd={addParticipant}
              onToggle={toggleParticipant}
              nextCourtCount={nextCourtCount}
              setNextCourtCount={setNextCourtCount}
              onApplyCourts={applyCourtCount}
            />
          )}
          {view === "schedule" && <ScheduleView session={session} nameMap={nameMap} />}
          {view === "stats" && fairness && <StatsView session={session} stats={stats} fairness={fairness} />}
        </main>
      )}

      {session && view === "progress" && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200 bg-white/97 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-md">
          <div className="mx-auto max-w-4xl">
            <Button
              onClick={() => {
                setSelectedPlayer(null);
                setSession({ ...session, currentIndex: Math.min(session.currentIndex + 1, session.rounds.length - 1) });
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              disabled={session.currentIndex >= session.rounds.length - 1}
              className="h-14 w-full text-base font-black"
            >
              {session.currentIndex >= session.rounds.length - 1 ? "予定した試合は終了です" : `第${session.currentIndex + 2}試合へ進む`}
              {session.currentIndex < session.rounds.length - 1 && <ArrowRight className="size-5" />}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function SetupForm({
  names,
  setNames,
  courtCount,
  setCourtCount,
  roundCount,
  setRoundCount,
  generating,
  error,
  onSubmit,
}: {
  names: string;
  setNames: (value: string) => void;
  courtCount: number;
  setCourtCount: (value: number) => void;
  roundCount: number;
  setRoundCount: (value: number) => void;
  generating: boolean;
  error: string;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const count = names.split(/\r?\n|,/).map((name) => name.trim()).filter(Boolean).length;
  return (
    <main className="mx-auto max-w-xl px-4 py-7">
      <p className="text-sm font-bold text-primary">練習会当日の運営ツール</p>
      <h1 className="mt-2 text-2xl font-black tracking-tight">公平なゲーム進行表を作る</h1>
      <p className="mt-2 text-sm leading-6 text-zinc-600">
        出場・休憩回数、ペアと対戦相手の重複、連続出場を比べて、偏りの少ない組み合わせを選びます。
      </p>
      <form onSubmit={onSubmit} className="mt-7 space-y-6 border-t border-zinc-300 pt-6">
        <label className="block">
          <span className="flex items-center justify-between text-sm font-bold">
            参加者名 <span className="font-normal text-zinc-500">{count}人</span>
          </span>
          <Textarea
            value={names}
            onChange={(event) => setNames(event.target.value)}
            rows={10}
            required
            placeholder={"田中\n佐藤\n鈴木\n高橋"}
            className="mt-2 bg-white text-base leading-7"
          />
          <span className="mt-2 block text-xs leading-5 text-zinc-500">1行に1人入力してください。欠席者は生成前に名前を削除します。</span>
        </label>
        <div className="grid grid-cols-2 gap-4">
          <label>
            <span className="text-sm font-bold">コート数</span>
            <Input type="number" min="1" max="8" value={courtCount} onChange={(event) => setCourtCount(Number(event.target.value))} className="mt-2 h-12 bg-white text-base" />
          </label>
          <label>
            <span className="text-sm font-bold">試合数</span>
            <Input type="number" min="1" max="40" value={roundCount} onChange={(event) => setRoundCount(Number(event.target.value))} className="mt-2 h-12 bg-white text-base" />
          </label>
        </div>
        <p className="border-l-4 border-amber-400 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
          1試合は4人です。人数が足りないコートは使用せず、休憩者を公平に割り当てます。
        </p>
        {error && <p role="alert" className="border-l-4 border-red-500 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <Button type="submit" disabled={generating} className="h-13 w-full text-base font-black">
          {generating ? "公平性を計算しています…" : "進行表を作成する"}
        </Button>
      </form>
    </main>
  );
}

function ProgressView({
  session,
  nameMap,
  selectedPlayer,
  onSelect,
  newParticipant,
  setNewParticipant,
  onAdd,
  onToggle,
  nextCourtCount,
  setNextCourtCount,
  onApplyCourts,
}: {
  session: Session;
  nameMap: Map<string, string>;
  selectedPlayer: string | null;
  onSelect: (id: string) => void;
  newParticipant: string;
  setNewParticipant: (value: string) => void;
  onAdd: (event: FormEvent<HTMLFormElement>) => void;
  onToggle: (id: string) => void;
  nextCourtCount: number;
  setNextCourtCount: (value: number) => void;
  onApplyCourts: () => void;
}) {
  const current = session.rounds[session.currentIndex];
  const next = session.rounds[session.currentIndex + 1];
  return (
    <>
      <section className="mt-5">
        <div className="flex items-baseline justify-between border-b-2 border-zinc-900 pb-2">
          <h1 className="text-2xl font-black">現在の試合</h1>
          <span className="text-sm font-bold text-zinc-500">{session.currentIndex + 1} / {session.rounds.length}</span>
        </div>
        <RoundBoard round={current} nameMap={nameMap} editable selectedPlayer={selectedPlayer} onSelect={onSelect} />
        <p className="mt-3 text-xs leading-5 text-zinc-500">手動調整：交換したい2人を順番にタップしてください。休憩者との交換もできます。</p>
      </section>

      <section className="mt-8 border-t-4 border-[#eadbd4] pt-5">
        <h2 className="text-xl font-black">次の試合</h2>
        {next ? <RoundBoard round={next} nameMap={nameMap} /> : <p className="mt-4 py-6 text-center text-sm text-zinc-500">次の試合はありません</p>}
      </section>

      <details className="mt-8 border-y border-zinc-300 py-4">
        <summary className="min-h-11 cursor-pointer py-2 font-bold">途中参加・退出・コート変更</summary>
        <div className="space-y-6 pt-4">
          <form onSubmit={onAdd} className="flex gap-2">
            <Input value={newParticipant} onChange={(event) => setNewParticipant(event.target.value)} placeholder="途中参加者の名前" className="h-11 bg-white" />
            <Button type="submit" variant="outline" className="h-11 shrink-0">追加</Button>
          </form>
          <div>
            <h3 className="text-sm font-bold">参加状況</h3>
            <div className="mt-2 divide-y divide-zinc-200 border-y border-zinc-200">
              {session.participants.map((participant) => (
                <div key={participant.id} className="flex min-h-12 items-center justify-between gap-3 py-2">
                  <span className={participant.active ? "font-medium" : "text-zinc-400 line-through"}>{participant.name}</span>
                  <button onClick={() => onToggle(participant.id)} className="min-h-9 px-3 text-sm font-bold text-primary">
                    {participant.active ? "次から退出" : "次から再参加"}
                  </button>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-sm font-bold">次の試合から使うコート数</h3>
            <div className="mt-2 flex gap-2">
              <Input type="number" min="1" max="8" value={nextCourtCount} onChange={(event) => setNextCourtCount(Number(event.target.value))} className="h-11 w-24 bg-white" />
              <Button onClick={onApplyCourts} variant="outline" className="h-11">反映する</Button>
            </div>
          </div>
        </div>
      </details>
    </>
  );
}

function PlayerButton({ id, nameMap, selected, onSelect }: { id: string; nameMap: Map<string, string>; selected: boolean; onSelect?: (id: string) => void }) {
  const className = `min-h-11 min-w-0 flex-1 border px-2 py-2 text-center text-sm font-black ${selected ? "border-primary bg-pink-50 text-primary" : "border-zinc-300 bg-white"}`;
  return onSelect ? <button onClick={() => onSelect(id)} className={className}>{nameMap.get(id) ?? id}</button> : <span className={className}>{nameMap.get(id) ?? id}</span>;
}

function RoundBoard({ round, nameMap, editable = false, selectedPlayer, onSelect }: { round: SchedulerRound; nameMap: Map<string, string>; editable?: boolean; selectedPlayer?: string | null; onSelect?: (id: string) => void }) {
  return (
    <div className="mt-3 space-y-3">
      {round.courts.map((court) => (
        <div key={court.court} className="border-l-4 border-primary bg-white p-3 shadow-sm">
          <p className="mb-2 text-xs font-black tracking-wider text-primary">コート {court.court}</p>
          <div className="flex items-center gap-1.5">
            <PlayerButton id={court.teamA[0]} nameMap={nameMap} selected={selectedPlayer === court.teamA[0]} onSelect={editable ? onSelect : undefined} />
            <PlayerButton id={court.teamA[1]} nameMap={nameMap} selected={selectedPlayer === court.teamA[1]} onSelect={editable ? onSelect : undefined} />
            <strong className="px-1 text-sm text-zinc-500">vs</strong>
            <PlayerButton id={court.teamB[0]} nameMap={nameMap} selected={selectedPlayer === court.teamB[0]} onSelect={editable ? onSelect : undefined} />
            <PlayerButton id={court.teamB[1]} nameMap={nameMap} selected={selectedPlayer === court.teamB[1]} onSelect={editable ? onSelect : undefined} />
          </div>
        </div>
      ))}
      <div className="border-l-4 border-zinc-400 bg-zinc-100 px-3 py-3">
        <p className="text-xs font-black text-zinc-500">休憩</p>
        {round.resting.length ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {round.resting.map((id) => (
              <button key={id} disabled={!editable} onClick={() => onSelect?.(id)} className={`min-h-10 border px-3 text-sm font-bold ${selectedPlayer === id ? "border-primary bg-pink-50 text-primary" : "border-zinc-300 bg-white"}`}>
                {nameMap.get(id) ?? id}
              </button>
            ))}
          </div>
        ) : <p className="mt-1 text-sm text-zinc-500">なし</p>}
      </div>
    </div>
  );
}

function ScheduleView({ session, nameMap }: { session: Session; nameMap: Map<string, string> }) {
  return (
    <section className="mt-6">
      <h1 className="text-2xl font-black">全試合</h1>
      <div className="mt-4 divide-y divide-zinc-300 border-y border-zinc-300">
        {session.rounds.map((round, index) => (
          <details key={round.number} open={index === session.currentIndex} className="py-3">
            <summary className="flex min-h-11 cursor-pointer items-center justify-between py-2 font-black">
              第{round.number}試合
              <span className="text-xs font-medium text-zinc-500">{index < session.currentIndex ? "終了" : index === session.currentIndex ? "現在" : "予定"}</span>
            </summary>
            <RoundBoard round={round} nameMap={nameMap} />
          </details>
        ))}
      </div>
    </section>
  );
}

function StatsView({ session, stats, fairness }: { session: Session; stats: ReturnType<typeof calculateStats>; fairness: ReturnType<typeof calculateFairness> }) {
  return (
    <section className="mt-6">
      <div className="flex items-end justify-between border-b-2 border-zinc-900 pb-3">
        <div>
          <p className="text-xs font-bold text-zinc-500">予定全体の評価</p>
          <h1 className="mt-1 text-2xl font-black">公平度</h1>
        </div>
        <p className="text-4xl font-black tabular-nums text-primary">{fairness.score}<span className="text-base text-zinc-500"> / 100</span></p>
      </div>
      <div className="grid grid-cols-2 gap-x-5 gap-y-3 border-b border-zinc-300 py-5 text-sm">
        <ScoreLine label="出場の均等さ" score={fairness.playBalance} total={40} />
        <ScoreLine label="休憩の均等さ" score={fairness.restBalance} total={20} />
        <ScoreLine label="ペアの多様性" score={fairness.pairDiversity} total={18} />
        <ScoreLine label="対戦の多様性" score={fairness.opponentDiversity} total={12} />
        <ScoreLine label="連続偏り" score={fairness.streakBalance} total={10} />
      </div>
      <p className="mt-3 text-xs leading-5 text-zinc-500">出場回数差 {fairness.playRange}回・休憩回数差 {fairness.restRange}回。点数は均等性・重複・連続偏りの実測値から計算しています。</p>

      <h2 className="mt-8 text-xl font-black">参加者別集計</h2>
      <div className="mt-3 overflow-x-auto border-y border-zinc-300 bg-white">
        <table className="w-full min-w-[38rem] border-collapse text-sm">
          <thead className="bg-zinc-100 text-left text-xs text-zinc-600">
            <tr><th className="p-3">参加者</th><th className="p-3">出場</th><th className="p-3">休憩</th><th className="p-3">ペア重複</th><th className="p-3">対戦重複</th><th className="p-3">最大連続出場</th><th className="p-3">最大連続休憩</th></tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {session.participants.map((participant) => {
              const item = stats[participant.id];
              return <tr key={participant.id}><th className="p-3 text-left font-bold">{participant.name}</th><td className="p-3 tabular-nums">{item.plays}</td><td className="p-3 tabular-nums">{item.rests}</td><td className="p-3 tabular-nums">{item.pairRepeats}</td><td className="p-3 tabular-nums">{item.opponentRepeats}</td><td className="p-3 tabular-nums">{item.maxPlayStreak}</td><td className="p-3 tabular-nums">{item.maxRestStreak}</td></tr>;
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ScoreLine({ label, score, total }: { label: string; score: number; total: number }) {
  return <div className="flex items-center justify-between gap-3"><span>{label}</span><strong className="tabular-nums">{score} / {total}</strong></div>;
}
