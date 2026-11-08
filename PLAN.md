# PDF → audiokniha: plán projektu

Pracovný názov priečinka: `pdf-audiokniha` (meno appky vymyslíme vo fáze dizajnu).

## Cieľ

Web aj iOS appka, ktorá z ľubovoľného PDF spraví audioknihu. Text sa dá pred čítaním upraviť v editore, podobne ako v ElevenLabs Projects. Všetko je zadarmo a open source.

**Pevné rozhodnutia (2026-11-07):**

- **Jazyky:** slovenčina a angličtina od začiatku, s výberom jazyka v appke. Ďalšie jazyky pridáme neskôr.
- **Žiadny cloud a žiadne GPU servery.** Hlas sa generuje v zariadení používateľa: v prehliadači (WebGPU, záložne WASM) a na iPhone (CPU alebo Neural Engine). Web je čisto statický hosting.
- **Platformy:** web a iOS v App Store. Android je bonus, ak Expo umožní lacný port.
- **Licencia nášho kódu:** MIT. Do iOS buildu nesmie ísť GPL/AGPL kód, lebo App Store a GPL sa nemajú radi.
- **Dizajn:** na appku (editor, prehrávač) používame **impeccable**, na promo web **taste-skill**. **frontend-design** slúži ako všeobecné pravidlá. Najprv funkčný náčrt, potom dizajnový prechod.
- **Voice Studio** (debpalash, AGPL-3.0) je len inšpirácia. Jeho kód nepreberáme.

## Stav po fáze 0 (2026-11-07)

Podrobnosti sú v `spike/phase0/REPORT.md`, ukážky na https://claude.ai/artifact/X8BrN4H5b6hVqPtMdiUQQ8.

- **Návrh: Supertonic 3 pre slovenčinu aj angličtinu.** Čaká sa na posluch používateľa.
  - Bez GPL, licencia povoľuje šírenie.
  - WebGPU v prehliadači: RTF 0,074, teda hodina knihy za ~4,5 min. Procesor tohto PC: RTF ~0,3. WASM: ~1,0.
- **Kokoro a Piper do MVP nejdú.** Kokoro bez GPL fonemizéra vynecháva slová a na CPU je pomalý. Piper potrebuje espeak-ng (GPL).
- **Fáza 1 začína:** normalizátorom SK/EN (čísla, dátumy, °C, €, %, skratky) a detekciou opakovaní (pomer dĺžka zvuku / počet znakov, automatické pregenerovanie).
- **Do appky patrí upozornenie** podľa OpenRAIL-M: zverejnený obsah treba označiť ako generovaný AI. Export to zapíše do metadát.
- **iOS runtime** sa vyberie vo fáze 5: sherpa-onnx (Swift/C), `react-native-executorch` (Software Mansion má Supertonic 3) alebo CoreML.

## Stav po fáze 2 (2026-11-08): webová appka, funkčný náčrt

`apps/web` (Vite + React). Spustenie: `npm run dev -w @audiokniha/web` → http://localhost:5178.

**Overené v Chromiu (desktopová appka, GTX 1050 Ti):**

- **Import:** PDF (pdf.js + pravidlá z `core`), textový súbor alebo vložený text. Jazyk sa rozpozná automaticky.
- **Hlasový model:** stiahne sa raz do Cache Storage a beží vo Web Workeri. WebGPU s fallbackom na 8-vláknový WASM.
- **Generovanie celej knihy na pozadí:** fronta začína pri mieste, ktoré sa počúva, a po obnovení stránky pokračuje sama. Hotové vety sú v IndexedDB.
- **Editor:**
  - kapitoly, odseky ako textové polia,
  - vety so stavom (hotová / generuje sa / čaká),
  - „Prehrať odtiaľto“ a „Znova“ (nový seed, len táto veta),
  - náhľad „Ako sa to prečíta“ so zvýraznením prepisov a neistých miest,
  - slovník výslovnosti, voľba jazyka, hlasu a kvality (8/16 krokov).
- **Úpravy textu** zneplatnia len zmenené vety, lebo kľúč cache je samotný prečítaný text.
- **Prehrávač:** po vetách, rýchlosť 0,75–2× bez zmeny výšky hlasu, pamätá si pozíciu, Media Session (ovládanie z klávesnice a zamknutej obrazovky).
- **Export .m4b v prehliadači:** WebCodecs + mediabunny a vlastná značka `chpl` s kapitolami a označením AI. ffmpeg ho prečíta aj celý dekóduje.

**Obmedzenia:**

- **Opus namiesto AAC:** Chromium v appke Claude nemá AAC kodér, preto export použil Opus. Či Apple Books prehrá Opus v .m4b, je neoverené. Chrome/Safari s AAC kodérom použijú AAC.
- **Veľkosť úložiska:** zvuk je ako 16-bit PCM, ~320 MB na hodinu knihy. Pred vydaním ho treba ukladať komprimovane (Opus/AAC po vetách).
- **Produkčný build** pribalí aj nepotrebný `ort-wasm…asyncify.wasm` (27 MB).
- **Hosting** musí posielať COOP/COEP aj pre `/ort/` (`public/_headers` pre Cloudflare Pages).
- **Netestované:** Safari, Firefox, mobil, kniha so stovkami strán.

## Stav po fáze 3 (2026-11-08): dizajn

- **Postup:** cez impeccable.
  - Produkt je opísaný v `PRODUCT.md`.
  - Používateľ si vybral štandard kategórie s latkou Audible a BookPlayer.
  - Dizajnový systém je v `DESIGN.md` a `.impeccable/design.json`.
- **Rozhranie:**
  - Knižnica s generovanými farebnými obálkami.
  - Stránka knihy s veľkým tlačidlom Prehrať, tichým riadkom priebehu generovania a kartami Kapitoly / Hlas / Výslovnosť / Export.
  - Editor kapitoly po vetách s prepínačom „Ukázať, čo sa prepísalo“.
  - Prehrávač: na desktope panel vpravo, na úzkych obrazovkách mini prehrávač a celoobrazovkový prehrávač. Ukazuje čas a pripravenosť kapitoly.
  - Svetlý aj tmavý režim, ovládanie aspoň 44 px.
- **Kontrola:** recenzent impeccable dal po jednom kole opráv (7 bodov) verdikt „ship“. Detektor nenašiel nič.
- **Nepreverené:** karta Výslovnosť a prázdne, chybové a načítavacie stavy (zachytené neboli).

## Hlasy (všetko v zariadení)

| Jazyk | Hlavný kandidát | Záloha | Poznámka |
|---|---|---|---|
| angličtina | **Kokoro 82M** (Apache-2.0, int8 ONNX asi 90 MB) | Supertonic 3 | najlepšia kvalita angličtiny na svoju veľkosť |
| slovenčina | **Supertonic 3** (99M, OpenRAIL-M, ONNX, 31 jazykov vrátane `sk`) | Piper `sk_SK` | jediný malý model so slovenčinou, ktorý beží v prehliadači aj na iOS |

**Fakty a riziká, ktoré musí overiť fáza 0:**

- **Supertonic 3** je od 9. 9. 2026 **archivovaný**. Váhy sú zamrznuté na Hugging Face (`supertone-oss-archive`) a podporu udržiava **sherpa-onnx** (balík `sherpa-onnx-supertonic-3-tts-int8-2026-05-11`). Váhy si zrkadlíme k sebe, aby sme neboli závislí od cudzieho úložiska.
- **Licencia OpenRAIL-M** povoľuje šírenie, ale obmedzenia použitia musíme odovzdať používateľom. Pred vydaním prečítať LICENSE a pridať ho do appky.
- **GPL fonemizér:** Kokoro potrebuje G2P (text → fonémy). `kokoro-js` a sherpa-onnx bežne používajú **espeak-ng (GPL-3)**. Na webe to vadí menej, ale v iOS buildu to byť nesmie. Treba nájsť G2P bez GPL (napríklad misaki alebo slovník + neurónový G2P), alebo použiť Supertonic aj na angličtinu. Supertonic fonemizér nepotrebuje (unicode indexer).
- **Kvalita slovenčiny** je zatiaľ neoverená. Rozhodne až posluchový test.
- **OmniVoice** má najlepšiu slovenčinu (0,6B), ale váhy sú CC-BY-NC a model je ťažký pre prehliadač aj iPhone. Ostáva ako voliteľný „HQ režim“ na Mac/PC neskôr, nie v MVP.

## Architektúra

```
PDF ─► text po stranách ─► čistenie ─► kapitoly ─► normalizácia ─► segmenty ─► TTS worker ─► audio cache ─► prehrávač / export M4B
       (pdf.js | PDFKit)   (hlavičky,  (osnova PDF,  (čísla, dátumy,  (vety/odseky)  (Kokoro |      (OPFS |      (kapitoly, rýchlosť,
                            päty, deľby  nadpisy)      skratky SK/EN)                  Supertonic)    súbory)      pozícia)
                            slov, stĺpce)
                                              ▲
                                              └── EDITOR: úpravy textu, výslovnosť, pauzy, hlas, jazyk úseku
```

### Monorepo (pnpm alebo bun workspaces)

```
packages/core        čisté TypeScript: čistenie textu, kapitoly, normalizácia SK/EN, segmentácia,
                     detekcia jazyka, slovník výslovnosti, model projektu (JSON). Bez DOM, bez natívneho kódu,
                     zdieľané webom aj mobilom. Pokryté testami.
packages/tts-web     Web Worker + onnxruntime-web (WebGPU → WASM), adaptéry Kokoro a Supertonic, fronta úloh
apps/web             Vite + React appka: import, editor, generovanie, prehrávač, export
apps/mobile          Expo (React Native): import, jednoduchší editor, prehrávač, natívny TTS modul
apps/site            promo web (taste-skill), statický
```

### Kľúčové časti

1. **Import PDF**
   - Web: pdf.js s pozíciami textu.
   - iOS: PDFKit.
   - Obe vracajú rovnaký formát „strany → riadky s pozíciou a veľkosťou písma“ pre `core`.
   - **Naskenované PDF** zatiaľ len detegovať a upozorniť. OCR (Tesseract, iOS Vision) príde vo fáze 6.
2. **Čistenie textu** (najťažšia časť, od nej závisí kvalita celej knihy):
   - opakujúce sa hlavičky, päty a čísla strán,
   - slová rozdelené na konci riadku,
   - dvojstĺpcová sadzba,
   - poznámky pod čiarou (vynechať alebo presunúť na koniec),
   - ligatúry,
   - obsah knihy (nečítať).
3. **Kapitoly:** z osnovy PDF (outline), inak z nadpisov podľa veľkosti písma, inak po N stranách.
4. **Normalizácia jazyka:**
   - SK: čísla so skloňovaním aspoň v základnom tvare, dátumy, rímske číslice, skratky (napr., atď., s. r. o., tzv., č.).
   - EN: čísla, Mr./Dr., jednotky.
   - Slovník výslovnosti, ktorý si používateľ môže rozšíriť.
5. **Výber jazyka:**
   - automatická detekcia jazyka knihy (franc alebo vlastný n-gram),
   - ručné prepnutie pre celú knihu,
   - v editore sa dá označiť úsek v inom jazyku (anglická citácia v slovenskej knihe).
6. **Editor** (web je plnohodnotný, mobil jednoduchší):
   - strom kapitol a odsekov s úpravou textu (TipTap/ProseMirror),
   - pri každom odseku stav (negenerované / generuje sa / hotové / zmenené) a tlačidlo „vygenerovať znova“,
   - značky pauzy, výber hlasu a rýchlosti pre knihu aj pre úsek.
7. **Generovanie na pozadí, v zariadení:**
   - **Web:**
     - model beží vo Web Workeri,
     - fronta segmentov sa ukladá do IndexedDB a audio do OPFS,
     - generovanie sa dá prerušiť a obnoviť, prežije reload,
     - režim „počúvaj hneď“ generuje dopredu pred prehrávačom, režim „celá kniha“ beží v pozadí, kým je karta otvorená,
     - na upozornenie, že je hotovo, slúži Notification API.
   - **iOS** obmedzuje beh na pozadí, a to ovplyvňuje návrh:
     - kým hrá audio (background audio), smieme generovať dopredu,
     - celá kniha sa generuje, keď je appka otvorená, alebo cez `BGContinuedProcessingTask` (iOS 26, úloha spustená používateľom s ukazovateľom priebehu; overiť vo fáze 0), záložne `BGProcessingTask` počas nabíjania.
   - **Cache** podľa hashu (text + hlas + rýchlosť + verzia modelu): po úprave jednej vety sa generuje len ten jeden segment.
8. **Modely:**
   - nie sú súčasťou appky, stiahnu sa pri prvom použití jazyka s ukazovateľom priebehu,
   - na webe sa ukladajú cez Cache Storage, na iOS do Application Support,
   - zdroj je Hugging Face alebo vlastné zrkadlo (CORS), verzie sú pripnuté.
9. **Prehrávač a export:**
   - kapitoly, rýchlosť 0,75–2×, pamäť pozície, časovač spánku,
   - iOS: uzamknutá obrazovka, CarPlay, AirPlay,
   - export M4B s kapitolami: web cez ffmpeg.wasm (LGPL build) alebo vlastný MP4 muxer, iOS cez AVFoundation; záložne MP3 po kapitolách.
10. **Súkromie:** nič neopúšťa zariadenie. Bez účtov a bez analytiky. Zásady ochrany súkromia sú krátke a pravdivé, čo pomôže aj pri schvaľovaní v App Store.

### Hosting a vydanie

- **Web:** GitHub Pages alebo Cloudflare Pages, zadarmo. Kvôli WASM vláknam treba hlavičky COOP/COEP; ak ich GitHub Pages nevie nastaviť, použijeme Cloudflare Pages.
- **iOS:**
  - Expo + EAS Build/Submit, takže **Mac netreba**,
  - Apple Developer účet za **99 $/rok** zakladá a platí používateľ sám,
  - natívny modul sherpa-onnx (Swift/C API) pre TTS.

## Fázy

Každá fáza končí niečím, čo sa dá vyskúšať. Najprv funkčnosť, potom dizajn.

### Fáza 0: test hlasov a rizík (1–2 dni)

- Rovnaký slovenský a anglický úryvok (aj s číslami, skratkami, dialógom) vygenerovať v Node/Python s Kokoro, Supertonic 3 a Piper `sk_SK`.
  - Zmerať rýchlosť (násobok reálneho času) na CPU tohto PC.
  - Uložiť WAV súbory na posluchový test; vyberá používateľ.
- Overiť licenciu Supertonicu (OpenRAIL-M) a nájsť G2P bez GPL pre Kokoro na iOS.
- Overiť, či Supertonic beží v prehliadači cez onnxruntime-web s WebGPU.
- Overiť `BGContinuedProcessingTask` podľa dokumentácie Apple.
- **Výstup:** krátka správa so zvolenými modelmi pre SK a EN a vzorky na vypočutie.

### Fáza 1: `packages/core` + CLI

- PDF → čistý text → kapitoly → segmenty → audio → M4B, zatiaľ bez UI.
- Testy na 4 typoch PDF: slovenský román, anglická odborná kniha, dvojstĺpcový článok a sken (iba detekcia).
- **Výstup:** príkaz `pnpm cli kniha.pdf` vyrobí audioknihu.

### Fáza 2: web, funkčný náčrt

- Import, výber jazyka a hlasu, editor, generovanie vo Workeri s frontou a obnovou, prehrávač, export.
- Škaredé, ale kompletné.
- **Výstup:** celá kniha prejde v prehliadači od začiatku do konca.

### Fáza 3: dizajn appky (impeccable)

- `/impeccable shape`: smer a vizuálna identita vlastná tomuto produktu (nie noir štýl Hits & Licks).
- Prechod editorom, prehrávačom, prázdnymi stavmi, chybami a priebehom generovania.
- Na záver `/impeccable audit` a `polish`, kontrola na mobile, klávesnica a prístupnosť.

### Fáza 4: promo web (taste-skill)

- Landing page s ukážkami hlasov v SK a EN, súkromím ako hlavným argumentom, odkazom na App Store a GitHub.
- Overenie jeho kontrolou v skutočnom prehliadači.

**Stav po fáze 4 (2026-11-08):** `apps/site/index.html`, statická stránka z kitu taste-skill (`apps/site/assets`).
- Rozdané: hero split, nav-centre, footer-statement, close-type, tlačidlá arrow, značka ring, podklad sand, moment letters-assemble; farby a písmo appky (Chivo).
- Sekcie: hero s prehrávačom → editor (app-frame) → súkromie (výrok + stav appky) → 4 skutočné nahrávky → otázky → 3 kroky → záver.
- Appka sa stavia do `apps/site/app` príkazom `npm run build:site -w @audiokniha/web` (relatívne cesty; worker berie `ort/` vedľa `assets/`). Priečinok je v .gitignore, nasadenie ho musí postaviť.
- `apps/site/_headers` pridá COOP/COEP pre `/app/*` (Cloudflare Pages / Netlify). Bez nich appka beží na WebGPU alebo na jednom vlákne CPU.
- Kontroly: copy-lint 0/0, perf 0/0, `gate.mjs` PASS s jednou výnimkou (hero-lines, `.taste-skill/waivers.json`). `check.mjs` potrebuje `CHROME_PATH` na Edge, Chrome tu nie je.
- Chýba: doména (canonical), odkaz na GitHub a App Store, keď budú.

### Fáza 5: iOS appka

- Expo, natívny sherpa-onnx modul, PDFKit import, prehrávač s uzamknutou obrazovkou, generovanie počas prehrávania.
- TestFlight, potom App Store.

**Zmena plánu a stav (2026-11-08):** namiesto sherpa-onnx a PDFKit:
- **Hlas:** onnxruntime-react-native 1.24 (JSI, nová architektúra, Expo plugin). Rovnaké API ako na webe, takže beží ten istý `SupertonicEngine` a výsledok je rovnaký.
- **PDF:** pdf.js v skrytom WebView (vložený pri inštalácii, funguje offline), rovnaké čítanie strán ako na webe. Netreba Swift, ktorý by sa dal skúšať iba buildmi v cloude.
- **Model knihy:** `project.ts` sa presunul do `packages/core`, takže web aj mobil majú rovnaké vety, kľúče a seedy.
- **Appka:** `apps/mobile` (Expo 58, React 19.3, RN 0.88). Web prešiel na React 19.3, aby bola v monorepe jedna verzia.
- **Overené bez iPhonu:** typecheck a Metro bundle pre iOS (Hermes). Na zariadení zatiaľ nič. Postup inštalácie je v `apps/mobile/README.md` (EAS development build + server cez Wi‑Fi).
- **Ďalej:** výkon na iPhone (RTF, prípadne CoreML), export .m4b, slovník, TestFlight.

### Fáza 6: rozšírenia

- OCR pre naskenované PDF a EPUB.
- Viac hlasov v jednej knihe (rozprávač a postavy).
- Ďalšie jazyky zo Supertonicu (čeština, nemčina…).
- Voliteľný HQ režim s OmniVoice na Mac/PC.
- Android.

## Otvorené otázky pre používateľa

- Názov appky a domény (fáza 3).
- Či chce zbierať dobrovoľné príspevky (GitHub Sponsors). Nemení to licencie, ale vylučuje modely s NC licenciou pre budúci HQ režim.

## Zdroje (overené 2026-11-07)

- VoiceStudio: https://github.com/debpalash/VoiceStudio (AGPL-3.0, OmniVoice ako predvolený engine)
- OmniVoice: https://github.com/k2-fsa/OmniVoice · jazyky: docs/languages.md (Slovak sk, ~2478 h) · váhy CC-BY-NC: https://huggingface.co/k2-fsa/OmniVoice
- Supertonic 3: https://github.com/supertone-inc/supertonic (archivovaný 9. 9. 2026, 31 jazykov vrátane sk, ukážka pre prehliadač) · sherpa-onnx: https://k2-fsa.github.io/sherpa/onnx/tts/supertonic.html
- Chatterbox Multilingual (bez slovenčiny): https://huggingface.co/ResembleAI/chatterbox
- Prehľady: https://www.yaps.ai/blog/best-local-tts-models · https://www.tryspeakeasy.io/blog/open-source-text-to-speech-2026
