export type SchedulerParticipant = {
  id: string;
  name: string;
  active: boolean;
};

export type SchedulerCourt = {
  court: number;
  teamA: [string, string];
  teamB: [string, string];
};

export type SchedulerRound = {
  number: number;
  courts: SchedulerCourt[];
  resting: string[];
  eligible: string[];
};

export type ParticipantStats = {
  id: string;
  name: string;
  plays: number;
  rests: number;
  currentPlayStreak: number;
  currentRestStreak: number;
  maxPlayStreak: number;
  maxRestStreak: number;
  pairCounts: Record<string, number>;
  opponentCounts: Record<string, number>;
  pairRepeats: number;
  opponentRepeats: number;
  eligibleRounds: number;
};

export type FairnessReport = {
  score: number;
  playBalance: number;
  restBalance: number;
  pairDiversity: number;
  opponentDiversity: number;
  streakBalance: number;
  playRange: number;
  restRange: number;
};

type Candidate = {
  courts: SchedulerCourt[];
  resting: string[];
  priority: number[];
  signature: string;
};

function pairKey(a: string, b: string) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function groupKey(ids: string[]) {
  return [...ids].sort().join("|");
}

function fnv1a(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function increment(record: Record<string, number>, key: string) {
  record[key] = (record[key] ?? 0) + 1;
}

export function calculateStats(
  rounds: SchedulerRound[],
  participants: SchedulerParticipant[],
): Record<string, ParticipantStats> {
  const stats: Record<string, ParticipantStats> = Object.fromEntries(
    participants.map((participant) => [
      participant.id,
      {
        id: participant.id,
        name: participant.name,
        plays: 0,
        rests: 0,
        currentPlayStreak: 0,
        currentRestStreak: 0,
        maxPlayStreak: 0,
        maxRestStreak: 0,
        pairCounts: {},
        opponentCounts: {},
        pairRepeats: 0,
        opponentRepeats: 0,
        eligibleRounds: 0,
      } satisfies ParticipantStats,
    ]),
  );

  for (const round of rounds) {
    const playing = new Set(round.courts.flatMap((court) => [...court.teamA, ...court.teamB]));
    for (const id of round.eligible) {
      const item = stats[id];
      if (!item) continue;
      item.eligibleRounds += 1;
      if (playing.has(id)) {
        item.plays += 1;
        item.currentPlayStreak += 1;
        item.currentRestStreak = 0;
        item.maxPlayStreak = Math.max(item.maxPlayStreak, item.currentPlayStreak);
      } else {
        item.rests += 1;
        item.currentRestStreak += 1;
        item.currentPlayStreak = 0;
        item.maxRestStreak = Math.max(item.maxRestStreak, item.currentRestStreak);
      }
    }
    for (const court of round.courts) {
      const [a, b] = court.teamA;
      const [c, d] = court.teamB;
      increment(stats[a].pairCounts, b);
      increment(stats[b].pairCounts, a);
      increment(stats[c].pairCounts, d);
      increment(stats[d].pairCounts, c);
      for (const left of [a, b]) {
        for (const right of [c, d]) {
          increment(stats[left].opponentCounts, right);
          increment(stats[right].opponentCounts, left);
        }
      }
    }
  }

  for (const item of Object.values(stats)) {
    item.pairRepeats = Object.values(item.pairCounts).reduce(
      (sum, count) => sum + Math.max(0, count - 1),
      0,
    );
    item.opponentRepeats = Object.values(item.opponentCounts).reduce(
      (sum, count) => sum + Math.max(0, count - 1),
      0,
    );
  }
  return stats;
}

function combinations<T>(items: T[], size: number, limit = 1600) {
  const result: T[][] = [];
  const current: T[] = [];
  const visit = (start: number) => {
    if (result.length >= limit) return;
    if (current.length === size) {
      result.push([...current]);
      return;
    }
    const needed = size - current.length;
    for (let index = start; index <= items.length - needed; index += 1) {
      current.push(items[index]);
      visit(index + 1);
      current.pop();
      if (result.length >= limit) return;
    }
  };
  visit(0);
  return result;
}

function candidateSelections(
  active: SchedulerParticipant[],
  slots: number,
  stats: Record<string, ParticipantStats>,
  roundNumber: number,
) {
  if (slots === active.length) return [active.map((participant) => participant.id)];
  const ranked = [...active].sort((left, right) => {
    const a = stats[left.id];
    const b = stats[right.id];
    return (
      a.plays - b.plays ||
      b.currentRestStreak - a.currentRestStreak ||
      a.rests - b.rests ||
      left.id.localeCompare(right.id)
    );
  });
  const all = combinations(ranked.map((participant) => participant.id), slots);
  if (all.length < 1600) return all;

  const unique = new Map<string, string[]>();
  unique.set(ranked.slice(0, slots).map((participant) => participant.id).sort().join("|"), ranked.slice(0, slots).map((participant) => participant.id));
  for (let seed = 0; seed < 320; seed += 1) {
    const ids = [...active]
      .sort(
        (a, b) =>
          fnv1a(`${roundNumber}:${seed}:${a.id}`) - fnv1a(`${roundNumber}:${seed}:${b.id}`) ||
          a.id.localeCompare(b.id),
      )
      .slice(0, slots)
      .map((participant) => participant.id);
    unique.set([...ids].sort().join("|"), ids);
  }
  return [...unique.values()];
}

function historyGroupCounts(rounds: SchedulerRound[]) {
  const counts: Record<string, number> = {};
  for (const round of rounds) {
    for (const court of round.courts) {
      increment(counts, groupKey([...court.teamA, ...court.teamB]));
    }
  }
  return counts;
}

const pairings = (ids: string[]): Array<[[string, string], [string, string]]> => [
  [[ids[0], ids[1]], [ids[2], ids[3]]],
  [[ids[0], ids[2]], [ids[1], ids[3]]],
  [[ids[0], ids[3]], [ids[1], ids[2]]],
];

function bestPairing(
  ids: string[],
  stats: Record<string, ParticipantStats>,
): [[string, string], [string, string]] {
  return pairings(ids).sort((left, right) => {
    const score = (pairing: [[string, string], [string, string]]) => {
      const [[a, b], [c, d]] = pairing;
      const pairPenalty = (stats[a].pairCounts[b] ?? 0) + (stats[c].pairCounts[d] ?? 0);
      const opponentPenalty = [a, b].reduce(
        (sum, player) => sum + [c, d].reduce((inner, opponent) => inner + (stats[player].opponentCounts[opponent] ?? 0), 0),
        0,
      );
      return pairPenalty * 100 + opponentPenalty;
    };
    return score(left) - score(right) || JSON.stringify(left).localeCompare(JSON.stringify(right));
  })[0];
}

function varianceNumerator(values: number[]) {
  const sum = values.reduce((total, value) => total + value, 0);
  return values.length * values.reduce((total, value) => total + value * value, 0) - sum * sum;
}

function evaluateCandidate(
  courts: SchedulerCourt[],
  resting: string[],
  activeIds: string[],
  stats: Record<string, ParticipantStats>,
  groupCounts: Record<string, number>,
) {
  const playing = new Set(courts.flatMap((court) => [...court.teamA, ...court.teamB]));
  const plays = activeIds.map((id) => stats[id].plays + (playing.has(id) ? 1 : 0));
  const rests = activeIds.map((id) => stats[id].rests + (playing.has(id) ? 0 : 1));
  let pairRepeat = 0;
  let opponentRepeat = 0;
  let repeatedGroup = 0;
  for (const court of courts) {
    const [a, b] = court.teamA;
    const [c, d] = court.teamB;
    pairRepeat += (stats[a].pairCounts[b] ?? 0) + (stats[c].pairCounts[d] ?? 0);
    for (const player of [a, b]) {
      for (const opponent of [c, d]) opponentRepeat += stats[player].opponentCounts[opponent] ?? 0;
    }
    repeatedGroup += groupCounts[groupKey([a, b, c, d])] ?? 0;
  }
  const restSet = new Set(resting);
  const consecutiveRest = activeIds.reduce((sum, id) => {
    const streak = restSet.has(id) ? stats[id].currentRestStreak + 1 : 0;
    return sum + Math.max(0, streak - 1) ** 2;
  }, 0);
  const consecutivePlay = activeIds.reduce((sum, id) => {
    const streak = playing.has(id) ? stats[id].currentPlayStreak + 1 : 0;
    return sum + Math.max(0, streak - 2) ** 2;
  }, 0);
  return [
    Math.max(...plays) - Math.min(...plays),
    varianceNumerator(plays),
    Math.max(...rests) - Math.min(...rests),
    varianceNumerator(rests),
    // A consecutive rest is highly visible on the day. Treat an avoidable one as a
    // guardrail before optimizing relationship repetition.
    consecutiveRest,
    pairRepeat,
    opponentRepeat,
    consecutivePlay,
    repeatedGroup,
  ];
}

function comparePriority(left: number[], right: number[]) {
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);
    if (difference) return difference;
  }
  return 0;
}

function buildCandidate(
  selection: string[],
  activeIds: string[],
  courtCount: number,
  stats: Record<string, ParticipantStats>,
  groupCounts: Record<string, number>,
  roundNumber: number,
  seed: number,
): Candidate {
  const ordered = [...selection].sort(
    (a, b) =>
      fnv1a(`${roundNumber}:${seed}:${a}`) - fnv1a(`${roundNumber}:${seed}:${b}`) ||
      a.localeCompare(b),
  );
  const courts: SchedulerCourt[] = [];
  for (let index = 0; index < courtCount; index += 1) {
    const group = ordered.slice(index * 4, index * 4 + 4);
    const [teamA, teamB] = bestPairing(group, stats);
    courts.push({ court: index + 1, teamA, teamB });
  }
  const selected = new Set(selection);
  const resting = activeIds.filter((id) => !selected.has(id));
  const priority = evaluateCandidate(courts, resting, activeIds, stats, groupCounts);
  return {
    courts,
    resting,
    priority,
    signature: courts.map((court) => `${court.teamA.join("-")}v${court.teamB.join("-")}`).join("/"),
  };
}

export function generateRounds(
  participants: SchedulerParticipant[],
  requestedCourts: number,
  count: number,
  history: SchedulerRound[] = [],
): SchedulerRound[] {
  const active = participants.filter((participant) => participant.active);
  if (active.length < 4) throw new Error("参加者は4人以上必要です");
  if (!Number.isInteger(requestedCourts) || requestedCourts < 1) throw new Error("コート数が正しくありません");
  if (!Number.isInteger(count) || count < 1) throw new Error("試合数が正しくありません");

  const usedCourts = Math.min(requestedCourts, Math.floor(active.length / 4));
  const slots = usedCourts * 4;
  const generated: SchedulerRound[] = [];
  for (let offset = 0; offset < count; offset += 1) {
    const prior = [...history, ...generated];
    const stats = calculateStats(prior, participants);
    const activeIds = active.map((participant) => participant.id);
    const selections = candidateSelections(active, slots, stats, history.length + offset + 1);
    const groups = historyGroupCounts(prior);
    let best: Candidate | null = null;
    for (const selection of selections) {
      const seeds = Math.max(24, Math.min(96, selection.length * 6));
      for (let seed = 0; seed < seeds; seed += 1) {
        const candidate = buildCandidate(
          selection,
          activeIds,
          usedCourts,
          stats,
          groups,
          history.length + offset + 1,
          seed,
        );
        if (
          !best ||
          comparePriority(candidate.priority, best.priority) < 0 ||
          (comparePriority(candidate.priority, best.priority) === 0 && candidate.signature < best.signature)
        ) {
          best = candidate;
        }
      }
    }
    if (!best) throw new Error("組み合わせを生成できませんでした");
    generated.push({
      number: history.length + offset + 1,
      courts: best.courts,
      resting: best.resting,
      eligible: activeIds,
    });
  }
  return generated;
}

function balanceRatio(values: number[]) {
  if (!values.length) return 1;
  const maximum = Math.max(...values);
  if (maximum === 0) return 1;
  return Math.max(0, 1 - (maximum - Math.min(...values)) / maximum);
}

export function calculateFairness(
  rounds: SchedulerRound[],
  participants: SchedulerParticipant[],
): FairnessReport {
  const stats = Object.values(calculateStats(rounds, participants)).filter((item) => item.eligibleRounds > 0);
  if (!stats.length) {
    return { score: 100, playBalance: 40, restBalance: 20, pairDiversity: 18, opponentDiversity: 12, streakBalance: 10, playRange: 0, restRange: 0 };
  }
  const plays = stats.map((item) => item.plays);
  const rests = stats.map((item) => item.rests);
  const pairEncounters = stats.reduce((sum, item) => sum + Object.values(item.pairCounts).reduce((a, b) => a + b, 0), 0);
  const opponentEncounters = stats.reduce((sum, item) => sum + Object.values(item.opponentCounts).reduce((a, b) => a + b, 0), 0);
  const pairRepeats = stats.reduce((sum, item) => sum + item.pairRepeats, 0);
  const opponentRepeats = stats.reduce((sum, item) => sum + item.opponentRepeats, 0);
  const streakExcess = stats.reduce(
    (sum, item) => sum + Math.max(0, item.maxRestStreak - 1) * 2 + Math.max(0, item.maxPlayStreak - 3),
    0,
  );
  const playBalance = Math.round(40 * balanceRatio(plays));
  const restBalance = Math.round(20 * balanceRatio(rests));
  const pairDiversity = Math.round(18 * Math.max(0, 1 - pairRepeats / Math.max(1, pairEncounters)));
  const opponentDiversity = Math.round(12 * Math.max(0, 1 - opponentRepeats / Math.max(1, opponentEncounters)));
  const streakBalance = Math.round(10 * Math.max(0, 1 - streakExcess / Math.max(1, stats.length * 2)));
  return {
    score: playBalance + restBalance + pairDiversity + opponentDiversity + streakBalance,
    playBalance,
    restBalance,
    pairDiversity,
    opponentDiversity,
    streakBalance,
    playRange: Math.max(...plays) - Math.min(...plays),
    restRange: Math.max(...rests) - Math.min(...rests),
  };
}

export function swapPlayersInRound(
  round: SchedulerRound,
  firstId: string,
  secondId: string,
): SchedulerRound {
  if (firstId === secondId) return round;
  const present = new Set([...round.resting, ...round.courts.flatMap((court) => [...court.teamA, ...court.teamB])]);
  if (!present.has(firstId) || !present.has(secondId)) throw new Error("交換する参加者が見つかりません");
  const replace = (id: string) => (id === firstId ? secondId : id === secondId ? firstId : id);
  return {
    ...round,
    courts: round.courts.map((court) => ({
      ...court,
      teamA: court.teamA.map(replace) as [string, string],
      teamB: court.teamB.map(replace) as [string, string],
    })),
    resting: round.resting.map(replace),
  };
}
