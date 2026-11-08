const ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
const SCALES: [number, string][] = [[1e12, "trillion"], [1e9, "billion"], [1e6, "million"], [1e3, "thousand"]];

function below100(n: number): string {
  if (n < 20) return ONES[n];
  const t = TENS[Math.floor(n / 10)];
  return n % 10 ? `${t}-${ONES[n % 10]}` : t;
}

function below1000(n: number): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  if (!h) return below100(r);
  return r ? `${ONES[h]} hundred ${below100(r)}` : `${ONES[h]} hundred`;
}

/** American style, no "and": 1250 → "one thousand two hundred fifty". */
export function cardinal(n: number): string {
  if (!Number.isInteger(n) || n < 0) throw new RangeError(`cardinal: ${n}`);
  if (n === 0) return "zero";
  if (n >= 1e15) return String(n).split("").map((d) => ONES[Number(d)]).join(" ");
  const parts: string[] = [];
  for (const [v, name] of SCALES) {
    if (n >= v) {
      parts.push(`${below1000(Math.floor(n / v))} ${name}`);
      n %= v;
    }
  }
  if (n) parts.push(below1000(n));
  return parts.join(" ");
}

const IRREGULAR: Record<string, string> = {
  one: "first", two: "second", three: "third", five: "fifth", eight: "eighth", nine: "ninth", twelve: "twelfth",
};

export function ordinal(n: number): string {
  const words = cardinal(n);
  const m = /([a-z]+)$/.exec(words)!;
  const last = m[1];
  let ord: string;
  if (IRREGULAR[last]) ord = IRREGULAR[last];
  else if (last.endsWith("y")) ord = last.slice(0, -1) + "ieth";
  else ord = last + "th";
  return words.slice(0, m.index) + ord;
}

/** Years read in pairs: 1984 → "nineteen eighty-four", 2019 → "twenty nineteen", 2005 → "two thousand five". */
export function year(n: number): string {
  if (n < 1000 || n > 2099) return cardinal(n);
  if (n >= 2000 && n < 2010) return cardinal(n);
  const hi = Math.floor(n / 100);
  const lo = n % 100;
  if (lo === 0) return `${below100(hi)} hundred`;
  return `${below100(hi)} ${lo < 10 ? `oh ${ONES[lo]}` : below100(lo)}`;
}

export function digits(s: string): string {
  return s.split("").map((d) => ONES[Number(d)]).join(" ");
}
