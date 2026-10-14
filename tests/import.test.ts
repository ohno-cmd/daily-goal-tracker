import { describe, expect, it } from "vitest";
import seed from "@/supabase/seed/habits.json";
import { parseCsv, toCsv } from "@/lib/import/csv";
import {
  buildPlan,
  detectSheet,
  parseAffirmations,
  parseDaily,
  parseGoals,
  parseHabits,
  parsePillars,
  parseReviews,
  parseRewards,
  parseTime,
  parseYen,
  pillarMatches,
  summarizePlan,
  YearTracker,
} from "@/lib/import/sheets";
import { scoreDay, type ChecksByDate, type HabitDef, type Priority } from "@/lib/scoring";

const names = seed.map((h) => h.name);

/** 日次チェックのCSV(日付が横、行が項目)。実データではなくテスト用 */
function dailyCsv(): string {
  const rows: string[][] = [
    ["", "", "", "項目", "10/13", "10/14"],
    ["", "", "", "起床時刻", "6:00", "6:20"],
    ["", "", "", "今日の宣言", "1行目\n2行目", "宣言"],
  ];
  for (const h of seed) rows.push(["", h.time_label, h.priority, h.name, "✓", h.priority === "A" ? "✓" : ""]);
  rows.push(
    ["", "", "", "就寝時刻", "23:00", "0:30"],
    ["", "", "", "感謝・できたこと3つ", "a\nb\nc", ""],
    ["", "", "", "メモ", "", "TODO"],
    ["", "", "", "点数", "44", "24"],
    ["", "", "", "満点", "44", "44"],
    ["", "", "", "達成率", "100%", "55%"],
    ["", "", "", "A全達成", "◎", "◎"],
    ["", "", "", "連続日数", "#REF!", "#REF!"],
  );
  return toCsv(rows);
}

describe("CSV", () => {
  it("セル内の改行・カンマ・引用符を保つ", () => {
    const g = parseCsv('a,"b\nc","d,""e"""\r\n1,2,3\r\n');
    expect(g).toEqual([
      ["a", "b\nc", 'd,"e"'],
      ["1", "2", "3"],
    ]);
  });
  it("書き出しと読み込みが往復する", () => {
    const rows = [
      ["x", "改行\nあり", 'q"q'],
      ["1", "", "3,000,000"],
    ];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
  });
});

describe("値の読み取り", () => {
  it("時刻・金額", () => {
    expect(parseTime("6:00")).toBe("06:00");
    expect(parseTime("22:15:00")).toBe("22:15");
    expect(parseTime("24:30")).toBe("00:30");
    expect(parseTime("")).toBeNull();
    expect(parseYen("3,000,000")).toBe(3000000);
    expect(parseYen("¥2,400,000")).toBe(2400000);
    expect(parseYen("")).toBeNull();
  });
  it("年の無い日付は2026年から始め、月が戻ったら翌年", () => {
    const y = new YearTracker();
    expect(["10/13", "11/1", "12/31", "1/1", "2/3"].map((d) => y.date(d))).toEqual([
      "2026-10-13",
      "2026-11-01",
      "2026-12-31",
      "2027-01-01",
      "2027-02-03",
    ]);
  });
  it("ファイル名からシートを推測", () => {
    expect(detectSheet("大野 日別目標 - 日次チェック.csv")).toBe("daily");
    expect(detectSheet("大野 日別目標 - ゴール.csv")).toBe("pillars");
    expect(detectSheet("x.csv")).toBeNull();
  });
});

describe("日次チェック", () => {
  it("10/13(全✓)は100%・◎、10/14(24点)は55%", () => {
    const warnings: string[] = [];
    const d = parseDaily(parseCsv(dailyCsv()), names, warnings);
    expect(warnings).toEqual([]);
    expect(d.dates).toEqual(["2026-10-13", "2026-10-14"]);
    expect(d.checkCount).toBe(28);
    expect(d.entries.get("2026-10-13")).toMatchObject({
      wake_time: "06:00",
      declaration: "1行目\n2行目",
      sleep_time: "23:00",
      gratitude: "a\nb\nc",
    });
    expect(d.entries.get("2026-10-14")).toMatchObject({ sleep_time: "00:30", memo: "TODO" });

    const defs: HabitDef[] = seed.map((h) => ({
      id: h.name,
      priority: h.priority as Priority,
      pillar_label: h.pillar_label,
      active_from: "2026-10-13",
      archived_on: null,
      versions: [{ valid_from: "2026-10-13", priority: h.priority as Priority }],
    }));
    const checks: ChecksByDate = new Map([...d.checks].map(([k, v]) => [k, new Set(v)]));
    const d13 = scoreDay(defs, checks.get("2026-10-13"), "2026-10-13");
    const d14 = scoreDay(defs, checks.get("2026-10-14"), "2026-10-14");
    expect([d13.score, Math.round(d13.rate * 100), d13.allA]).toEqual([44, 100, true]);
    expect([d14.score, Math.round(d14.rate * 100)]).toEqual([24, 55]);
  });
  it("知らない行は警告して飛ばす", () => {
    const w: string[] = [];
    parseDaily(parseCsv(toCsv([["", "", "", "", "10/13"], ["", "", "", "謎の行", "✓"]])), names, w);
    expect(w[0]).toContain("謎の行");
  });
  it("プレビューの件数", () => {
    const plan = buildPlan([{ kind: "daily", grid: parseCsv(dailyCsv()) }], names);
    expect(summarizePlan(plan)).toEqual(["日次記録 2日分", "✓ 28件"]);
  });
});

describe("習慣リスト", () => {
  it("見出しで列を探し、結合セルの時間帯を引き継ぐ", () => {
    const csv = toCsv([
      ["No", "時間帯", "時刻", "習慣", "優先度", "紐づく柱", "If-Then", "20秒の準備"],
      ["1", "朝", "6:00", "スマホを見ずに水を1杯", "A", "規則正しい生活", "起きたら→水", "枕元に水"],
      ["2", "", "6:05", "深呼吸・感謝・アファメーション", "B", "揺るがない自信", "", ""],
      ["8", "日中", "—", "誰か1人を褒める", "B", "人への思いやり", "", ""],
    ]);
    const hs = parseHabits(parseCsv(csv), []);
    expect(hs.map((h) => [h.time_slot, h.priority])).toEqual([
      ["morning", "A"],
      ["morning", "B"],
      ["daytime", "B"],
    ]);
    expect(hs[0]).toMatchObject({ if_then: "起きたら→水", prep_20sec: "枕元に水", pillar_label: "規則正しい生活" });
  });
});

describe("目標の全体像", () => {
  it("最終目標・恩返しリスト・月次売上", () => {
    const csv = toCsv([
      ["最終目標", "テスト最終目標"],
      ["中間目標", "テスト中間目標"],
      [],
      ["名前", "関係", "受けた恩", "恩返しの形", "今の進み具合", "次にやること"],
      ["Aさん", "恩師", "教え", "報告", "準備中", "連絡"],
      ["※いつまでに・いくらを書いておく", "", "", "", "", ""],
      [],
      ["月", "目標", "実績", "差額", "達成率", "累計", "うまくいったこと", "課題", "来月の打ち手"],
      ["2026/10", "3,000,000", "2,400,000", "", "", "", "良", "課", "打"],
      ["11月", "3,000,000", "", "", "", "", "", "", ""],
      [],
      ["300万円を達成した月数", "", "0"],
    ]);
    const g = parseGoals(parseCsv(csv), []);
    expect(g.final_goal).toBe("テスト最終目標");
    expect(g.mid_goal).toBe("テスト中間目標");
    expect(g.benefactors).toEqual([
      { name: "Aさん", relation: "恩師", received: "教え", plan: "報告", progress: "準備中", next_action: "連絡" },
    ]);
    expect(g.sales).toEqual([
      { month: "2026-10-01", target_yen: 3000000, actual_yen: 2400000, went_well: "良", issues: "課", next_actions: "打" },
    ]);
  });
});

describe("ゴール(5つの柱)", () => {
  it("見出しが縦・柱が横に並ぶ形", () => {
    const csv = toCsv([
      ["柱", "規則正しい生活", "筋トレの継続"],
      ["Why", "朝を整える", "体力"],
      ["3ヶ月目標", "毎日23時就寝", "週5回"],
      ["測る指標", "就寝時刻", "回数"],
      ["願望", "w1", "w2"],
      ["達成したときの気分", "o1", "o2"],
      ["障害", "夜更かし", "疲れ"],
      ["", "スマホ", ""],
      ["対策", "21:30に充電", "朝にやる"],
    ]);
    const ps = parsePillars(parseCsv(csv), []);
    expect(ps.map((p) => p.name)).toEqual(["規則正しい生活", "筋トレの継続"]);
    expect(ps[0]).toMatchObject({
      why: "朝を整える",
      three_month_goal: "毎日23時就寝",
      woop_obstacle: "夜更かし\nスマホ",
      woop_plan: "21:30に充電",
    });
  });
  it("見出しが横・柱が1行ずつの形", () => {
    const csv = toCsv([
      ["柱", "Why", "3ヶ月目標", "測る指標", "願望", "気分", "障害", "対策"],
      ["掃除", "気持ちよく", "毎日5分", "日数", "w", "o", "面倒", "タイマー"],
      ["", "", "", "", "", "", "時間がない", ""],
    ]);
    const ps = parsePillars(parseCsv(csv), []);
    expect(ps).toHaveLength(1);
    expect(ps[0]).toMatchObject({ name: "掃除", woop_obstacle: "面倒\n時間がない", woop_plan: "タイマー" });
  });
});

describe("週次レビュー・アファメーション・ご褒美", () => {
  it("週次レビューは月曜にそろえる", () => {
    const csv = toCsv([
      ["週", "平均達成率", "一番崩れた習慣", "原因", "If-Thenの修正", "来週の大きな石"],
      ["10/14〜10/20", "80%", "読書10分", "疲れ", "朝にする", "企画書"],
    ]);
    expect(parseReviews(parseCsv(csv), [])).toEqual([
      { week_start: "2026-10-12", worst_habit_name: "読書10分", cause: "疲れ", if_then_fix: "朝にする", next_big_rock: "企画書" },
    ]);
  });
  it("アファメーションは1行1文", () => {
    expect(parseAffirmations(parseCsv(toCsv([["アファメーション"], ["1", "私はできる"], ["私は感謝している"], []])))).toEqual([
      "私はできる",
      "私は感謝している",
    ]);
  });
  it("実際のご褒美シートの形(「1週:」、見出しの横の気分転換リスト)", () => {
    const csv = toCsv([
      ["ご褒美ルール・気分転換リスト", "", "", "", ""],
      ["ルールは点数とA全達成の両方を条件にしています。", "", "", "", ""],
      ["週の目標達成率", "", "75%", "", ""],
      ["ご褒美に必要なA全達成日数", "", "5", "", ""],
      ["ご褒美(週の条件クリアで1つ)", "", "", "", "気分転換リスト(やる気が落ちたとき)"],
      ["1週:自炊", "", "", "", "電話する"],
      ["2週:3,000円以内で買う", "", "", "", ""],
      ["以降繰り返し", "", "", "", "散歩"],
      ["※自分で決めて書き込んでください。", "", "", "", ""],
    ]);
    expect(parseRewards(parseCsv(csv), [])).toEqual({ steps: ["自炊", "3,000円以内で買う"], rate: 0.75, aDays: 5, moodBoosters: ["電話する", "散歩"] });
  });
  it("週次レビューのタイトル行を見出しと取り違えない", () => {
    const csv = toCsv([
      ["週次レビュー(毎週日曜の夜)"],
      ["週(月曜)", "日曜", "平均達成率", "点数合計", "A全達成日数", "ご褒美", "一番崩れた習慣", "原因", "If-Thenの修正", "来週の大きな石"],
      ["10/12", "10/18", "77%", "68", "1", "", "", "", "", ""],
      ["10/19", "10/25", "", "", "", "", "読書10分", "", "", ""],
    ]);
    const w: string[] = [];
    expect(parseReviews(parseCsv(csv), w).map((r) => [r.week_start, r.worst_habit_name])).toEqual([["2026-10-19", "読書10分"]]);
    expect(w).toEqual([]);
  });
  it("柱と習慣の照合", () => {
    expect(pillarMatches("掃除・身なり", "身なり")).toBe(true);
    expect(pillarMatches("規則正しい生活", "規則正しい生活")).toBe(true);
    expect(pillarMatches("掃除・身なり", "学び・成長")).toBe(false);
  });
  it("ご褒美の段・ルール・気分転換リスト", () => {
    const csv = toCsv([
      ["週の目標達成率", "80%"],
      ["A全達成", "6日以上"],
      ["1週目", "自炊"],
      ["2週目", "映画"],
      [],
      ["気分転換リスト"],
      ["散歩"],
      ["サウナ"],
    ]);
    expect(parseRewards(parseCsv(csv), [])).toEqual({ steps: ["自炊", "映画"], rate: 0.8, aDays: 6, moodBoosters: ["散歩", "サウナ"] });
  });
});
