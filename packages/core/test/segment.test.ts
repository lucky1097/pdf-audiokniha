import assert from "node:assert/strict";
import { test } from "node:test";
import { segment } from "../src/segment.ts";

const texts = (s: string, o = {}) => segment(s, o).map((x) => x.text);

test("one sentence per segment", () => {
  assert.deepEqual(texts("Prvá veta je tu dlhá. Druhá veta je tiež dosť dlhá! Tretia veta končí otázkou, však?"), [
    "Prvá veta je tu dlhá.",
    "Druhá veta je tiež dosť dlhá!",
    "Tretia veta končí otázkou, však?",
  ]);
});

test("short sentences join the next one", () => {
  assert.deepEqual(texts("Kapitola tri. Ráno bolo v Žiline chladno a pršalo."), ["Kapitola tri. Ráno bolo v Žiline chladno a pršalo."]);
  assert.deepEqual(texts("Ráno bolo v Žiline chladno a pršalo. Jana sa zamračila."), ["Ráno bolo v Žiline chladno a pršalo. Jana sa zamračila."]);
});

test("quotes and dialogue", () => {
  assert.deepEqual(texts("Z reproduktora sa ozvalo: „Vlak mešká dvadsať minút.“ Jana si povzdychla a sadla si."), [
    "Z reproduktora sa ozvalo: „Vlak mešká dvadsať minút.“",
    "Jana si povzdychla a sadla si.",
  ]);
});

test("paragraphs stay separate, with an end marker", () => {
  const s = segment("Prvý odsek má jednu dlhú vetu.\n\nDruhý odsek má tiež jednu vetu.");
  assert.deepEqual(s.map((x) => [x.paragraph, x.paragraphEnd]), [[0, true], [1, true]]);
});

test("long sentences split at punctuation", () => {
  const long = "Toto je veľmi dlhá veta, ktorá pokračuje ďalej a ďalej, lebo autor rád píše; a potom ešte pridá vedľajšiu vetu, ktorá nič nehovorí.";
  const parts = texts(long, { maxChars: 70 });
  assert.ok(parts.length >= 2);
  assert.ok(parts.every((p) => p.length <= 70), JSON.stringify(parts));
  assert.equal(parts.join(" "), long);
});
