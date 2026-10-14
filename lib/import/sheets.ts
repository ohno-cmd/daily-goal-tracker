// スプレッドシートの各シート(CSV)を読み取り、保存する内容(ImportPlan)にする。純粋関数(SPEC 6.1)
import { weekStartOf, type DateStr } from "../dates";
import type { Priority } from "../scoring";
import type { TimeSlot } from "../types";
import type { Grid } from "./csv";

export type SheetKind = "habits" | "daily" | "goals" | "pillars" | "reviews" | "affirmations" | "rewards";

export const SHEETS: { kind: SheetKind; label: string; match: RegExp }[] = [
  { kind: "habits", label: "習慣リスト", match: /習慣リスト/ },
  { kind: "daily", label: "日次チェック", match: /日次チェック/ },
  { kind: "goals", label: "目標の全体像", match: /目標の全体像/ },
  { kind: "pillars", label: "ゴール(5つの柱)", match: /ゴール/ },
  { kind: "reviews", label: "週次レビュー", match: /週次レビュー/ },
  { kind: "affirmations", label: "アファメーション", match: /アファメーション/ },
  { kind: "rewards", label: "ご褒美", match: /ご褒美/ },
];

/** ファイル名からシートを推測する(Googleの書き出しは「ファイル名 - シート名.csv」) */
export function detectSheet(fileName: string): SheetKind | null {
  return SHEETS.find((s) => s.match.test(fileName.normalize("NFKC")))?.kind ?? null;
}

// ───────── 共通 ─────────

/** 比較用:全角半角・空白・波線の違いを吸収 */
export function normName(s: string): string {
  return s
    .normalize("NFKC")
    .replace(/[\s　]/g, "")
    .replace(/[〜～~]/g, "~")
    .toLowerCase();
}

const t = (v: string | undefined) => (v ?? "").trim();
const isBlankRow = (r: string[]) => r.every((c) => !c.trim());

/** "6:00" "06:00:00" "24:30" → "06:00"(24時以降は0時台にする) */
export function parseTime(v: string): string | null {
  const m = v.normalize("NFKC").match(/(\d{1,2})\s*:\s*(\d{2})/);
  if (!m) return null;
  const h = Number(m[1]) % 24;
  const min = Number(m[2]);
  if (min > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

/** "3,000,000" "¥3,000,000" "3000000円" → 3000000。空なら null */
export function parseYen(v: string): number | null {
  const s = v.normalize("NFKC").replace(/[,¥\\円\s]/g, "");
  if (!s || s === "-") return null;
  const m = s.match(/^-?\d+(\.\d+)?/);
  return m ? Math.round(Number(m[0])) : null;
}

/** "80%" "0.8" "80" → 0.8 */
export function parseRate(v: string): number | null {
  const s = v.normalize("NFKC").replace(/\s/g, "");
  const m = s.match(/(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const n = Number(m[1]);
  return s.includes("%") || n > 1 ? n / 100 : n;
}

/**
 * 年の無い "10/13" を順に日付にする。2026年から始め、月が前より小さくなったら翌年
 */
export class YearTracker {
  private year: number;
  private lastMonth = 0;
  constructor(startYear = 2026) {
    this.year = startYear;
  }
  date(text: string): DateStr | null {
    const s = text.normalize("NFKC");
    const full = s.match(/(\d{4})\s*[\/\-年.]\s*(\d{1,2})\s*[\/\-月.]\s*(\d{1,2})/);
    if (full) {
      this.year = Number(full[1]);
      this.lastMonth = Number(full[2]);
      return ymd(this.year, Number(full[2]), Number(full[3]));
    }
    const md = s.match(/(\d{1,2})\s*[\/月]\s*(\d{1,2})/);
    if (!md) return null;
    const m = Number(md[1]);
    if (this.lastMonth && m < this.lastMonth) this.year++;
    this.lastMonth = m;
    return ymd(this.year, m, Number(md[2]));
  }
  month(text: string): DateStr | null {
    const s = text.normalize("NFKC");
    const full = s.match(/(\d{4})\s*[\/\-年.]\s*(\d{1,2})/);
    if (full) {
      this.year = Number(full[1]);
      this.lastMonth = Number(full[2]);
      return ymd(this.year, Number(full[2]), 1);
    }
    const m1 = s.match(/^(\d{1,2})\s*月/) ?? s.match(/^(\d{1,2})(?:\s*\/\s*\d{1,2})?$/);
    if (!m1) return null;
    const m = Number(m1[1]);
    if (this.lastMonth && m < this.lastMonth) this.year++;
    this.lastMonth = m;
    return ymd(this.year, m, 1);
  }
}

function ymd(y: number, m: number, d: number): DateStr | null {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCMonth() !== m - 1) return null;
  return dt.toISOString().slice(0, 10);
}

/** ヘッダー行を探し、列名 → 列番号を返す */
function findHeader(grid: Grid, cols: Record<string, RegExp>, required: string[]): { row: number; idx: Record<string, number> } | null {
  for (let r = 0; r < grid.length; r++) {
    const idx: Record<string, number> = {};
    for (const [key, re] of Object.entries(cols)) {
      const c = grid[r].findIndex((v, i) => re.test(t(v).normalize("NFKC")) && !Object.values(idx).includes(i));
      if (c >= 0) idx[key] = c;
    }
    if (required.every((k) => k in idx)) return { row: r, idx };
  }
  return null;
}

/** ラベルのセルを探し、右(無ければ下)の値を返す */
function labeled(grid: Grid, re: RegExp): string | undefined {
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      const v = t(grid[r][c]).normalize("NFKC");
      if (!re.test(v) || v.length > 20) continue;
      const right = grid[r].slice(c + 1).find((x) => t(x));
      if (right) return t(right);
      const below = t(grid[r + 1]?.[c]);
      if (below) return below;
    }
  }
  return undefined;
}

// ───────── 習慣リスト ─────────

export interface HabitImport {
  name: string;
  time_slot: TimeSlot;
  time_label: string;
  priority: Priority;
  pillar_label: string;
  if_then: string;
  prep_20sec: string;
}

const SLOT: Record<string, TimeSlot> = { 朝: "morning", 日中: "daytime", 昼: "daytime", 夜: "night" };

export function parseHabits(grid: Grid, warnings: string[]): HabitImport[] {
  const h = findHeader(
    grid,
    {
      name: /^習慣(名)?$/,
      priority: /^優先度/,
      slot: /^時間帯/,
      time: /^時刻/,
      pillar: /柱/,
      ifThen: /^if/i,
      prep: /20秒/,
    },
    ["name", "priority"],
  );
  if (!h) {
    warnings.push("習慣リスト:「習慣」「優先度」の見出しが見つかりませんでした。");
    return [];
  }
  const out: HabitImport[] = [];
  let slot: TimeSlot = "morning";
  for (const row of grid.slice(h.row + 1)) {
    const name = t(row[h.idx.name]);
    if (!name) continue;
    const s = t(row[h.idx.slot]);
    if (s && SLOT[s]) slot = SLOT[s];
    const p = t(row[h.idx.priority]).normalize("NFKC").toUpperCase();
    if (!p) continue; // 「1日の満点」などの行
    if (!["A", "B", "C"].includes(p)) {
      warnings.push(`習慣リスト:「${name}」の優先度「${p}」が A/B/C ではないので飛ばしました。`);
      continue;
    }
    out.push({
      name,
      time_slot: slot,
      time_label: t(row[h.idx.time]),
      priority: p as Priority,
      pillar_label: t(row[h.idx.pillar]),
      if_then: t(row[h.idx.ifThen]),
      prep_20sec: t(row[h.idx.prep]),
    });
  }
  return out;
}

// ───────── 日次チェック ─────────

export interface DailyImport {
  dates: DateStr[];
  entries: Map<DateStr, { wake_time?: string | null; declaration?: string; sleep_time?: string | null; gratitude?: string; memo?: string }>;
  /** 日付 → ✓した習慣名 */
  checks: Map<DateStr, string[]>;
  checkCount: number;
  /** 習慣名の行(✓が無くても、その日の記録として上書きする) */
  habitRows: string[];
}

const IGNORED_ROWS = /^(点数|満点|達成率|A全達成|◎|連続|合計|曜日)/;
const CHECK_MARK = /^(✓|✔|☑|✅|○|◯|〇|true|1|済)$/i;

/** 項目名の列(4列目)と日付の列(5列目以降)を読む */
export function parseDaily(grid: Grid, habitNames: string[], warnings: string[]): DailyImport {
  const known = new Map(habitNames.map((n) => [normName(n), n]));
  const result: DailyImport = { dates: [], entries: new Map(), checks: new Map(), checkCount: 0, habitRows: [] };

  // 日付の見出し行:5列目以降に「10/13」形式のセルが並ぶ行
  const headerRow = grid.findIndex((r) => r.slice(4).filter((c) => /^\s*\d{1,2}\s*\/\s*\d{1,2}/.test(c.normalize("NFKC"))).length >= 1);
  if (headerRow < 0) {
    warnings.push("日次チェック:5列目以降に「10/13」のような日付の見出しが見つかりませんでした。");
    return result;
  }
  const years = new YearTracker();
  const dateCols: { col: number; date: DateStr }[] = [];
  grid[headerRow].forEach((c, i) => {
    if (i < 4 || !c.trim()) return;
    const d = years.date(c);
    if (d) dateCols.push({ col: i, date: d });
  });
  result.dates = dateCols.map((d) => d.date);
  for (const { date } of dateCols) result.entries.set(date, {});

  const unknown: string[] = [];
  for (const row of grid.slice(headerRow + 1)) {
    const label = t(row[3]) || t(row.slice(0, 3).reverse().find((c) => t(c)));
    if (!label) continue;
    const L = label.normalize("NFKC");
    // 習慣名を先に見る(「今日の宣言を書く」を「今日の宣言」の行と取り違えない)
    const habit = known.get(normName(label));
    if (habit) {
      result.habitRows.push(habit);
      for (const { col, date } of dateCols) {
        if (!CHECK_MARK.test(t(row[col]).normalize("NFKC"))) continue;
        result.checks.set(date, [...(result.checks.get(date) ?? []), habit]);
        result.checkCount++;
      }
      continue;
    }
    const field = L.startsWith("起床時刻")
      ? "wake_time"
      : L.startsWith("今日の宣言")
        ? "declaration"
        : L.startsWith("就寝時刻")
          ? "sleep_time"
          : L.startsWith("感謝")
            ? "gratitude"
            : L.startsWith("メモ")
              ? "memo"
              : null;
    if (field) {
      for (const { col, date } of dateCols) {
        const v = row[col] ?? "";
        const e = result.entries.get(date)!;
        if (field === "wake_time" || field === "sleep_time") e[field] = parseTime(v);
        else e[field] = v.trim();
      }
      continue;
    }
    if (IGNORED_ROWS.test(L) || /^(朝|日中|夜)$/.test(L)) continue;
    unknown.push(label);
  }
  if (unknown.length) warnings.push(`日次チェック:習慣と一致しない行を飛ばしました(${unknown.slice(0, 5).join("、")}${unknown.length > 5 ? " ほか" : ""})。`);
  // 日付はあるが中身が空の列は取り込まない
  result.dates = result.dates.filter((d) => {
    const e = result.entries.get(d)!;
    const has = Object.values(e).some((v) => v) || result.checks.has(d);
    if (!has) result.entries.delete(d);
    return has;
  });
  return result;
}

// ───────── 目標の全体像 ─────────

export interface BenefactorImport {
  name: string;
  relation: string;
  received: string;
  plan: string;
  progress: string;
  next_action: string;
}

export interface SalesImport {
  month: DateStr;
  target_yen: number | null;
  actual_yen: number | null;
  went_well: string;
  issues: string;
  next_actions: string;
}

export interface GoalsImport {
  final_goal?: string;
  mid_goal?: string;
  three_month_note?: string;
  benefactors: BenefactorImport[];
  sales: SalesImport[];
}

const DEFAULT_TARGET = 3_000_000;

export function parseGoals(grid: Grid, warnings: string[]): GoalsImport {
  const out: GoalsImport = {
    final_goal: labeled(grid, /^最終目標/),
    mid_goal: labeled(grid, /^中間目標/),
    three_month_note: labeled(grid, /^(3|3)(ヶ|か|カ)月目標/),
    benefactors: [],
    sales: [],
  };

  const b = findHeader(
    grid,
    { name: /^(名前|氏名|恩返ししたい人)/, relation: /関係/, received: /受けた恩/, plan: /恩返しの形/, progress: /進み具合|進捗/, next: /次にやること|次の一手/ },
    ["name", "received"],
  );
  if (b) {
    for (const row of grid.slice(b.row + 1)) {
      const v = (k: string) => (k in b.idx ? t(row[b.idx[k]]) : "");
      if (isBlankRow(row) || (!v("name") && !v("received"))) break;
      if (v("name").startsWith("※")) break;
      if (!v("name")) continue;
      out.benefactors.push({ name: v("name"), relation: v("relation"), received: v("received"), plan: v("plan"), progress: v("progress"), next_action: v("next") });
    }
  }

  const s = findHeader(
    grid,
    { month: /^(月|年月)$/, target: /目標/, actual: /実績/, well: /うまくいった/, issues: /課題/, next: /打ち手|来月/ },
    ["month", "actual"],
  );
  if (s) {
    const years = new YearTracker();
    for (const row of grid.slice(s.row + 1)) {
      const v = (k: string) => (k in s.idx ? t(row[s.idx[k]]) : "");
      if (isBlankRow(row)) break;
      const month = v("month") ? years.month(v("month")) : null;
      if (!month) continue;
      const sale: SalesImport = {
        month,
        target_yen: parseYen(v("target")),
        actual_yen: parseYen(v("actual")),
        went_well: v("well"),
        issues: v("issues"),
        next_actions: v("next"),
      };
      // 実績も振り返りも無く、目標が初期値のままの月(先の月の空行)は取り込まない
      const empty = sale.actual_yen == null && !sale.went_well && !sale.issues && !sale.next_actions;
      if (empty && (sale.target_yen == null || sale.target_yen === DEFAULT_TARGET)) continue;
      out.sales.push(sale);
    }
  }
  if (!out.final_goal && !out.mid_goal && !out.benefactors.length && !out.sales.length)
    warnings.push("目標の全体像:最終目標・中間目標・恩返しリスト・月次売上のどれも見つかりませんでした。");
  return out;
}

// ───────── ゴール(5つの柱) ─────────

export interface PillarImport {
  name: string;
  why: string;
  three_month_goal: string;
  metric: string;
  woop_wish: string;
  woop_outcome: string;
  woop_obstacle: string;
  woop_plan: string;
}

type PillarField = keyof PillarImport;

/** 見出しの文言 → 項目(上から順に判定) */
function pillarField(label: string): PillarField | null {
  const s = label.normalize("NFKC").trim();
  if (!s || s.length > 30) return null;
  if (/(3|三)\s*(ヶ|か|カ|ケ)?\s*月/.test(s)) return "three_month_goal";
  if (/指標/.test(s)) return "metric";
  if (/願望|wish/i.test(s)) return "woop_wish";
  if (/気分|成果|outcome/i.test(s)) return "woop_outcome";
  if (/障害|obstacle/i.test(s)) return "woop_obstacle";
  if (/対策|plan|if.?then/i.test(s)) return "woop_plan";
  if (/^why|なぜ/i.test(s)) return "why";
  if (/柱|ゴール名|^ゴール$|項目|テーマ/.test(s)) return "name";
  return null;
}

const emptyPillar = (): PillarImport => ({ name: "", why: "", three_month_goal: "", metric: "", woop_wish: "", woop_outcome: "", woop_obstacle: "", woop_plan: "" });

function append(p: PillarImport, f: PillarField, v: string) {
  if (!v) return;
  p[f] = p[f] ? `${p[f]}\n${v}` : v;
}

/**
 * 3つの形に対応する:
 *  (1) 見出しが横に並び、柱が1行ずつ
 *  (2) 見出しが縦に並び、柱が1列ずつ
 *  (3) 柱ごとのブロックが縦に続く(見出し列+値列)
 * 見出しの無い行は直前の項目の続き(障害・対策の複数行)として扱う
 */
export function parsePillars(grid: Grid, warnings: string[]): PillarImport[] {
  // (1) 横の見出し
  for (let r = 0; r < grid.length; r++) {
    const fields = grid[r].map((c) => pillarField(c));
    const n = new Set(fields.filter(Boolean)).size;
    if (n >= 3 && fields.includes("name")) {
      const out: PillarImport[] = [];
      let cur: PillarImport | null = null;
      for (const row of grid.slice(r + 1)) {
        if (isBlankRow(row)) continue;
        const nameCol = fields.indexOf("name");
        const name = t(row[nameCol]);
        if (name) {
          cur = emptyPillar();
          out.push(cur);
        }
        if (!cur) continue;
        fields.forEach((f, i) => f && f !== "name" && append(cur!, f, t(row[i])));
        if (name) cur.name = name;
      }
      return out.filter((p) => p.name);
    }
  }

  // (2)(3) 縦の見出し:見出しが3つ以上ある列を探す
  let labelCol = -1;
  for (let c = 0; c < 6 && labelCol < 0; c++) {
    if (new Set(grid.map((r) => pillarField(r[c] ?? "")).filter(Boolean)).size >= 3) labelCol = c;
  }
  if (labelCol < 0) {
    warnings.push("ゴール:「Why」「3ヶ月目標」「障害」などの見出しが見つかりませんでした。");
    return [];
  }
  const valueCols = new Set<number>();
  for (const row of grid) {
    if (!pillarField(row[labelCol] ?? "")) continue;
    row.forEach((v, i) => i > labelCol && t(v) && valueCols.add(i));
  }
  const out: PillarImport[] = [];
  for (const col of [...valueCols].sort((a, b) => a - b)) {
    let cur: PillarImport | null = null;
    let field: PillarField | null = null;
    for (const row of grid) {
      const f = pillarField(row[labelCol] ?? "");
      const v = t(row[col]);
      if (f) field = f;
      else if (t(row[labelCol])) field = null; // 別の見出し
      if (!field) continue;
      if (field === "name") {
        if (!v) continue;
        cur = emptyPillar();
        cur.name = v;
        out.push(cur);
        continue;
      }
      if (!cur) {
        cur = emptyPillar();
        out.push(cur);
      }
      append(cur, field, v);
    }
  }
  // 名前の無い柱は「柱1」…とする
  out.forEach((p, i) => (p.name ||= `柱${i + 1}`));
  return out.filter((p) => Object.entries(p).some(([k, v]) => k !== "name" && v));
}

/** 習慣の「紐づく柱」がその柱に当たるか。「掃除・身なり」の柱は「掃除」「身なり」も含む */
export function pillarMatches(pillarName: string, label: string): boolean {
  const p = normName(pillarName);
  const l = normName(label);
  if (!p || !l) return false;
  return p === l || pillarName.split(/[・、,/]/).some((part) => normName(part) === l);
}

// ───────── 週次レビュー ─────────

export interface ReviewImport {
  week_start: DateStr;
  worst_habit_name: string;
  cause: string;
  if_then_fix: string;
  next_big_rock: string;
}

export function parseReviews(grid: Grid, warnings: string[]): ReviewImport[] {
  const h = findHeader(
    grid,
    { week: /^(週|期間|週の始まり|開始日)/, worst: /崩れた/, cause: /原因/, fix: /if/i, rock: /大きな石/ },
    ["week", "worst"],
  );
  if (!h) {
    warnings.push("週次レビュー:「週」「一番崩れた習慣」「原因」などの見出しが見つかりませんでした。");
    return [];
  }
  const years = new YearTracker();
  const out: ReviewImport[] = [];
  for (const row of grid.slice(h.row + 1)) {
    const v = (k: string) => (k in h.idx ? t(row[h.idx[k]]) : "");
    const d = v("week") ? years.date(v("week")) : null;
    if (!d) continue;
    const r = { week_start: weekStartOf(d), worst_habit_name: v("worst"), cause: v("cause"), if_then_fix: v("fix"), next_big_rock: v("rock") };
    if (r.worst_habit_name || r.cause || r.if_then_fix || r.next_big_rock) out.push(r);
  }
  return out;
}

// ───────── アファメーション ─────────

export function parseAffirmations(grid: Grid): string[] {
  const out: string[] = [];
  for (const row of grid) {
    const v = row.map((c) => t(c)).find((c) => c && !/^(no\.?|#|\d+\.?)$/i.test(c.normalize("NFKC")));
    if (!v || /^アファメーション$/.test(v)) continue;
    out.push(v);
  }
  return out;
}

// ───────── ご褒美 ─────────

export interface RewardsImport {
  steps: string[];
  rate?: number;
  aDays?: number;
  moodBoosters: string[];
}

export function parseRewards(grid: Grid, warnings: string[]): RewardsImport {
  const steps = new Map<number, string>();
  let rate: number | undefined;
  let aDays: number | undefined;
  for (const row of grid) {
    row.forEach((c, i) => {
      const s = t(c).normalize("NFKC");
      // 「1週目 自炊」「1週:自炊」の両方
      const m = s.match(/^(\d+)\s*週目?(?=[\s::]|$)/);
      if (m) {
        const text = s.replace(/^(\d+)\s*週目?\s*[::]?\s*/, "") || t(row.slice(i + 1).find((x) => t(x)));
        if (text) steps.set(Number(m[1]), text);
      }
      if (/目標達成率|達成率/.test(s) && rate == null) {
        const v = row.slice(i + 1).map((x) => parseRate(x)).find((x) => x != null) ?? parseRate(s.replace(/.*達成率/, ""));
        if (v != null && v > 0 && v <= 1) rate = v;
      }
      if (/A全達成/.test(s) && aDays == null) {
        const src = [s.replace(/.*A全達成/, ""), ...row.slice(i + 1)].join(" ").normalize("NFKC");
        const n = src.match(/(\d+)\s*日/) ?? src.match(/(\d+)/);
        if (n && Number(n[1]) <= 7) aDays = Number(n[1]);
      }
    });
  }

  // 気分転換リスト:見出しの下に続く行
  const moodBoosters: string[] = [];
  for (let r = 0; r < grid.length; r++) {
    // 「気分転換」で始まる見出しの下の、同じ列だけを読む
    const c = grid[r].findIndex((x) => t(x).startsWith("気分転換"));
    if (c < 0) continue;
    for (const row of grid.slice(r + 1)) {
      const v = t(row[c]);
      if (v.startsWith("※")) break;
      if (v) moodBoosters.push(v);
    }
    break;
  }

  if (!steps.size) warnings.push("ご褒美:「1週目」のような段が見つかりませんでした。");
  const n = Math.max(0, ...steps.keys());
  return {
    steps: Array.from({ length: n }, (_, i) => steps.get(i + 1) ?? ""),
    rate,
    aDays,
    moodBoosters,
  };
}

// ───────── まとめ ─────────

export interface ImportPlan {
  habits?: HabitImport[];
  daily?: DailyImport;
  goals?: GoalsImport;
  pillars?: PillarImport[];
  reviews?: ReviewImport[];
  affirmations?: string[];
  rewards?: RewardsImport;
  warnings: string[];
}

/**
 * 複数のシートを読み、1つの計画にする。
 * 日次チェック・週次レビューの習慣名は、登録済みの習慣と、同時に取り込む習慣リストの両方で照合する
 */
export function buildPlan(files: { kind: SheetKind; grid: Grid }[], existingHabitNames: string[]): ImportPlan {
  const plan: ImportPlan = { warnings: [] };
  const w = plan.warnings;
  for (const f of files.filter((f) => f.kind === "habits")) plan.habits = parseHabits(f.grid, w);
  const names = [...existingHabitNames, ...(plan.habits?.map((h) => h.name) ?? [])];
  for (const f of files) {
    if (f.kind === "daily") plan.daily = parseDaily(f.grid, names, w);
    if (f.kind === "goals") plan.goals = parseGoals(f.grid, w);
    if (f.kind === "pillars") plan.pillars = parsePillars(f.grid, w);
    if (f.kind === "reviews") plan.reviews = parseReviews(f.grid, w);
    if (f.kind === "affirmations") plan.affirmations = parseAffirmations(f.grid);
    if (f.kind === "rewards") plan.rewards = parseRewards(f.grid, w);
  }
  if (plan.reviews) {
    const known = new Set(names.map(normName));
    const missing = plan.reviews.filter((r) => r.worst_habit_name && !known.has(normName(r.worst_habit_name)));
    if (missing.length) w.push(`週次レビュー:習慣と一致しない「一番崩れた習慣」が${missing.length}件あります(空欄で取り込みます)。`);
  }
  return plan;
}

/** プレビュー用の件数 */
export function summarizePlan(p: ImportPlan): string[] {
  const out: string[] = [];
  if (p.habits) out.push(`習慣 ${p.habits.length}件`);
  if (p.daily) out.push(`日次記録 ${p.daily.dates.length}日分`, `✓ ${p.daily.checkCount}件`);
  if (p.goals) {
    if (p.goals.final_goal || p.goals.mid_goal) out.push("最終目標・中間目標");
    if (p.goals.benefactors.length) out.push(`恩返しリスト ${p.goals.benefactors.length}人`);
    if (p.goals.sales.length) out.push(`月次売上 ${p.goals.sales.length}か月分`);
  }
  if (p.pillars) out.push(`5つの柱 ${p.pillars.length}件`);
  if (p.reviews) out.push(`週次レビュー ${p.reviews.length}週分`);
  if (p.affirmations) out.push(`アファメーション ${p.affirmations.length}件`);
  if (p.rewards) {
    out.push(`ご褒美 ${p.rewards.steps.length}段`);
    if (p.rewards.moodBoosters.length) out.push(`気分転換リスト ${p.rewards.moodBoosters.length}件`);
  }
  return out;
}
