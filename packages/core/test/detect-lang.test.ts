import assert from "node:assert/strict";
import { test } from "node:test";
import { detectLang } from "../src/detect-lang.ts";

test("detects Slovak and English", () => {
  assert.equal(detectLang("Keď Jana vystúpila z vlaku, mesto ešte spalo a nad strechami visela hmla."), "sk");
  assert.equal(detectLang("The rain had stopped by the time Clara reached the old lighthouse."), "en");
  assert.equal(detectLang("Bol to ten istý dom, v ktorom sa narodil."), "sk");
});
