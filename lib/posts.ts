export type PostType = "practice" | "member" | "event";

export function normalizeType(value: unknown): PostType | null {
  return value === "practice" || value === "member" || value === "event" ? value : null;
}

export function required(body: Record<string, unknown>, key: string) {
  const raw = body[key];
  const value = typeof raw === "string" || typeof raw === "number" ? String(raw).trim() : "";
  if (!value) throw new Error(`${key} は必須です`);
  return value;
}

export function count(body: Record<string, unknown>, key: string, allowZero = false) {
  const value = Number(body[key]);
  if (!Number.isFinite(value) || value < (allowZero ? 0 : 1))
    throw new Error(`${key} が正しくありません`);
  return Math.round(value);
}

export function timeSlot(body: Record<string, unknown>, key: string) {
  const value = required(body, key);
  const match = /^(?:[01]\d|2[0-3]):(00|30)$/.exec(value);
  if (!match) throw new Error(`${key} は30分刻みで入力してください`);
  return value;
}

export function timeRange(body: Record<string, unknown>) {
  const start_time = timeSlot(body, "startTime");
  const end_time = timeSlot(body, "endTime");
  if (end_time <= start_time) throw new Error("終了時間は開始時間より後にしてください");
  return { start_time, end_time };
}

export const tableFor = {
  practice: "practice_posts",
  member: "member_posts",
  event: "event_posts",
} as const;
