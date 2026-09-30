import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateFairness,
  calculateStats,
  generateRounds,
  swapPlayersInRound,
  type SchedulerParticipant,
} from "./game-scheduler.ts";

function participants(count: number): SchedulerParticipant[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `p${index + 1}`,
    name: `参加者${index + 1}`,
    active: true,
  }));
}

const cases = [
  [5, 1, 10],
  [6, 1, 12],
  [8, 2, 10],
  [9, 2, 9],
  [10, 2, 10],
  [12, 3, 10],
  [16, 4, 10],
  [17, 4, 17],
] as const;

for (const [playerCount, courts, roundCount] of cases) {
  test(`${playerCount}人 / ${courts}面で公平な進行表を生成する`, () => {
    const roster = participants(playerCount);
    const rounds = generateRounds(roster, courts, roundCount);
    assert.equal(rounds.length, roundCount);
    for (const round of rounds) {
      const used = round.courts.flatMap((court) => [...court.teamA, ...court.teamB]);
      assert.equal(round.courts.length, Math.min(courts, Math.floor(playerCount / 4)));
      assert.equal(new Set(used).size, used.length, "同じ試合に同一人物を重複配置しない");
      assert.equal(used.length + round.resting.length, playerCount);
      assert.equal(round.courts.every((court) => court.teamA.length === 2 && court.teamB.length === 2), true);
    }
    const stats = Object.values(calculateStats(rounds, roster));
    const plays = stats.map((item) => item.plays);
    const rests = stats.map((item) => item.rests);
    assert.ok(Math.max(...plays) - Math.min(...plays) <= 1, "出場回数差を1以内にする");
    assert.ok(Math.max(...rests) - Math.min(...rests) <= 1, "休憩回数差を1以内にする");
    if (playerCount % 4 !== 0) {
      assert.ok(Math.max(...stats.map((item) => item.maxRestStreak)) <= 1, "連続休憩を発生させない");
    }
    const fairness = calculateFairness(rounds, roster);
    assert.ok(fairness.score >= 55 && fairness.score <= 100);
  });
}

test("途中参加者を次の試合で優先する", () => {
  const roster = participants(5);
  const history = generateRounds(roster, 1, 3);
  const late = { id: "late", name: "途中参加", active: true };
  const updated = [...roster, late];
  const [next] = generateRounds(updated, 1, 1, history);
  const playing = next.courts.flatMap((court) => [...court.teamA, ...court.teamB]);
  assert.ok(playing.includes(late.id));
});

test("手動交換後に集計が再計算される", () => {
  const roster = participants(5);
  const [round] = generateRounds(roster, 1, 1);
  const playing = round.courts[0].teamA[0];
  const resting = round.resting[0];
  const swapped = swapPlayersInRound(round, playing, resting);
  const stats = calculateStats([swapped], roster);
  assert.equal(stats[playing].rests, 1);
  assert.equal(stats[resting].plays, 1);
});

test("途中退出者を次の試合から外す", () => {
  const roster = participants(9);
  const history = generateRounds(roster, 2, 2);
  const leavingId = roster[0].id;
  const updated = roster.map((participant) =>
    participant.id === leavingId ? { ...participant, active: false } : participant,
  );
  const [next] = generateRounds(updated, 2, 1, history);
  const assigned = [...next.courts.flatMap((court) => [...court.teamA, ...court.teamB]), ...next.resting];
  assert.equal(assigned.includes(leavingId), false);
  assert.equal(next.eligible.includes(leavingId), false);
});

test("途中のコート数変更を次の試合へ反映する", () => {
  const roster = participants(12);
  const history = generateRounds(roster, 3, 2);
  const [next] = generateRounds(roster, 2, 1, history);
  assert.equal(next.courts.length, 2);
  assert.equal(next.resting.length, 4);
  assert.equal(next.number, 3);
});
