import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeToText } from "../src/normalize/index.ts";
import { cardinal, ordinal, year } from "../src/normalize/en-numbers.ts";

const en = (s: string) => normalizeToText(s, "en");

test("number words", () => {
  assert.equal(cardinal(1250), "one thousand two hundred fifty");
  assert.equal(cardinal(21), "twenty-one");
  assert.equal(ordinal(21), "twenty-first");
  assert.equal(ordinal(12), "twelfth");
  assert.equal(ordinal(40), "fortieth");
  assert.equal(year(1984), "nineteen eighty-four");
  assert.equal(year(2019), "twenty nineteen");
  assert.equal(year(2005), "two thousand five");
  assert.equal(year(1900), "nineteen hundred");
  assert.equal(year(1905), "nineteen oh five");
});

test("phase 0 tricky passage", () => {
  assert.equal(
    en("Chapter 12. On March 3rd, 2019, Dr. Evans paid $1,250.75 for a 1.5 kg brass compass, roughly 40% more than he had planned."),
    "Chapter twelve. On March third, twenty nineteen, Doctor Evans paid one thousand two hundred fifty dollars and seventy-five cents for a one point five kilograms brass compass, roughly forty percent more than he had planned.",
  );
  assert.equal(en("glancing at the clock: 7:45 p.m. His assistant, Mrs. O'Neill"), "glancing at the clock: seven forty-five p m His assistant, Missus O'Neill");
});

test("money, units, ranges", () => {
  assert.equal(en("$5 million"), "five million dollars");
  assert.equal(en("£1"), "one pound");
  assert.equal(en("20 km"), "twenty kilometers");
  assert.equal(en("60 mph"), "sixty miles per hour");
  assert.equal(en("1939–1945"), "nineteen thirty-nine to nineteen forty-five");
  assert.equal(en("pp. 12–15"), "pages twelve to fifteen");
  assert.equal(en("-3 °C"), "minus three degrees Celsius");
  assert.equal(en("7:00"), "seven o'clock");
});

test("roman numerals", () => {
  assert.equal(en("Chapter IV"), "Chapter four");
  assert.equal(en("World War II ended"), "World War two ended");
  assert.equal(en("Henry VIII married"), "Henry the eighth married");
  assert.equal(en("I think I can"), "I think I can");
});

test("abbreviations", () => {
  assert.equal(en("e.g. this"), "for example this");
  assert.equal(en("Baker St. was quiet"), "Baker Street was quiet");
  assert.equal(en("St. Paul"), "Saint Paul");
  assert.equal(en("No. 5"), "number five");
});
