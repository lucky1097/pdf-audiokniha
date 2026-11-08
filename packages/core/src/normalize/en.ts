import { cardinal, digits, ordinal, year } from "./en-numbers.ts";
import { fromRoman } from "./sk-numbers.ts";
import { prevWord } from "./runner.ts";
import type { Rule } from "./types.ts";

export const NUM_EN = String.raw`(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?`;
const END = String.raw`(?![\p{L}\p{N}])`;

interface Amount {
  int: number;
  frac: string | null;
  raw: string;
}

function parse(raw: string): Amount {
  const [i, f] = raw.replace(/,/g, "").split(".");
  return { int: Number(i), frac: f ?? null, raw };
}

function sayAmount(a: Amount): string {
  if (a.frac !== null) return `${cardinal(a.int)} point ${digits(a.frac)}`;
  return cardinal(a.int);
}

/** A bare 4-digit number between 1000 and 2099 with no thousands comma is read as a year. */
function sayNumber(a: Amount): string {
  if (a.frac === null && /^\d{4}$/.test(a.raw) && a.int >= 1000 && a.int <= 2099) return year(a.int);
  return sayAmount(a);
}

interface Unit {
  one: string;
  many: string;
  sub?: [string, string];
}

const UNITS: Record<string, Unit> = {
  $: { one: "dollar", many: "dollars", sub: ["cent", "cents"] },
  USD: { one: "dollar", many: "dollars", sub: ["cent", "cents"] },
  "€": { one: "euro", many: "euros", sub: ["cent", "cents"] },
  EUR: { one: "euro", many: "euros", sub: ["cent", "cents"] },
  "£": { one: "pound", many: "pounds", sub: ["penny", "pence"] },
  GBP: { one: "pound", many: "pounds", sub: ["penny", "pence"] },
  "%": { one: "percent", many: "percent" },
  "°C": { one: "degree Celsius", many: "degrees Celsius" },
  "°F": { one: "degree Fahrenheit", many: "degrees Fahrenheit" },
  "°": { one: "degree", many: "degrees" },
  "km/h": { one: "kilometer per hour", many: "kilometers per hour" },
  kph: { one: "kilometer per hour", many: "kilometers per hour" },
  mph: { one: "mile per hour", many: "miles per hour" },
  km: { one: "kilometer", many: "kilometers" },
  cm: { one: "centimeter", many: "centimeters" },
  mm: { one: "millimeter", many: "millimeters" },
  m: { one: "meter", many: "meters" },
  kg: { one: "kilogram", many: "kilograms" },
  g: { one: "gram", many: "grams" },
  lb: { one: "pound", many: "pounds" },
  lbs: { one: "pound", many: "pounds" },
  oz: { one: "ounce", many: "ounces" },
  mi: { one: "mile", many: "miles" },
  ft: { one: "foot", many: "feet" },
  ml: { one: "milliliter", many: "milliliters" },
  l: { one: "liter", many: "liters" },
  h: { one: "hour", many: "hours" },
  hr: { one: "hour", many: "hours" },
  min: { one: "minute", many: "minutes" },
  sec: { one: "second", many: "seconds" },
};
const UNIT_RE = Object.keys(UNITS).sort((a, b) => b.length - a.length).map((k) => k.replace(/[$/]/g, "\\$&")).join("|");
const SCALE = "(?:\\s(thousand|million|billion|trillion))?";

function sayQuantity(a: Amount, unit: Unit, scale?: string): string {
  if (scale) return `${sayAmount(a)} ${scale} ${unit.many}`;
  if (unit.sub && a.frac !== null && a.frac.length === 2) {
    const cents = Number(a.frac);
    const main = `${cardinal(a.int)} ${a.int === 1 ? unit.one : unit.many}`;
    return cents ? `${main} and ${cardinal(cents)} ${cents === 1 ? unit.sub[0] : unit.sub[1]}` : main;
  }
  return `${sayAmount(a)} ${a.int === 1 && a.frac === null ? unit.one : unit.many}`;
}

function kindOf(key: string): "currency" | "percent" | "temperature" | "unit" {
  if (UNITS[key].sub) return "currency";
  if (key === "%") return "percent";
  if (key.startsWith("°")) return "temperature";
  return "unit";
}

const ABBREVIATIONS: [string, string, boolean][] = [
  ["e.g.", "for example", true],
  ["i.e.", "that is", true],
  ["etc.", "et cetera", true],
  ["vs.", "versus", true],
  ["approx.", "approximately", true],
  ["a.m.", "a m", true],
  ["p.m.", "p m", true],
  ["U.S.", "U S", true],
  ["U.K.", "U K", true],
  ["Mr.", "Mister", true],
  ["Mrs.", "Missus", true],
  ["Ms.", "Miz", true],
  ["Prof.", "Professor", true],
  ["Jr.", "Junior", true],
  ["Sr.", "Senior", true],
  ["Inc.", "Incorporated", true],
  ["Ltd.", "Limited", true],
  ["Mt.", "Mount", true],
  ["Ave.", "Avenue", true],
  ["Fig.", "Figure", true],
  ["Vol.", "Volume", true],
  ["Ch.", "Chapter", true],
];
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const ABBR = new Map(ABBREVIATIONS.map(([k, v, c]) => [k.toLowerCase(), [v, c] as [string, boolean]]));
const ABBR_RE = ABBREVIATIONS.map((a) => esc(a[0])).sort((a, b) => b.length - a.length).join("|");

export const EN_RULES: Rule[] = [
  {
    name: "abbreviation",
    re: new RegExp(`(?:${ABBR_RE})(?![\\p{L}])`, "iuy"),
    apply(m) {
      const hit = ABBR.get(m[0].toLowerCase());
      if (!hit) return null;
      const capital = /^\p{Lu}/u.test(m[0]) && /^\p{Ll}/u.test(hit[0]);
      return { spoken: capital ? hit[0][0].toUpperCase() + hit[0].slice(1) : hit[0], kind: "abbreviation", confident: hit[1] };
    },
  },
  {
    // "Dr." is Doctor before a name, Drive otherwise; "St." is Saint before a name, Street otherwise.
    name: "abbreviation-ambiguous",
    re: /(Dr|St)\.(?![\p{L}])/uy,
    apply(m, ctx) {
      const nameFollows = /^\s+\p{Lu}/u.test(ctx.text.slice(ctx.end));
      const word = m[1] === "Dr" ? (nameFollows ? "Doctor" : "Drive") : nameFollows ? "Saint" : "Street";
      return { spoken: word, kind: "abbreviation", confident: nameFollows };
    },
  },
  {
    // "No. 5", "p. 12", "pp. 12–15"
    name: "abbreviation-before-number",
    re: /(No|no|pp|p)\.(?=\s?\d)/uy,
    apply(m) {
      const words: Record<string, string> = { No: "number", no: "number", pp: "pages", p: "page" };
      return { spoken: words[m[1]], kind: "abbreviation" };
    },
  },
  {
    name: "time",
    re: /(\d{1,2}):(\d{2})(?!\d)/uy,
    apply(m) {
      const h = Number(m[1]);
      const min = Number(m[2]);
      if (h > 24 || min > 59) return null;
      if (min === 0) return { spoken: `${cardinal(h)} o'clock`, kind: "time" };
      return { spoken: `${cardinal(h)} ${min < 10 ? `oh ${cardinal(min)}` : cardinal(min)}`, kind: "time" };
    },
  },
  {
    name: "ordinal-suffix",
    re: /(\d+)(st|nd|rd|th)(?![\p{L}])/uy,
    apply(m) {
      return { spoken: ordinal(Number(m[1])), kind: "ordinal" };
    },
  },
  {
    name: "currency-prefix",
    re: new RegExp(`(\\$|€|£)\\s?(${NUM_EN})${SCALE}${END}`, "uy"),
    apply(m) {
      return { spoken: sayQuantity(parse(m[2]), UNITS[m[1]], m[3]), kind: "currency" };
    },
  },
  {
    name: "range",
    re: new RegExp(`(${NUM_EN})\\s?[–—-]\\s?(${NUM_EN})(?:\\s?(${UNIT_RE})(?![\\p{L}]))?${END}`, "uy"),
    apply(m) {
      const a = parse(m[1]);
      const b = parse(m[2]);
      const second = m[3] ? sayQuantity(b, UNITS[m[3]]) : sayNumber(b);
      return { spoken: `${sayNumber(a)} to ${second}`, kind: "range" };
    },
  },
  {
    name: "temperature-negative",
    re: new RegExp(`[-−–](${NUM_EN})\\s?(°C|°F|°)${END}`, "uy"),
    apply(m) {
      return { spoken: `minus ${sayQuantity(parse(m[1]), UNITS[m[2]])}`, kind: "temperature" };
    },
  },
  {
    name: "quantity",
    re: new RegExp(`(${NUM_EN})${SCALE}\\s?(${UNIT_RE})(?![\\p{L}])`, "uy"),
    apply(m) {
      return { spoken: sayQuantity(parse(m[1]), UNITS[m[3]], m[2]), kind: kindOf(m[3]) };
    },
  },
  {
    // "Chapter IV", "World War II", "Henry VIII"
    name: "roman",
    re: /([IVXLCDM]{1,7})(?![\p{L}\p{N}])/uy,
    apply(m, ctx) {
      const n = fromRoman(m[1]);
      if (!n) return null;
      const before = prevWord(ctx.text, ctx.start);
      const lineAlone = /(?:^|\n)\s*$/.test(ctx.text.slice(0, ctx.start)) && /^\.?\s*(?:\n|$)/.test(ctx.text.slice(ctx.end));
      if (lineAlone || ["chapter", "part", "book", "volume", "war", "act", "scene", "appendix"].includes(before)) {
        return { spoken: cardinal(n), kind: "roman" };
      }
      // Regnal numbers after a capitalized name; a lone "I" is the pronoun.
      const nameBefore = /\p{Lu}\p{Ll}+\s$/u.test(ctx.text.slice(Math.max(0, ctx.start - 30), ctx.start));
      if (nameBefore && m[1].length >= 2) return { spoken: `the ${ordinal(n)}`, kind: "roman", confident: false };
      return null;
    },
  },
  {
    name: "number",
    re: new RegExp(`${NUM_EN}${END}`, "uy"),
    apply(m) {
      const a = parse(m[0]);
      return { spoken: sayNumber(a), kind: a.frac !== null ? "decimal" : "number" };
    },
  },
  {
    name: "symbol",
    re: /[&§×=+]/uy,
    apply(m, ctx) {
      const s = m[0];
      if (s === "+" && !/\d\s?$/.test(ctx.text.slice(0, ctx.start))) return null;
      const words: Record<string, string> = { "&": "and", "§": "section", "×": "times", "=": "equals", "+": "plus" };
      return { spoken: words[s], kind: "symbol" };
    },
  },
];
