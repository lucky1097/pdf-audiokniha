// Slovak number words. Cardinals follow standard orthography (compounds written together:
// "dvetisícdvadsaťštyri"), checked against num2words in the tests.

export type Gender = "m" | "f" | "n";
export type Case = "nom" | "gen" | "dat" | "acc" | "loc" | "ins";

const ONES = ["nula", "jeden", "dva", "tri", "štyri", "päť", "šesť", "sedem", "osem", "deväť"];
const TEENS = ["desať", "jedenásť", "dvanásť", "trinásť", "štrnásť", "pätnásť", "šestnásť", "sedemnásť", "osemnásť", "devätnásť"];
const TENS = ["", "", "dvadsať", "tridsať", "štyridsať", "päťdesiat", "šesťdesiat", "sedemdesiat", "osemdesiat", "deväťdesiat"];
const HUNDREDS = ["", "sto", "dvesto", "tristo", "štyristo", "päťsto", "šesťsto", "sedemsto", "osemsto", "deväťsto"];

function one(gender: Gender): string {
  return gender === "f" ? "jedna" : gender === "n" ? "jedno" : "jeden";
}

function two(gender: Gender): string {
  return gender === "m" ? "dva" : "dve";
}

/**
 * 1..999. Gender only changes a standalone 1 or 2. Hundreds are a separate word ("šesťsto dvanásť"):
 * standard spelling joins them, but phase 1 showed the voice misreading very long compounds, and
 * spacing does not change how the number sounds.
 */
function below1000(n: number, gender: Gender): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  const hundreds = HUNDREDS[h];
  if (r === 0) return hundreds;
  let rest: string;
  if (r < 10) {
    if (h === 0 && r === 1) return one(gender);
    if (h === 0 && r === 2) return two(gender);
    rest = ONES[r];
  } else if (r < 20) rest = TEENS[r - 10];
  else rest = TENS[Math.floor(r / 10)] + (r % 10 ? ONES[r % 10] : "");
  return hundreds ? `${hundreds} ${rest}` : rest;
}

/** Plural form chooser: 1 / 2–4 / 5+ (and 0). */
export function plural(n: number, forms: [string, string, string]): string {
  if (n === 1) return forms[0];
  if (n >= 2 && n <= 4) return forms[1];
  return forms[2];
}

export function cardinal(n: number, gender: Gender = "m"): string {
  if (!Number.isInteger(n) || n < 0) throw new RangeError(`cardinal: ${n}`);
  if (n === 0) return "nula";
  if (n >= 1e12) return String(n).split("").map((d) => ONES[Number(d)]).join(" ");
  const parts: string[] = [];
  const billions = Math.floor(n / 1e9);
  const millions = Math.floor((n % 1e9) / 1e6);
  const thousands = Math.floor((n % 1e6) / 1e3);
  const rest = n % 1000;
  if (billions) {
    parts.push(billions === 1 ? "miliarda" : `${below1000(billions, "f")} ${plural(billions, ["miliarda", "miliardy", "miliárd"])}`);
  }
  if (millions) {
    parts.push(millions === 1 ? "milión" : `${below1000(millions, "m")} ${plural(millions, ["milión", "milióny", "miliónov"])}`);
  }
  if (thousands) {
    // "dvadsaťjedentisíc", "stotisíc": the thousands multiplier stays one word with "tisíc".
    const mult = thousands === 1 ? "" : thousands === 2 ? "dve" : below1000(thousands, "m").replace(/ /g, "");
    parts.push(mult + "tisíc");
  }
  if (rest) parts.push(below1000(rest, thousands || millions || billions ? "m" : gender));
  return parts.join(" ");
}

// --- ordinals -------------------------------------------------------------------------------

type Decl = "long" | "short" | "soft" | "softShort";

interface Stem {
  stem: string;
  decl: Decl;
}

const ORD_ONES: Stem[] = [
  { stem: "", decl: "long" },
  { stem: "prv", decl: "long" },
  { stem: "druh", decl: "long" },
  { stem: "tret", decl: "soft" },
  { stem: "štvrt", decl: "long" },
  { stem: "piat", decl: "short" },
  { stem: "šiest", decl: "short" },
  { stem: "siedm", decl: "short" },
  { stem: "ôsm", decl: "short" },
  { stem: "deviat", decl: "short" },
];
const ORD_TEENS = ["desiat", "jedenást", "dvanást", "trinást", "štrnást", "pätnást", "šestnást", "sedemnást", "osemnást", "devätnást"];
const ORD_TENS = ["", "", "dvadsiat", "tridsiat", "štyridsiat", "päťdesiat", "šesťdesiat", "sedemdesiat", "osemdesiat", "deväťdesiat"];
const ORD_HUNDREDS = ["", "st", "dvojst", "trojst", "štvorst", "päťst", "šesťst", "sedemst", "osemst", "deväťst"];

// Endings per declension: [gender][case]. "Long" vs "short" is the Slovak rhythmic law
// (a long syllable in the stem shortens the ending: pätnásty, but prvý).
const ENDINGS: Record<Decl, Record<Gender, Record<Case, string>>> = {
  long: {
    m: { nom: "ý", gen: "ého", dat: "ému", acc: "ý", loc: "om", ins: "ým" },
    f: { nom: "á", gen: "ej", dat: "ej", acc: "ú", loc: "ej", ins: "ou" },
    n: { nom: "é", gen: "ého", dat: "ému", acc: "é", loc: "om", ins: "ým" },
  },
  short: {
    m: { nom: "y", gen: "eho", dat: "emu", acc: "y", loc: "om", ins: "ym" },
    f: { nom: "a", gen: "ej", dat: "ej", acc: "u", loc: "ej", ins: "ou" },
    n: { nom: "e", gen: "eho", dat: "emu", acc: "e", loc: "om", ins: "ym" },
  },
  soft: {
    m: { nom: "í", gen: "ieho", dat: "iemu", acc: "í", loc: "om", ins: "ím" },
    f: { nom: "ia", gen: "ej", dat: "ej", acc: "iu", loc: "ej", ins: "ou" },
    n: { nom: "ie", gen: "ieho", dat: "iemu", acc: "ie", loc: "om", ins: "ím" },
  },
  // tisíci: soft stem after a long syllable.
  softShort: {
    m: { nom: "i", gen: "eho", dat: "emu", acc: "i", loc: "om", ins: "im" },
    f: { nom: "a", gen: "ej", dat: "ej", acc: "u", loc: "ej", ins: "ou" },
    n: { nom: "e", gen: "eho", dat: "emu", acc: "e", loc: "om", ins: "im" },
  },
};

function decline(s: Stem, gender: Gender, c: Case): string {
  const end = ENDINGS[s.decl][gender][c];
  // Soft stems soften t/d before "o": treťom, treťou.
  if (s.decl === "soft" && end.startsWith("o")) return s.stem.replace(/t$/, "ť").replace(/d$/, "ď") + end;
  return s.stem + end;
}

/** Ordinal for 1..9999, e.g. ordinal(19, "n", "loc") === "devätnástom". */
export function ordinal(n: number, gender: Gender = "m", c: Case = "nom"): string {
  if (!Number.isInteger(n) || n < 1 || n > 9999) throw new RangeError(`ordinal: ${n}`);
  const r = n % 100;
  const high = n - r;
  if (r === 0) {
    const th = Math.floor(n / 1000);
    const h = Math.floor((n % 1000) / 100);
    if (h === 0) {
      const prefix = th === 1 ? "" : th === 2 ? "dvoj" : th === 3 ? "troj" : th === 4 ? "štvor" : cardinal(th);
      return decline({ stem: prefix + "tisíc", decl: "softShort" }, gender, c);
    }
    const prefix = th ? `${cardinal(th * 1000)} ` : "";
    return prefix + decline({ stem: ORD_HUNDREDS[h], decl: "long" }, gender, c);
  }
  const prefix = high ? `${cardinal(high)} ` : "";
  if (r < 10) return prefix + decline(ORD_ONES[r], gender, c);
  if (r < 20) return prefix + decline({ stem: ORD_TEENS[r - 10], decl: "short" }, gender, c);
  const tens = decline({ stem: ORD_TENS[Math.floor(r / 10)], decl: "short" }, gender, c);
  const u = r % 10;
  return u ? `${prefix}${tens} ${decline(ORD_ONES[u], gender, c)}` : prefix + tens;
}

export const MONTHS_NOM = ["január", "február", "marec", "apríl", "máj", "jún", "júl", "august", "september", "október", "november", "december"];
export const MONTHS_GEN = ["januára", "februára", "marca", "apríla", "mája", "júna", "júla", "augusta", "septembra", "októbra", "novembra", "decembra"];
export const MONTHS_DAT = ["januáru", "februáru", "marcu", "aprílu", "máju", "júnu", "júlu", "augustu", "septembru", "októbru", "novembru", "decembru"];
export const MONTHS_LOC = ["januári", "februári", "marci", "apríli", "máji", "júni", "júli", "auguste", "septembri", "októbri", "novembri", "decembri"];

const ROMAN: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };

/** Strict Roman numeral parser (canonical forms only), or null. */
export function fromRoman(s: string): number | null {
  if (!/^[IVXLCDM]+$/.test(s)) return null;
  let total = 0;
  for (let i = 0; i < s.length; i++) {
    const v = ROMAN[s[i]];
    const next = ROMAN[s[i + 1]] ?? 0;
    total += v < next ? -v : v;
  }
  return toRoman(total) === s ? total : null;
}

function toRoman(n: number): string {
  const table: [number, string][] = [[1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"], [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
  let s = "";
  for (const [v, r] of table) while (n >= v) { s += r; n -= v; }
  return s;
}
