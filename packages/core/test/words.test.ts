import assert from "node:assert/strict";
import { test } from "node:test";
import { wordAt, wordSpans } from "../src/words.ts";

test("words get time by length, and a pause after commas and full stops", () => {
  const text = "These sovereigns will exercise control, quietly. Then more";
  const spans = wordSpans(text);
  assert.deepEqual(spans.map((s) => text.slice(s.start, s.end)), ["These", "sovereigns", "will", "exercise", "control,", "quietly.", "Then", "more"]);
  const len = (i: number) => spans[i].to - spans[i].from;
  assert.ok(len(1) > len(0), "a longer word takes longer");
  assert.ok(len(4) > len(3), "a comma adds a pause");
  assert.equal(spans[0].from, 0);
  assert.ok(Math.abs(spans.at(-1)!.to - 1) < 1e-9);
});

test("the word at a point in time", () => {
  const spans = wordSpans("one two three");
  assert.equal(wordAt(spans, 0), -1);
  assert.equal(wordAt(spans, 0.01), 0);
  assert.equal(wordAt(spans, 0.5), 1);
  assert.equal(wordAt(spans, 0.99), 2);
  assert.equal(wordAt(spans, 1.4), 2);
  assert.equal(wordAt([], 0.5), -1);
});
