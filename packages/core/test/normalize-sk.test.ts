import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { normalize, normalizeToText } from "../src/normalize/index.ts";
import { cardinal, ordinal } from "../src/normalize/sk-numbers.ts";

const sk = (s: string) => normalizeToText(s, "sk");

test("cardinals match num2words (ignoring its spacing)", () => {
  const oracle: Record<string, string> = JSON.parse(readFileSync(new URL("./fixtures/num2words-sk-cardinals.json", import.meta.url), "utf8"));
  for (const [n, words] of Object.entries(oracle)) {
    assert.equal(cardinal(Number(n)).replace(/ /g, ""), words.replace(/ /g, ""), `cardinal(${n})`);
  }
});

test("ordinals decline by case and gender", () => {
  assert.equal(ordinal(15, "m", "gen"), "pätnásteho");
  assert.equal(ordinal(19, "n", "loc"), "devätnástom");
  assert.equal(ordinal(3, "n", "loc"), "treťom");
  assert.equal(ordinal(3, "f", "ins"), "treťou");
  assert.equal(ordinal(1, "f", "nom"), "prvá");
  assert.equal(ordinal(2, "f", "nom"), "druhá");
  assert.equal(ordinal(21, "m", "nom"), "dvadsiaty prvý");
  assert.equal(ordinal(1984, "m", "nom"), "tisíc deväťsto osemdesiaty štvrtý");
  assert.equal(ordinal(100, "m", "nom"), "stý");
  assert.equal(ordinal(200, "m", "nom"), "dvojstý");
  assert.equal(ordinal(1000, "m", "nom"), "tisíci");
});

test("phase 0 tricky passage", () => {
  assert.equal(
    sk("Kapitola 3. Ráno 15. marca 2024 bolo v Žiline asi 3 °C."),
    "Kapitola tri. Ráno pätnásteho marca dvetisíc dvadsaťštyri bolo v Žiline asi tri stupne Celzia.",
  );
  assert.equal(sk("Rýchlik R 612 do Bratislavy mešká približne 20 minút."), "Rýchlik R šesťsto dvanásť do Bratislavy mešká približne dvadsať minút.");
  assert.equal(sk("povedala potichu, napr. sama sebe"), "povedala potichu, napríklad sama sebe");
  assert.equal(sk("o dejinách Uhorska v 19. storočí."), "o dejinách Uhorska v devätnástom storočí.");
  assert.equal(sk("Stála 12,50 €, t. j. o 30 % viac, než čakala."), "Stála dvanásť eur päťdesiat centov, to jest o tridsať percent viac, než čakala.");
});

test("dates", () => {
  assert.equal(sk("narodil sa 1. mája 1990"), "narodil sa prvého mája tisíc deväťsto deväťdesiat");
  assert.equal(sk("do 15.3.2024"), "do pätnásteho marca dvetisíc dvadsaťštyri");
  assert.equal(sk("k 15. marcu"), "k pätnástemu marcu");
  assert.equal(sk("po 15. 3. 2024"), "po pätnástom marci dvetisíc dvadsaťštyri");
  assert.equal(sk("od 1.–3. mája"), "od prvého až tretieho mája");
  assert.equal(sk("uzávierkami od 1. 11. – 15. 6. Naproti"), "uzávierkami od prvého novembra do pätnásteho júna Naproti");
  assert.equal(sk("do 24. 12."), "do dvadsiateho štvrtého decembra");
  assert.equal(sk("nad 2 000 m.n.m. v"), "nad dvetisíc metrov nad morom v");
});

test("ordinals in context", () => {
  assert.equal(sk("na 2. mieste"), "na druhom mieste");
  assert.equal(sk("2. svetová vojna"), "druhá svetová vojna");
  assert.equal(sk("v 2. svetovej vojne"), "v druhej svetovej vojne");
  assert.equal(sk("začiatkom 20. storočia"), "začiatkom dvadsiateho storočia");
  assert.equal(sk("XX. storočie"), "dvadsiate storočie");
  assert.equal(sk("v XIX. storočí"), "v devätnástom storočí");
  assert.equal(sk("Kapitola IV"), "Kapitola štyri");
  assert.equal(sk("III\nText"), "tri\nText");
  assert.equal(sk("Kapitola 1."), "Kapitola jedna.");
  assert.equal(sk("na strane 2"), "na strane dva");
});

test("guessed grammar is flagged, not hidden", () => {
  const spans = normalize("pri 5. zastávke", "sk");
  const ord = spans.find((s) => s.kind === "ordinal")!;
  assert.equal(ord.confident, false);
  const date = normalize("15. marca", "sk").find((s) => s.kind === "date")!;
  assert.equal(date.confident, true);
});

test("money, percent, temperature, units", () => {
  assert.equal(sk("1 €"), "jedno euro");
  assert.equal(sk("2 €"), "dve eurá");
  assert.equal(sk("5 €"), "päť eur");
  assert.equal(sk("1 250,75 €"), "tisíc dvesto päťdesiat eur sedemdesiatpäť centov");
  assert.equal(sk("€ 20"), "dvadsať eur");
  assert.equal(sk("20 Kč"), "dvadsať korún");
  assert.equal(sk("2,5 %"), "dve celé päť percenta");
  assert.equal(sk("1 %"), "jedno percento");
  assert.equal(sk("-5 °C"), "mínus päť stupňov Celzia");
  assert.equal(sk("1,5 kg"), "jedna celá päť kilogramu");
  assert.equal(sk("3 km"), "tri kilometre");
  assert.equal(sk("120 km/h"), "sto dvadsať kilometrov za hodinu");
  assert.equal(sk("10–15 €"), "desať až pätnásť eur");
});

test("time, ranges, decimals, compounds", () => {
  assert.equal(sk("o 7:45"), "o sedem štyridsaťpäť");
  assert.equal(sk("o 7:05"), "o sedem nula päť");
  assert.equal(sk("o 14:00"), "o štrnásť hodín");
  assert.equal(sk("v rokoch 1939–1945"), "v rokoch tisíc deväťsto tridsaťdeväť až tisíc deväťsto štyridsaťpäť");
  assert.equal(sk("0,05"), "nula celá nula päť");
  assert.equal(sk("3,14"), "tri celé štrnásť");
  assert.equal(sk("5-ročný"), "päťročný");
  assert.equal(sk("2-ročný"), "dvojročný");
  assert.equal(sk("3-krát"), "trikrát");
  assert.equal(sk("2 knihy"), "dve knihy");
  assert.equal(sk("2 roky"), "dva roky");
  assert.equal(sk("1 250 000"), "milión dvestopäťdesiattisíc");
});

test("abbreviations", () => {
  assert.equal(sk("Napr. toto"), "Napríklad toto");
  assert.equal(sk("atď."), "a tak ďalej");
  assert.equal(sk("tj. to"), "to jest to");
  assert.equal(sk("firma XY, s. r. o."), "firma XY, eseró");
  assert.equal(sk("č. 5"), "číslo päť");
  assert.equal(sk("Ing. Novák"), "inžinier Novák");
  assert.equal(sk("cca 20"), "približne dvadsať");
  assert.equal(sk("(2 627 m n. m.)"), "(dvetisíc šesťsto dvadsaťsedem metrov nad morom)");
});

test("does not touch ordinary words", () => {
  const plain = "V lese bol mlyn a pri ňom starý mlynár, ktorý mal veľkú záhradu.";
  assert.equal(sk(plain), plain);
  assert.equal(sk("V. Novák prišiel"), "V. Novák prišiel");
  assert.equal(sk("Mám to v hlave."), "Mám to v hlave.");
});

test("user dictionary wins", () => {
  assert.equal(normalizeToText("SQL a 5 km", "sk", { dictionary: { SQL: "es kvé el" } }), "es kvé el a päť kilometrov");
});
