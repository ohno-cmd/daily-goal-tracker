import { describe, expect, it } from "vitest";
import seed from "@/supabase/seed/habits.json";
import { addDays, todayInTokyo, weekStartOf } from "@/lib/dates";
import {
  averageRate,
  currentStreak,
  evaluateRewards,
  habitRates,
  longestStreak,
  minutesToTime,
  needsMoodBoost,
  percent,
  pillarRates,
  rewardStep,
  salesRows,
  scoreDay,
  scoreDays,
  sleepMinutes,
  summarizeWeek,
  weekThreshold,
  type ChecksByDate,
  type HabitDef,
  type Priority,
} from "@/lib/scoring";

const START = "2026-10-01";

function habits(): HabitDef[] {
  return seed.map((h, i) => ({
    id: `h${i + 1}`,
    priority: h.priority as Priority,
    pillar_label: h.pillar_label,
    active_from: START,
    archived_on: null,
    versions: [{ valid_from: START, priority: h.priority as Priority }],
  }));
}
const all = (hs: HabitDef[]) => new Set(hs.map((h) => h.id));
const aOnly = (hs: HabitDef[]) => new Set(hs.filter((h) => h.priority === "A").map((h) => h.id));

describe("todayInTokyo", () => {
  it("日本時間の朝7時はその日(UTCでは前日22時)", () => {
    expect(todayInTokyo(new Date("2026-10-13T22:00:00Z"))).toBe("2026-10-14");
  });
  it("日本時間の23:59はまだその日", () => {
    expect(todayInTokyo(new Date("2026-10-14T14:59:00Z"))).toBe("2026-10-14");
  });
});

describe("点数・満点・達成率・◎", () => {
  it("20習慣すべてに✓で 44 / 44、100%、◎", () => {
    const hs = habits();
    const r = scoreDay(hs, all(hs), "2026-10-13");
    expect([r.score, r.max, percent(r.rate), r.allA]).toEqual([44, 44, "100%", true]);
  });
  it("24点の日は55%", () => {
    const hs = habits();
    // A×8 = 24点
    const r = scoreDay(hs, aOnly(hs), "2026-10-14");
    expect([r.score, r.max, percent(r.rate), r.allA]).toEqual([24, 44, "55%", true]);
  });
  it("Aが1つ欠けると◎にならない", () => {
    const hs = habits();
    const s = all(hs);
    s.delete("h1");
    expect(scoreDay(hs, s, "2026-10-13").allA).toBe(false);
  });
  it("有効になる前の日とアーカイブ後の日は満点に数えない", () => {
    const hs = habits();
    hs[0].active_from = "2026-10-10";
    hs[1].archived_on = "2026-10-12";
    expect(scoreDay(hs, new Set(), "2026-10-09").max).toBe(44 - 3);
    expect(scoreDay(hs, new Set(), "2026-10-11").max).toBe(44);
    expect(scoreDay(hs, new Set(), "2026-10-12").max).toBe(44 - 2);
  });
});

describe("優先度の変更で過去の点数が変わらない", () => {
  it("BからAに変えても前日までの点数と◎は変わらない", () => {
    const hs = habits();
    const checks: ChecksByDate = new Map([
      ["2026-10-13", aOnly(hs)],
      ["2026-10-14", aOnly(hs)],
    ]);
    const before = scoreDays(hs, checks, "2026-10-13", "2026-10-14");
    // h2(B)を 10/14 から A に変更
    hs[1].priority = "A";
    hs[1].versions.push({ valid_from: "2026-10-14", priority: "A" });
    const after = scoreDays(hs, checks, "2026-10-13", "2026-10-14");
    expect(after[0]).toEqual(before[0]);
    expect(after[1].max).toBe(45);
    expect(after[1].allA).toBe(false);
  });
});

describe("連続日数", () => {
  const today = "2026-10-14";
  it("◎が3日続き、今日がまだ未入力なら3", () => {
    const hs = habits();
    const checks: ChecksByDate = new Map(["2026-10-11", "2026-10-12", "2026-10-13"].map((d) => [d, all(hs)]));
    const isA = (d: string) => scoreDay(hs, checks.get(d), d).allA;
    expect(currentStreak(isA, today)).toBe(3);
  });
  it("今日も◎なら今日を含める", () => {
    const hs = habits();
    const checks: ChecksByDate = new Map(["2026-10-12", "2026-10-13", today].map((d) => [d, all(hs)]));
    expect(currentStreak((d) => scoreDay(hs, checks.get(d), d).allA, today)).toBe(3);
  });
  it("昨日が◎でなければ0", () => {
    const hs = habits();
    const checks: ChecksByDate = new Map([["2026-10-12", all(hs)]]);
    expect(currentStreak((d) => scoreDay(hs, checks.get(d), d).allA, today)).toBe(0);
  });
  it("最長連続日数", () => {
    const hs = habits();
    const checks: ChecksByDate = new Map(
      ["2026-10-01", "2026-10-02", "2026-10-04", "2026-10-05", "2026-10-06"].map((d) => [d, all(hs)]),
    );
    expect(longestStreak(scoreDays(hs, checks, START, today))).toBe(3);
  });
});

describe("平均・習慣別・柱別", () => {
  it("未来の日は含めず、入力の無い過去の日は0%で含める", () => {
    const hs = habits();
    const checks: ChecksByDate = new Map([["2026-10-13", all(hs)]]);
    const days = scoreDays(hs, checks, "2026-10-12", "2026-10-20");
    expect(averageRate(days, "2026-10-13")).toBe(0.5);
  });
  it("習慣別達成率と柱別達成率", () => {
    const hs = habits();
    const checks: ChecksByDate = new Map([
      ["2026-10-13", new Set(["h1", "h12"])],
      ["2026-10-14", new Set(["h1"])],
    ]);
    const rates = habitRates(hs, checks, "2026-10-13", "2026-10-14");
    expect(rates.find((r) => r.habitId === "h1")?.rate).toBe(1);
    expect(rates.find((r) => r.habitId === "h12")?.rate).toBe(0.5);
    // 規則正しい生活: h1, h12, h14, h15, h16, h19, h20 → (1 + 0.5 + 0×5) / 7
    const p = pillarRates(hs, rates).find((x) => x.pillar === "規則正しい生活");
    expect(p?.habits).toBe(7);
    expect(p?.rate).toBeCloseTo(1.5 / 7);
  });
});

describe("ご褒美", () => {
  const rule = { rate: 0.8, aDays: 6 };
  it("44点 × 7日 × 80% = 246点", () => {
    expect(weekThreshold(44, rule)).toBe(246);
  });

  /** 1週間分の✓:fullDays 日は全✓、aDays 日はAだけ */
  function week(hs: HabitDef[], ws: string, plan: ("all" | "a" | "none")[], checks: ChecksByDate) {
    plan.forEach((p, i) => {
      if (p === "all") checks.set(addDays(ws, i), all(hs));
      if (p === "a") checks.set(addDays(ws, i), aOnly(hs));
    });
  }

  it("246点以上かつ◎6日以上でクリア、境界の前後", () => {
    const hs = habits();
    const ws = "2026-10-05";
    const today = "2026-10-20";
    // 全✓5日(220) + Aのみ1日(24) = 244点、◎6日 → 点数不足
    const c1: ChecksByDate = new Map();
    week(hs, ws, ["all", "all", "all", "all", "all", "a", "none"], c1);
    const w1 = summarizeWeek(hs, c1, ws, today);
    expect([w1.score, w1.aDays]).toEqual([244, 6]);
    expect(evaluateRewards([w1], rule, 5, today)[0].kind).toBe("missed");
    // さらに7日目に深呼吸(B=2点)だけ → ちょうど246点、◎6日 → クリア
    c1.set(addDays(ws, 6), new Set(["h2"]));
    const w2 = summarizeWeek(hs, c1, ws, today);
    expect(w2.score).toBe(246);
    expect(evaluateRewards([w2], rule, 5, today)[0]).toMatchObject({ kind: "cleared", step: 1 });
    // 全✓5日(220点)+ 2日なし → 点数も◎も不足
    const c3: ChecksByDate = new Map();
    week(hs, ws, ["all", "all", "all", "all", "all", "none", "none"], c3);
    expect(evaluateRewards([summarizeWeek(hs, c3, ws, today)], rule, 5, today)[0].kind).toBe("missed");
  });

  it("6回目のクリアでは1週目のご褒美に戻る", () => {
    const hs = habits();
    const today = "2026-12-31";
    const checks: ChecksByDate = new Map();
    const starts = [0, 1, 2, 3, 4, 5].map((i) => addDays("2026-10-05", i * 7));
    for (const ws of starts) week(hs, ws, ["all", "all", "all", "all", "all", "all", "all"], checks);
    const weeks = starts.map((ws) => summarizeWeek(hs, checks, ws, today));
    const st = evaluateRewards(weeks, rule, 5, today);
    expect(st.map((s) => (s.kind === "cleared" ? s.step : null))).toEqual([1, 2, 3, 4, 5, 1]);
    expect(rewardStep(11, 5)).toBe(1);
  });

  it("週の途中は「あと何点・◎あと何日」を出す", () => {
    const hs = habits();
    const ws = weekStartOf("2026-10-14");
    const checks: ChecksByDate = new Map();
    week(hs, ws, ["all", "all"], checks);
    const s = evaluateRewards([summarizeWeek(hs, checks, ws, "2026-10-14")], rule, 5, "2026-10-14")[0];
    expect(s).toEqual({ kind: "in_progress", threshold: 246, pointsLeft: 246 - 88, aDaysLeft: 4, possible: true });
  });
});

describe("売上", () => {
  it("実績2,400,000円 → 差額−600,000円、達成率80%", () => {
    const [r] = salesRows([{ month: "2026-10-01", target_yen: 3_000_000, actual_yen: 2_400_000 }]);
    expect(r.diff).toBe(-600_000);
    expect(percent(r.rate)).toBe("80%");
  });
  it("累計は実績が入った月だけ足し、未入力の月は計算しない", () => {
    const rows = salesRows([
      { month: "2026-11-01", target_yen: 3_000_000, actual_yen: null },
      { month: "2026-09-01", target_yen: 3_000_000, actual_yen: 1_000_000 },
      { month: "2026-10-01", target_yen: 3_000_000, actual_yen: 2_000_000 },
    ]);
    expect(rows.map((r) => r.cumulative)).toEqual([1_000_000, 3_000_000, null]);
    expect(rows[2].rate).toBeNull();
  });
});

describe("時刻", () => {
  it("0:30の就寝は24:30として平均する", () => {
    expect(sleepMinutes("00:30:00")).toBe(24 * 60 + 30);
    expect(sleepMinutes("23:30")).toBe(23 * 60 + 30);
    expect(minutesToTime((sleepMinutes("23:30")! + sleepMinutes("0:30")!) / 2)).toBe("24:00");
  });
});

describe("気分転換の案内", () => {
  it("昨日までの3日が続けて60%未満のときだけ出す", () => {
    const hs = habits();
    const today = "2026-10-14";
    const low: ChecksByDate = new Map(["2026-10-11", "2026-10-12", "2026-10-13"].map((d) => [d, aOnly(hs)])); // 55%
    expect(needsMoodBoost(scoreDays(hs, low, START, today), today, START)).toBe(true);
    low.set("2026-10-12", all(hs));
    expect(needsMoodBoost(scoreDays(hs, low, START, today), today, START)).toBe(false);
    expect(needsMoodBoost(scoreDays(hs, new Map(), START, today), today, "2026-10-13")).toBe(false);
  });
});
