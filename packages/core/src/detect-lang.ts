import type { Lang } from "./normalize/types.ts";

const SK_WORDS = new Set("a aj ako alebo ale do je sa na nie po pre pri s sme so sú to tak v vo z zo že ktorý ktorá ktoré už".split(" "));
const EN_WORDS = new Set("a an and are as at be but by for from had has have he her his i in is it of on or she that the they this to was were with you".split(" "));

/** Slovak or English, from common short words and Slovak diacritics. */
export function detectLang(text: string): Lang {
  const sample = text.slice(0, 20000).toLowerCase();
  const words = sample.match(/\p{L}+/gu) ?? [];
  let sk = 0;
  let en = 0;
  for (const w of words) {
    if (SK_WORDS.has(w)) sk++;
    if (EN_WORDS.has(w)) en++;
  }
  sk += (sample.match(/[áäčďéíĺľňóôŕšťúýž]/g) ?? []).length * 0.5;
  return sk > en ? "sk" : "en";
}
