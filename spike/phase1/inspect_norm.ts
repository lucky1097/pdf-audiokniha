// Shows what the normalizer does to a text: every non-plain span, and anything digit- or symbol-like left behind.
import { readFileSync } from "node:fs";
import { normalize, spokenText, type Lang } from "@audiokniha/core";

const [file, lang] = process.argv.slice(2) as [string, Lang];
const spans = normalize(readFileSync(file, "utf8"), lang);
for (const s of spans) {
  if (s.kind !== "text") console.log(`${s.confident ? " " : "?"} ${s.kind.padEnd(12)} ${JSON.stringify(s.original)} → ${s.spoken}`);
}
const leftovers = spokenText(spans).match(/[^\s.,;:!?„“"'()\[\]\-–—…\p{L}]+/gu) ?? [];
console.log("\nleft as-is:", [...new Set(leftovers)].join("  "));
