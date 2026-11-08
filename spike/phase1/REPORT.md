# Fáza 1: jadro + CLI

Dátum: 2026-11-08. Stroj: i3-10105F, 16 GB RAM, bez GPU (Supertonic 3 fp32 cez onnxruntime-node na CPU, 4 vlákna).

## Čo vzniklo

| Časť | Kde | Testy |
|---|---|---|
| Normalizátor SK/EN (čísla, radové číslovky so skloňovaním, dátumy, meny, %, °C, jednotky, čas, rozsahy, rímske číslice, skratky, slovník výslovnosti) | `packages/core/src/normalize/` | 13 SK + 5 EN, kardinály zhodné s `num2words` |
| Rozdelenie na vety (krátke sa spájajú, dlhé sa delia od 160 znakov) | `packages/core/src/segment.ts` | 5 |
| Čítanie PDF: riadky, dva stĺpce, hlavičky/päty, čísla strán, poznámky pod čiarou, obsah, rozdelené slová, kapitoly z osnovy alebo nadpisov, detekcia skenov | `packages/core/src/pdf/layout.ts` + `apps/cli/src/pdf.ts` (pdf.js) | 4 vygenerované PDF so známym obsahom |
| Supertonic 3 engine (onnxruntime-node aj -web, deterministický seed, rozhranie `TtsEngine` pre iOS) | `packages/tts/` | cez CLI |
| CLI: `synth`, `book` (PDF → kapitoly → WAV → M4B s kapitolami a značkou AI), `bench`, `normalize` | `apps/cli/` | `npm test` 25/25, `tsc` bez chýb |

Spustenie: `node apps/cli/src/main.ts book kniha.pdf --lang sk --voice F4 --out vystup`.

## Overenie na celých kapitolách (`align_check.py`)

Celá kapitola sa prepíše Whisperom (large-v3-turbo). Prepis sa preženie naším normalizátorom (Whisper píše číslice) a zarovná sa s textom ako celok. Slovenčina sa porovnáva podľa zvuku.

| Kapitola | Viet | Zvuk | Odchýlky | Opakovania | Vynechania |
|---|---|---|---|---|---|
| Kukučín (Wikipédia), F4 | 87 | 10,1 min | 8,4 % | 0 | 0 |
| Kukučín, M2 | 87 | 11,2 min | 7,9 % | 0 | 1 |
| Vysoké Tatry (Wikipédia), F4 | 99 | 11,7 min | 13,1 % | 1 | 1 |
| Vysoké Tatry, M2 | 99 | 13,1 min | 10,8 % | 0 | 0 |
| Vysoké Tatry, F4, po úprave delenia viet | 108 | 11,9 min | 11,3 % | 2 skutočné + 1 z normalizátora | 0 skutočných (3 boli výpadky Whispera) |
| Sherlock Holmes (Gutenberg), F4 | 80 | 8,1 min | 0,7 % | 1 | 0 |
| Holmes, po úprave delenia viet | 92 | 8,3 min | 0,8 % | 0 | 0 |
| High Tatras (Wikipédia, EN), F4 | 80 | 6,9 min | 22,5 % | 1 | 0 skutočných* |

\* Vynechania v anglických Tatrách boli výpadky Whispera. Overil som to opätovným prepisom úseku (`recheck_range.py`): hlas prečítal všetko. Vysoké % odchýlok tvoria poľské a slovenské názvy v anglickom texte.

**Výsledky:**

- **Opakovania sú zriedkavé:** približne 5 v ~730 vetách (~95 min zvuku), čiže asi jedno za 20 minút. Vo fáze 0 hlas pri generovaní celého odseku opakoval niekoľkokrát v 30 sekundách.
- **Opakovanie je náhodné podľa seedu** (`repeat_seeds.ts`). „Kriváň, Kriváň“ sa zopakovalo s tým istým seedom, s iným nie (seed 1: 1/5 pokusov pri 8 krokoch, 0/5 pri 16 krokoch, druhá veta 0/10). **Opravou je vygenerovať vetu znova s novým seedom.**
- **Zvyšné odchýlky** sú hlavne vlastné mená (Didolićová, Ždiarska brázda, cudzojazyčné názvy) a Whisperov pravopis. Slovník výslovnosti v editore to bude riešiť.
- **Normalizátor:** chyby nájdené na skutočných textoch sú opravené a pokryté testami (rok + skratky n. m., dátum bez roka „od 1. 11. – 15. 6.“, „m.n.m.“, *, †). Dlhé číslovky sa píšu po slovách („dvetisíc šesťsto dvadsaťsedem“), lebo dlhé zložené slovo hlas raz pokazil.
- **Rýchlosť na CPU:** RTF 0,22–0,27, teda kapitola s 10 minútami zvuku sa vygeneruje za ~2,5 min.

## Rozhodnutia pre appku (fáza 2)

1. **Generovanie po vetách** s rozdelením od 160 znakov. Hotové v jadre.
2. **Pri WebGPU predvolene 16 krokov** (lacné), na CPU 8.
3. **„Vygenerovať znova“** pri každej vete použije seed + 1.
4. **Voliteľná automatická kontrola** malým Whisperom v zariadení. Pri zistenom opakovaní veta automaticky dostane nový seed. Na webe s WebGPU je to realistické, na iPhone až po meraní.

## Otvorené

- **M4B je overený** (2026-11-08, ffmpeg 8 z gyan.dev v `tools/ffmpeg/`, gitignored). Testovacie PDF dalo `book.m4b` s týmito vlastnosťami:
  - 2 kapitoly so správnymi časmi,
  - názov a žáner Audiobook,
  - `comment` s označením AI,
  - jazyk stopy `slk`,
  - AAC mono, 57 kb/s, teda ~25 MB na hodinu.

  Bez ffmpeg príkaz `book` uloží kapitoly ako WAV + `chapters.ffmeta`.
- **Naskenované PDF:** zatiaľ len detekcia, OCR je vo fáze 6.
- **PDF testy** sú na vlastných vygenerovaných PDF. Skutočné knihy (sadzba z InDesignu, ligatúry, poznámky na konci knihy) sa ešte len ukážu.

Texty na testy: `fetch_texts.py` (Wikipédia CC BY-SA, Gutenberg public domain). Nie sú v gite.
