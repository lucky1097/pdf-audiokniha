import { nextWords, prevWord } from "./runner.ts";
import {
  cardinal,
  fromRoman,
  MONTHS_DAT,
  MONTHS_GEN,
  MONTHS_LOC,
  MONTHS_NOM,
  ordinal,
  plural,
  type Case,
  type Gender,
} from "./sk-numbers.ts";
import type { Rule, RuleResult } from "./types.ts";

// --- grammatical context ---------------------------------------------------------------------

const PREP_CASES: Record<string, Case[]> = {};
const prep = (cases: Case[], words: string) => words.split(" ").forEach((w) => (PREP_CASES[w] = cases));
prep(["gen"], "do od odo z zo bez u okolo počas podľa vedľa blízko namiesto uprostred pozdĺž pomocou spomedzi spod spoza spred");
prep(["dat"], "k ku kvôli vďaka proti oproti napriek naproti voči");
prep(["loc"], "v vo pri");
prep(["loc", "acc"], "na o po");
prep(["ins"], "s so");
prep(["ins", "acc"], "za pred nad pod medzi");
prep(["acc"], "cez pre");

interface NounInfo {
  g: Gender;
  cases: Case[];
}

// Nouns that commonly follow numbers in books, with every form mapped to its possible cases.
const NOUNS = new Map<string, NounInfo>();
function noun(g: Gender, forms: Partial<Record<Case, string>>): void {
  for (const [c, words] of Object.entries(forms)) {
    for (const w of words!.split("/")) {
      const info = NOUNS.get(w) ?? { g, cases: [] };
      info.cases.push(c as Case);
      NOUNS.set(w, info);
    }
  }
}
noun("n", { nom: "storočie", gen: "storočia", dat: "storočiu", acc: "storočie", loc: "storočí", ins: "storočím" });
noun("n", { nom: "tisícročie", gen: "tisícročia", dat: "tisícročiu", acc: "tisícročie", loc: "tisícročí", ins: "tisícročím" });
noun("n", { nom: "vydanie", gen: "vydania", dat: "vydaniu", acc: "vydanie", loc: "vydaní", ins: "vydaním" });
noun("n", { nom: "poschodie", gen: "poschodia", dat: "poschodiu", acc: "poschodie", loc: "poschodí", ins: "poschodím" });
noun("n", { nom: "výročie", gen: "výročia", dat: "výročiu", acc: "výročie", loc: "výročí", ins: "výročím" });
noun("n", { nom: "miesto", gen: "miesta", dat: "miestu", acc: "miesto", loc: "mieste", ins: "miestom" });
noun("n", { nom: "kolo", gen: "kola", dat: "kolu", acc: "kolo", loc: "kole", ins: "kolom" });
noun("m", { nom: "rok", gen: "roka/roku", dat: "roku", acc: "rok", loc: "roku", ins: "rokom" });
noun("m", { nom: "ročník", gen: "ročníka", dat: "ročníku", acc: "ročník", loc: "ročníku", ins: "ročníkom" });
noun("m", { nom: "diel", gen: "dielu", dat: "dielu", acc: "diel", loc: "dieli", ins: "dielom" });
noun("m", { nom: "deň", gen: "dňa", dat: "dňu", acc: "deň", loc: "dni", ins: "dňom" });
noun("m", { nom: "týždeň", gen: "týždňa", dat: "týždňu", acc: "týždeň", loc: "týždni", ins: "týždňom" });
noun("m", { nom: "mesiac", gen: "mesiaca", dat: "mesiacu", acc: "mesiac", loc: "mesiaci", ins: "mesiacom" });
noun("m", { nom: "zväzok", gen: "zväzku", dat: "zväzku", acc: "zväzok", loc: "zväzku", ins: "zväzkom" });
noun("m", { nom: "stupeň", gen: "stupňa", dat: "stupňu", acc: "stupeň", loc: "stupni", ins: "stupňom" });
noun("f", { nom: "kapitola", gen: "kapitoly", dat: "kapitole", acc: "kapitolu", loc: "kapitole", ins: "kapitolou" });
noun("f", { nom: "časť", gen: "časti", dat: "časti", acc: "časť", loc: "časti", ins: "časťou" });
noun("f", { nom: "strana", gen: "strany", dat: "strane", acc: "stranu", loc: "strane", ins: "stranou" });
noun("f", { nom: "trieda", gen: "triedy", dat: "triede", acc: "triedu", loc: "triede", ins: "triedou" });
noun("f", { nom: "vojna", gen: "vojny", dat: "vojne", acc: "vojnu", loc: "vojne", ins: "vojnou" });
noun("f", { nom: "kniha", gen: "knihy", dat: "knihe", acc: "knihu", loc: "knihe", ins: "knihou" });
noun("f", { nom: "sezóna", gen: "sezóny", dat: "sezóne", acc: "sezónu", loc: "sezóne", ins: "sezónou" });
noun("f", { nom: "generácia", gen: "generácie", dat: "generácii", acc: "generáciu", loc: "generácii", ins: "generáciou" });
noun("f", { nom: "olympiáda", gen: "olympiády", dat: "olympiáde", acc: "olympiádu", loc: "olympiáde", ins: "olympiádou" });

// Adjective endings carry gender and case too ("2. svetová vojna", "v 2. svetovej vojne").
const ADJ_ENDINGS: [string, NounInfo][] = [
  ["ého", { g: "m", cases: ["gen", "acc"] }],
  ["ému", { g: "m", cases: ["dat"] }],
  ["ými", { g: "m", cases: ["ins"] }],
  ["ej", { g: "f", cases: ["gen", "dat", "loc"] }],
  ["ou", { g: "f", cases: ["ins"] }],
  ["om", { g: "m", cases: ["loc"] }],
  ["ým", { g: "m", cases: ["ins"] }],
  ["á", { g: "f", cases: ["nom"] }],
  ["ú", { g: "f", cases: ["acc"] }],
  ["é", { g: "n", cases: ["nom", "acc"] }],
  ["ý", { g: "m", cases: ["nom", "acc"] }],
];

function guessGender(word: string): Gender {
  if (/(?:ie|o|um)$/.test(word)) return "n";
  if (/a$/.test(word)) return "f";
  return "m";
}

interface Grammar {
  gender: Gender;
  case: Case;
  confident: boolean;
}

/** Case and gender for a number at [start, end) from the preposition before it and the words after it. */
export function grammarAt(text: string, start: number, end: number): Grammar {
  const prepCases = PREP_CASES[prevWord(text, start)] ?? null;
  const words = nextWords(text, end, 2);
  let info: NounInfo | null = null;
  for (const w of words) {
    const n = NOUNS.get(w);
    if (n) {
      info = n;
      break;
    }
  }
  if (!info && words[0]) {
    const adj = ADJ_ENDINGS.find(([e]) => words[0].length > e.length + 2 && words[0].endsWith(e));
    if (adj) info = adj[1];
  }
  if (info) {
    if (prepCases) {
      const both = prepCases.filter((c) => info!.cases.includes(c));
      if (both.length) return { gender: info.g, case: both[0], confident: both.length === 1 };
      return { gender: info.g, case: prepCases[0], confident: false };
    }
    const c = info.cases.includes("nom") ? "nom" : info.cases[0];
    return { gender: info.g, case: c, confident: info.cases.length === 1 || c === "nom" };
  }
  return { gender: words[0] ? guessGender(words[0]) : "m", case: prepCases?.[0] ?? "nom", confident: false };
}

/** True when the preposition before `start` puts a following number in a case other than nom/acc. */
function obliqueCase(text: string, start: number): boolean {
  const c = PREP_CASES[prevWord(text, start)];
  return !!c && !c.includes("acc");
}

// --- amounts and units -----------------------------------------------------------------------

export const NUM = String.raw`(?:\d{1,3}(?:[   ]\d{3})+|\d+)(?:,\d+)?`;

interface Amount {
  int: number;
  frac: string | null;
}

function parseAmount(raw: string): Amount {
  const [i, f] = raw.replace(/[   ]/g, "").split(",");
  return { int: Number(i), frac: f ?? null };
}

function fracWords(frac: string): string {
  const zeros = frac.match(/^0*/)![0].length;
  const rest = frac.slice(zeros);
  return [...Array(zeros).fill("nula"), ...(rest ? [cardinal(Number(rest))] : [])].join(" ");
}

/** "1,5" → "jedna celá päť". */
function decimalWords(a: Amount): string {
  const whole = a.int === 1 ? "jedna celá" : a.int >= 2 && a.int <= 4 ? `${cardinal(a.int, "f")} celé` : `${cardinal(a.int)} celých`;
  return `${a.int === 0 ? "nula celá" : whole} ${fracWords(a.frac!)}`;
}

/** Forms: [1, 2–4, 5+, after a decimal]. */
type Forms = [string, string, string, string];

interface Unit {
  gender: Gender;
  forms: Forms;
  /** Currency: subunit forms, read from a two-digit fraction. */
  cents?: { gender: Gender; forms: Forms };
}

const CENT: Unit["cents"] = { gender: "m", forms: ["cent", "centy", "centov", "centu"] };
const UNITS: Record<string, Unit> = {
  "€": { gender: "n", forms: ["euro", "eurá", "eur", "eura"], cents: CENT },
  EUR: { gender: "n", forms: ["euro", "eurá", "eur", "eura"], cents: CENT },
  $: { gender: "m", forms: ["dolár", "doláre", "dolárov", "dolára"], cents: CENT },
  USD: { gender: "m", forms: ["dolár", "doláre", "dolárov", "dolára"], cents: CENT },
  "£": { gender: "f", forms: ["libra", "libry", "libier", "libry"] },
  Kč: { gender: "f", forms: ["koruna", "koruny", "korún", "koruny"], cents: { gender: "m", forms: ["halier", "haliere", "halierov", "haliera"] } },
  Sk: { gender: "f", forms: ["koruna", "koruny", "korún", "koruny"], cents: { gender: "m", forms: ["halier", "haliere", "halierov", "haliera"] } },
  "%": { gender: "n", forms: ["percento", "percentá", "percent", "percenta"] },
  "°C": { gender: "m", forms: ["stupeň Celzia", "stupne Celzia", "stupňov Celzia", "stupňa Celzia"] },
  "°F": { gender: "m", forms: ["stupeň Fahrenheita", "stupne Fahrenheita", "stupňov Fahrenheita", "stupňa Fahrenheita"] },
  "°": { gender: "m", forms: ["stupeň", "stupne", "stupňov", "stupňa"] },
  "km/h": { gender: "m", forms: ["kilometer za hodinu", "kilometre za hodinu", "kilometrov za hodinu", "kilometra za hodinu"] },
  "m²": { gender: "m", forms: ["štvorcový meter", "štvorcové metre", "štvorcových metrov", "štvorcového metra"] },
  "km²": { gender: "m", forms: ["štvorcový kilometer", "štvorcové kilometre", "štvorcových kilometrov", "štvorcového kilometra"] },
  km: { gender: "m", forms: ["kilometer", "kilometre", "kilometrov", "kilometra"] },
  cm: { gender: "m", forms: ["centimeter", "centimetre", "centimetrov", "centimetra"] },
  mm: { gender: "m", forms: ["milimeter", "milimetre", "milimetrov", "milimetra"] },
  m: { gender: "m", forms: ["meter", "metre", "metrov", "metra"] },
  kg: { gender: "m", forms: ["kilogram", "kilogramy", "kilogramov", "kilogramu"] },
  g: { gender: "m", forms: ["gram", "gramy", "gramov", "gramu"] },
  t: { gender: "f", forms: ["tona", "tony", "ton", "tony"] },
  ml: { gender: "m", forms: ["mililiter", "mililitre", "mililitrov", "mililitra"] },
  l: { gender: "m", forms: ["liter", "litre", "litrov", "litra"] },
  ha: { gender: "m", forms: ["hektár", "hektáre", "hektárov", "hektára"] },
  hod: { gender: "f", forms: ["hodina", "hodiny", "hodín", "hodiny"] },
  h: { gender: "f", forms: ["hodina", "hodiny", "hodín", "hodiny"] },
  min: { gender: "f", forms: ["minúta", "minúty", "minút", "minúty"] },
  sek: { gender: "f", forms: ["sekunda", "sekundy", "sekúnd", "sekundy"] },
  s: { gender: "f", forms: ["sekunda", "sekundy", "sekúnd", "sekundy"] },
};
const UNIT_RE = Object.keys(UNITS)
  .sort((a, b) => b.length - a.length)
  .map((k) => k.replace(/[$/]/g, "\\$&"))
  .join("|");

function sayAmount(a: Amount, gender: Gender): string {
  return a.frac === null ? cardinal(a.int, gender) : decimalWords(a);
}

function sayQuantity(a: Amount, unit: Unit): string {
  if (unit.cents && a.frac !== null && a.frac.length === 2) {
    const cents = Number(a.frac);
    const main = `${cardinal(a.int, unit.gender)} ${plural(a.int, unit.forms.slice(0, 3) as [string, string, string])}`;
    if (!cents) return main;
    return `${main} ${cardinal(cents, unit.cents.gender)} ${plural(cents, unit.cents.forms.slice(0, 3) as [string, string, string])}`;
  }
  if (a.frac !== null) return `${decimalWords(a)} ${unit.forms[3]}`;
  return `${cardinal(a.int, unit.gender)} ${plural(a.int, unit.forms.slice(0, 3) as [string, string, string])}`;
}

function kindOf(unitKey: string): "currency" | "percent" | "temperature" | "unit" {
  if (UNITS[unitKey].cents || unitKey === "£") return "currency";
  if (unitKey === "%") return "percent";
  if (unitKey.startsWith("°")) return "temperature";
  return "unit";
}

// --- abbreviations ---------------------------------------------------------------------------

// [abbreviation, spoken, confident]. Spaces in the key match an optional space ("t. j." and "t.j.").
const ABBREVIATIONS: [string, string, boolean][] = [
  ["s. r. o.", "eseró", true],
  ["n. m.", "nad morom", true],
  ["a. s.", "akciová spoločnosť", true],
  ["t. j.", "to jest", true],
  ["t. z.", "to znamená", true],
  ["tzn.", "to znamená", true],
  ["tj.", "to jest", true],
  ["napr.", "napríklad", true],
  ["atď.", "a tak ďalej", true],
  ["a pod.", "a podobne", true],
  ["a i.", "a iné", true],
  ["tzv.", "takzvaný", false],
  ["resp.", "respektíve", true],
  ["príp.", "prípadne", true],
  ["vr.", "vrátane", true],
  ["cca", "približne", true],
  ["max.", "maximálne", true],
  ["pozn.", "poznámka", true],
  ["obr.", "obrázok", true],
  ["tab.", "tabuľka", true],
  ["kap.", "kapitola", true],
  ["roč.", "ročník", true],
  ["zv.", "zväzok", true],
  ["vyd.", "vydanie", true],
  ["str.", "strana", true],
  ["č.", "číslo", true],
  ["mil.", "miliónov", false],
  ["mld.", "miliárd", false],
  ["tis.", "tisíc", false],
  ["sv.", "svätý", false],
  ["ml.", "mladší", true],
  ["Bc.", "bakalár", true],
  ["Mgr.", "magister", true],
  ["Ing.", "inžinier", true],
  ["MUDr.", "doktor", true],
  ["JUDr.", "doktor", true],
  ["PhDr.", "doktor", true],
  ["RNDr.", "doktor", true],
  ["PaedDr.", "doktor", true],
  ["doc.", "docent", true],
  ["prof.", "profesor", true],
  ["PhD.", "pé há dé", true],
];

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const ABBR_MAP = new Map<string, [string, boolean]>();
for (const [k, v, c] of ABBREVIATIONS) {
  ABBR_MAP.set(k.replace(/\s/g, ""), [v, c]);
  if (/^\p{Ll}/u.test(k)) ABBR_MAP.set((k[0].toUpperCase() + k.slice(1)).replace(/\s/g, ""), [v[0].toUpperCase() + v.slice(1), c]);
}
const ABBR_RE = [...ABBREVIATIONS.map((a) => a[0]), ...ABBREVIATIONS.filter((a) => /^\p{Ll}/u.test(a[0])).map((a) => a[0][0].toUpperCase() + a[0].slice(1))]
  .sort((a, b) => b.length - a.length)
  .map((k) => esc(k).replace(/\\?\s/g, "\\s?"))
  .join("|");

// --- rules -----------------------------------------------------------------------------------

const MONTH_FORMS = [...MONTHS_GEN, ...MONTHS_DAT, ...MONTHS_LOC, ...MONTHS_NOM].sort((a, b) => b.length - a.length).join("|");

function monthCase(word: string): Case {
  if (MONTHS_GEN.includes(word)) return "gen";
  if (MONTHS_DAT.includes(word)) return "dat";
  if (MONTHS_LOC.includes(word)) return "loc";
  return "nom";
}

function dayCaseFromPrep(text: string, start: number): Case {
  const c = PREP_CASES[prevWord(text, start)];
  if (!c) return "gen";
  if (c.includes("dat")) return "dat";
  if (c.includes("loc")) return "loc";
  return "gen";
}

const END = String.raw`(?![\p{L}\p{N}])`;

export const SK_RULES: Rule[] = [
  {
    name: "abbreviation",
    re: new RegExp(`(?:${ABBR_RE})(?![\\p{L}])`, "uy"),
    apply(m) {
      const hit = ABBR_MAP.get(m[0].replace(/\s/g, ""));
      return hit ? { spoken: hit[0], kind: "abbreviation", confident: hit[1] } : null;
    },
  },
  {
    // "15. marca", "1.–3. mája"
    name: "date-words",
    re: new RegExp(String.raw`(\d{1,2})\.(?:\s?[–—-]\s?(\d{1,2})\.)?\s?(${MONTH_FORMS})${END}`, "uy"),
    apply(m) {
      const d1 = Number(m[1]);
      const d2 = m[2] ? Number(m[2]) : null;
      if (d1 < 1 || d1 > 31 || (d2 !== null && (d2 < 1 || d2 > 31))) return null;
      const c = monthCase(m[3]);
      const days = d2 === null ? ordinal(d1, "m", c) : `${ordinal(d1, "m", c)} až ${ordinal(d2, "m", c)}`;
      return { spoken: `${days} ${m[3]}`, kind: "date" };
    },
  },
  {
    // "15.3.2024", "15. 3. 2024"
    name: "date-numeric",
    re: /(\d{1,2})\.\s?(\d{1,2})\.\s?(\d{4})(?!\d)/uy,
    apply(m, ctx) {
      const d = Number(m[1]);
      const mo = Number(m[2]);
      if (d < 1 || d > 31 || mo < 1 || mo > 12) return null;
      const c = dayCaseFromPrep(ctx.text, ctx.start);
      const month = c === "dat" ? MONTHS_DAT[mo - 1] : c === "loc" ? MONTHS_LOC[mo - 1] : MONTHS_GEN[mo - 1];
      return { spoken: `${ordinal(d, "m", c)} ${month} ${cardinal(Number(m[3]))}`, kind: "date" };
    },
  },
  {
    // "od 1. 11. – 15. 6.", "do 24. 12." — day and month without a year.
    name: "date-numeric-short",
    re: /(\d{1,2})\.\s?(\d{1,2})\.(?:\s?[–—-]\s?(\d{1,2})\.\s?(\d{1,2})\.)?(?!\s?\d)/uy,
    apply(m, ctx) {
      const valid = (d: string, mo: string) => Number(d) >= 1 && Number(d) <= 31 && Number(mo) >= 1 && Number(mo) <= 12;
      if (!valid(m[1], m[2]) || (m[3] && !valid(m[3], m[4]))) return null;
      const c = dayCaseFromPrep(ctx.text, ctx.start);
      const months = c === "dat" ? MONTHS_DAT : c === "loc" ? MONTHS_LOC : MONTHS_GEN;
      const one = (d: string, mo: string, cs: Case, ms: string[]) => `${ordinal(Number(d), "m", cs)} ${ms[Number(mo) - 1]}`;
      if (!m[3]) return { spoken: one(m[1], m[2], c, months), kind: "date" };
      const from = prevWord(ctx.text, ctx.start) === "od";
      return { spoken: `${one(m[1], m[2], c, months)} ${from ? "do" : "až"} ${one(m[3], m[4], from ? "gen" : c, from ? MONTHS_GEN : months)}`, kind: "date" };
    },
  },
  {
    // "2 627 m n. m.", "2 000 m.n.m."
    name: "altitude",
    re: new RegExp(`(${NUM})\\s?m\\.?\\s?n\\.\\s?m\\.?`, "uy"),
    apply(m) {
      return { spoken: `${sayQuantity(parseAmount(m[1]), UNITS.m)} nad morom`, kind: "unit" };
    },
  },
  {
    name: "time",
    re: /(\d{1,2}):(\d{2})(?:\s?(?:hod\.|h)(?![\p{L}]))?(?!\d)/uy,
    apply(m) {
      const h = Number(m[1]);
      const min = Number(m[2]);
      if (h > 24 || min > 59) return null;
      if (min === 0) return { spoken: `${cardinal(h, "f")} ${plural(h, ["hodina", "hodiny", "hodín"])}`, kind: "time" };
      const mm = min < 10 ? `nula ${cardinal(min)}` : cardinal(min);
      return { spoken: `${cardinal(h, "f")} ${mm}`, kind: "time" };
    },
  },
  {
    // "5-ročný", "3-krát"
    name: "number-compound",
    re: /(\d+)-(krát|násob\p{L}*|ročn\p{L}*|izbov\p{L}*|percentn\p{L}*|členn\p{L}*|dňov\p{L}*|hodinov\p{L}*|minútov\p{L}*)/uy,
    apply(m) {
      const n = Number(m[1]);
      const suffix = m[2];
      const krat = ["", "raz", "dva", "tri", "štyri"];
      const prefix = ["", "jedno", "dvoj", "troj", "štvor"];
      if (suffix === "krát") return { spoken: n === 1 ? "raz" : (n <= 4 ? krat[n] : cardinal(n)) + "krát", kind: "number" };
      return { spoken: (n <= 4 ? prefix[n] : cardinal(n)) + suffix, kind: "number" };
    },
  },
  {
    name: "currency-prefix",
    re: new RegExp(`(€|\\$|£)\\s?(${NUM})${END}`, "uy"),
    apply(m, ctx) {
      return { spoken: sayQuantity(parseAmount(m[2]), UNITS[m[1]]), kind: "currency", confident: !obliqueCase(ctx.text, ctx.start) };
    },
  },
  {
    name: "range",
    re: new RegExp(`(${NUM})\\s?[–—-]\\s?(${NUM})(?:\\s?(${UNIT_RE})(?![\\p{L}]))?${END}`, "uy"),
    apply(m, ctx) {
      const a = parseAmount(m[1]);
      const b = parseAmount(m[2]);
      const unit = m[3] ? UNITS[m[3]] : null;
      const first = unit ? sayAmount(a, unit.gender) : sayAmount(a, "m");
      const second = unit ? sayQuantity(b, unit) : sayAmount(b, "m");
      return { spoken: `${first} až ${second}`, kind: "range", confident: !obliqueCase(ctx.text, ctx.start) };
    },
  },
  {
    name: "temperature-negative",
    re: new RegExp(`[-−–](${NUM})\\s?(°C|°F|°)${END}`, "uy"),
    apply(m) {
      return { spoken: `mínus ${sayQuantity(parseAmount(m[1]), UNITS[m[2]])}`, kind: "temperature" };
    },
  },
  {
    name: "quantity",
    re: new RegExp(`(${NUM})(?:,-)?\\s?(${UNIT_RE})(?![\\p{L}])(?:\\.(?=\\s+\\p{Ll}))?`, "uy"),
    apply(m, ctx) {
      return { spoken: sayQuantity(parseAmount(m[1]), UNITS[m[2]]), kind: kindOf(m[2]), confident: !obliqueCase(ctx.text, ctx.start) };
    },
  },
  {
    // "19. storočí", "2. svetová vojna" — a number with a dot followed by a lowercase word.
    name: "ordinal",
    re: /(\d{1,4})\.(?=\s+\p{Ll})/uy,
    apply(m, ctx) {
      const n = Number(m[1]);
      if (n < 1) return null;
      const g = grammarAt(ctx.text, ctx.start, ctx.end);
      return { spoken: ordinal(n, g.gender, g.case), kind: "ordinal", confident: g.confident };
    },
  },
  {
    // "XX. storočie", "Karol IV. zomrel"
    name: "roman-ordinal",
    re: /([IVXLCDM]+)\.(?=\s+\p{Ll})/uy,
    apply(m, ctx) {
      const n = fromRoman(m[1]);
      if (!n || n > 3999) return null;
      const g = grammarAt(ctx.text, ctx.start, ctx.end);
      return { spoken: ordinal(n, g.gender, g.case), kind: "roman", confident: g.confident };
    },
  },
  {
    // "Kapitola IV", or a heading line that is only a Roman numeral.
    name: "roman-cardinal",
    re: /([IVXLCDM]{1,7})(?![\p{L}\p{N}])/uy,
    apply(m, ctx) {
      const n = fromRoman(m[1]);
      if (!n) return null;
      const before = prevWord(ctx.text, ctx.start);
      const lineAlone = /(?:^|\n)\s*$/.test(ctx.text.slice(0, ctx.start)) && /^\.?\s*(?:\n|$)/.test(ctx.text.slice(ctx.end));
      if (!lineAlone && !["kapitola", "časť", "diel", "zväzok", "kniha", "kapitoly", "časti"].includes(before)) return null;
      if (!lineAlone && m[1].length === 1 && m[1] !== "I") return null;
      return { spoken: cardinal(n, "f"), kind: "roman" };
    },
  },
  {
    name: "number",
    re: new RegExp(`${NUM}${END}`, "uy"),
    apply(m, ctx) {
      const a = parseAmount(m[0]);
      if (a.frac !== null) return { spoken: decimalWords(a), kind: "decimal" };
      // "Kapitola 1", "strana 2": a number naming a feminine noun before it is read "jedna", "dva".
      if (["kapitola", "strana", "časť", "kniha", "kapitoly", "strany"].includes(prevWord(ctx.text, ctx.start))) {
        return { spoken: a.int === 2 ? "dva" : cardinal(a.int, "f"), kind: "number" };
      }
      if (a.int >= 1 && a.int <= 2) {
        const g = grammarAt(ctx.text, ctx.start, ctx.end);
        return { spoken: cardinal(a.int, g.gender), kind: "number", confident: g.confident && !obliqueCase(ctx.text, ctx.start) };
      }
      return { spoken: cardinal(a.int), kind: "number", confident: !obliqueCase(ctx.text, ctx.start) };
    },
  },
  {
    // Biographical marks before a date: "(* 17. máj 1860 – † 21. máj 1928)".
    name: "born-died",
    re: /[*†](?=\s?\d)/uy,
    apply(m) {
      return { spoken: m[0] === "*" ? "narodený" : "zomrel", kind: "symbol", confident: false };
    },
  },
  {
    name: "symbol",
    re: /[&§×=+]/uy,
    apply(m, ctx) {
      const s = m[0];
      if (s === "+" && !/\d\s?$/.test(ctx.text.slice(0, ctx.start))) return null;
      const words: Record<string, string> = { "&": "a", "§": "paragraf", "×": "krát", "=": "rovná sa", "+": "plus" };
      return { spoken: words[s], kind: "symbol" } satisfies RuleResult;
    },
  },
];
