# Fáza 0: správa z testu hlasov

Dátum: 2026-11-07. Merané na PC používateľa: Intel i3-10105F (4 jadrá / 8 vlákien), 16 GB RAM, NVIDIA GTX 1050 Ti, Windows 10. V prehliadači išlo o Chromium 152 v desktopovej appke Claude.

## Čo sa testovalo

| Model | Balík | Jazyky | Licencia váh | Fonemizér |
|---|---|---|---|---|
| Supertonic 3 | sherpa-onnx int8 (145 MB), HF fp32 (380 MB) | 31 vrátane sk, en | BigScience OpenRAIL-M | netreba (unicode indexer) |
| Kokoro v1.0 | sherpa-onnx int8 multi-lang (140 MB) | en (+ ďalšie, bez sk) | Apache-2.0 | slovník + espeak-ng (GPL) pre neznáme slová |
| Piper sk_SK lili medium | sherpa-onnx (64 MB) | sk | dataset CC0 | espeak-ng (GPL) cez piper_phonemize |

Texty sú v `texts.py`: pre každý jazyk čistá próza a „zradný“ text s číslami, dátumami, skratkami, menami a dialógom. Ukážky sú v `samples/` a na stránke `samples/index.html`.

**Skripty:**
- `fetch_models.py` stiahne modely,
- `gen_samples.py` generuje ukážky a meria čas,
- `asr_check.py` / `asr_web.py` robia kontrolu Whisperom,
- `web/bench.html` + `serve.py` spúšťajú test v prehliadači,
- `build_page.py` postaví stránku na počúvanie.

## Rýchlosť (RTF = čas výpočtu / dĺžka zvuku; menej je lepšie)

| Model | Kde | RTF | Hodina knihy |
|---|---|---|---|
| **Supertonic 3** | **prehliadač, WebGPU, fp32** | **0,074** | **~4,5 min** |
| Supertonic 3 | prehliadač, WebGPU, int8 | 0,21 | ~13 min |
| Supertonic 3 | natívne CPU (sherpa-onnx, 4 vlákna), int8, 8 krokov | 0,27–0,38 | ~17–23 min |
| Supertonic 3 | natívne CPU, 16 krokov | 0,55 | ~33 min |
| Supertonic 3 | prehliadač, WASM (8 vlákien), int8 / fp32 | 0,98–1,13 | ~1 h |
| Piper sk | natívne CPU | 0,063 | ~4 min |
| Kokoro v1.0 | natívne CPU, int8 | 1,6–1,8 | ~1,7 h |

Načítanie Supertonicu: natívne 0,8 s. V prehliadači 4–9 s plus zahriatie WebGPU 2–7 s pri prvej vete.

## Presnosť (Whisper large-v3-turbo prepíše nahrávku a porovná ju s textom)

Podrobné prepisy sú v `samples/asr.json` a `samples/asr_web.json`.

Pri slovenčine počítame aj **WER podľa zvuku** (`score.py`). Whisper totiž zapisuje homofóny podľa sluchu („vysela“ namiesto „visela“, „rietka“ namiesto „riedka“), čo poslucháč nerozozná. Preto sa zjednotí y/i a znelé/neznelé páry.

| Ukážka | WER | WER podľa zvuku | CER |
|---|---|---|---|
| SK próza: Supertonic hlas 3, 8 krokov | 13,5 % | 9,6 % | 2,7 % |
| SK próza: Supertonic hlas 3, 16 krokov | 11,5 % | 7,7 % | 2,4 % |
| SK próza: Supertonic hlas 6 | 11,5 % | 9,6 % | 3,7 % |
| SK próza: Piper lili (kontrola) | 15,4 % | 11,5 % | 2,4 % |
| SK próza: Supertonic v prehliadači (WebGPU, štýl F1, kratší text) | 7,5 % | 2,5 % | 0,5 % |
| SK zradný text: Supertonic hlas 3 / 6 | 23,7 / 30,5 % | 23,7 / 27,1 % | 9,7 / 14,6 % |
| SK zradný text: Piper | 27,1 % | 27,1 % | 12,2 % |
| SK galéria, 10 hlasov × 1 veta | 0 % | 0 % | 0 % |
| EN próza: Supertonic hlas 3 / 6 | 0 / 0 % | | 0 / 0 % |
| EN próza: Kokoro af_heart / am_michael / bf_emma | 1,8 / 3,6 / 0 % | | |
| EN zradný text: Supertonic hlas 3 / 6 | 6 / 32 % | | 1,4 / 37 % |
| EN zradný text: Kokoro (s espeak aj bez neho rovnako) | 38 % | | 25,8 % |

**Skutočné chyby hlasu**, ktoré prepisy ukazujú (nie pravopis Whispera):

- **Opakovania a vsuvky:** Supertonic hlas 6 povedal „hmla-hmla“. V zradnom texte zopakoval celú vetu („Jana si povzdychla“ dvakrát), dal „dejinách uhynách Uhorska“ a na konci vsunul nezmysel „U Dja“. Pri hlase 3 sa to nestalo. Hlas 6 mal problém aj v angličtine (32 %).
- **Dĺžka a mäkkosť:** „prebudza“ namiesto „prebúdza“, „vonial“ namiesto „voňal“, „zlboka“ namiesto „zhlboka“ (všetky Supertonic hlasy). „hnlá“ namiesto „hmla“ pri 8 krokoch zmizlo pri 16 krokoch.
- **Symboly a skratky:** „3 °C“, „€“, „t. j.“, „napr.“ a „$1,250.75“ nečíta správne žiadny model. Kokoro navyše úplne vynecháva neznáme slová: čísla, „Evans“, „O'Neill“ a s americkým slovníkom aj „Clara“.

Poznámka: WER meria, či boli povedané správne slová, nie ako prirodzene hlas znie. O kvalite rozhoduje posluch. Rýchlosť je meraná len na tomto PC; iPhone, notebooky s integrovanou grafikou, Safari na mobile a dlhé behy (prehrievanie, pamäť) netestované.

**Stránka na počúvanie:** https://claude.ai/artifact/X8BrN4H5b6hVqPtMdiUQQ8 (súkromná).

## Zistenia

1. **Supertonic 3 je jediný kandidát, ktorý spĺňa všetky podmienky naraz:**
   - slovenčina aj angličtina jedným modelom,
   - beží v prehliadači (WebGPU aj WASM) aj natívne,
   - nepotrebuje GPL fonemizér,
   - má licenciu, ktorá povoľuje šírenie.
2. **sherpa-onnx 2.0 vyhodil espeak-ng.** Piper a Kokoro preto pre neznáme slová potrebujú externý fonemizér. Ten je pre slovenčinu aj angličtinu v praxi espeak-ng (GPL-3), čo nepatrí do iOS buildu. Kokoro bez neho **ticho vynecháva** čísla, mená a slová s úvodzovkami (`12`, `2019`, `Evans`, `O'Neill`, `"It's`).
3. **Kokoro je na CPU pomalší ako reálny čas.** Na webe by mohol bežať cez WebGPU, ale problém s fonemizérom ostáva. Do MVP ho nedávame. Neskôr ho môžeme pridať ako voliteľný anglický hlas, ak sa nájde G2P bez GPL (misaki + slovník, OpenPhonemizer).
4. **Normalizácia textu je nutná** (fáza 1). Supertonic síce dátumy a čísla v slovenčine čiastočne zvláda sám, ale zradný text má výrazne viac chýb (pozri tabuľku). Riešenie: SK/EN normalizátor (čísla so skloňovaním aspoň v základnom tvare, dátumy, °C, €, %, skratky ako napr., t. j., s. r. o.) a používateľský slovník výslovnosti.
5. **Viac krokov** (16 namiesto 8) zdvojnásobí čas a mierne znížil chyby (9,6 → 7,7 % podľa zvuku). Na webe s WebGPU si to môžeme dovoliť; na CPU predvolene 8.
5b. **Opakovania sú hlavné riziko kvality** pri dlhých knihách. Riešenia pre fázu 1–2:
   - krátke segmenty (jedna veta až krátky odsek),
   - detekcia podozrivých segmentov podľa pomeru dĺžky zvuku k počtu znakov (opakovanie predĺži zvuk) a automatické pregenerovanie s iným seedom,
   - tlačidlo „vygenerovať znova“ v editore,
   - predvolený hlas vyberať aj podľa stability (hlas 3 bol v teste stabilnejší ako hlas 6).
6. **Licencia OpenRAIL-M** povoľuje šírenie v appke aj na webe, aj komerčne. Povinnosti:
   - odovzdať obmedzenia použitia (príloha A) používateľom a priložiť licenciu,
   - zachovať autorské poznámky.
   - Jedno z obmedzení zakazuje **zverejňovať generovaný obsah bez označenia, že je strojovo generovaný**. Appka preto zobrazí upozornenie a export zapíše do metadát M4B „hlas generovaný AI (Supertonic 3)“.
7. **Supertonic 3 je od 9. 9. 2026 archivovaný.** Váhy sú zamrznuté, ale ekosystém žije: sherpa-onnx, CoreML fp16 (iOS 18+, Neural Engine), ExecuTorch od Software Mansion (`react-native-executorch`), LiteRT a MLX. Váhy si zrkadlíme.
8. **Kvantizácia:** podľa CoreML konverzie plné fp16 degraduje kvalitu (SNR ~24 dB), zmiešaná presnosť je v poriadku (47–51 dB). int8 podľa Software Mansion mierne zhorší WER na angličtine (3,7 oproti 3,3). Na webe zatiaľ fp32 (rýchle) a int8 ako „úsporné stiahnutie“.

## Fáza 0b: dajú sa čísla a opakovania opraviť? (`exp_fixes.py`)

**Postup:** zradné texty som ručne prepísal tak, ako ich má prepisovať normalizátor („15. marca“ → „pätnásteho marca“, „3 °C“ → „tri stupne Celzia“, „12,50 €“ → „dvanásť eur päťdesiat centov“, „napr.“ → „napríklad“). Každú vetu som generoval zvlášť:
- SK: hlasy 3 a 6, 3 pokusy, spolu 36 viet,
- SK pôvodný text: 1 pokus na hlas, 12 viet,
- EN: 1 pokus na hlas, 8 viet.

Každú vetu skontroloval Whisper. Výsledky sú v `samples/fixes/results.json`.

**Výsledky:**

- **Čísla po normalizácii sedia.** Whisper počul „15. marca 2024“, „3 stupne Celzia“, „12,50 eur“, „30 %“ a v angličtine presne „$1,250.75“, „1.5-kilogram“, „7.45 in the evening“.
  - Bez normalizácie to isté znelo ako „Žiliná Citrio C“, „3 c“, „2750“, „petaci do marca“, „two to fifty followers“.
  - Chyby po normalizácii: 2 z 36 viet („300 celciá“, „6612“), v iných pokusoch tá istá veta prešla.
- **Po vetách nevzniklo ani jedno opakovanie:** 0 zo 48 viet, ani pri hlase 6. Celý odsek naraz pritom predtým opakoval vety aj slová.
- **Dĺžka vety je pri každom pokuse rovnaká** (prediktor dĺžky je deterministický), mení sa len šum. Opakovanie ani chybu sa teda nedá odhaliť podľa dĺžky. Pregenerovanie ale pomáha, lebo každý pokus znie inak.
- **Veľmi krátke vety** („Kapitola tri.“) Whisper rozpoznal zle vo všetkých pokusoch („Capitola tree“). Neviem, či je chyba v hlase alebo vo Whisperi pri 1-sekundovom klipe. Krátke vety budeme spájať so susednou.
- **Malý test:** 6 slovenských viet. Fáza 1 musí overiť celú kapitolu.

**Dôsledky pre fázu 1:**

1. **Normalizátor SK/EN** v TypeScripte:
   - čísla, radové číslovky so skloňovaním podľa kontextu (dátum = genitív, „v 19. storočí“ = lokál),
   - meny, °C, %, čas, rozsahy,
   - slovník skratiek.
   - `num2words` vie po slovensky základné čísla a meny, ale nie radové číslovky. Poslúži ako testovací vzor.
2. **Generovanie po vetách:** krátke vety spájať (min. ~4 slová), dlhé deliť na čiarkach (max. ~250 znakov).
3. **Voliteľná kontrola kvality:** malý Whisper v zariadení prepíše každú vetu. Pri nezhode sa veta automaticky pregeneruje (max. 2–3×), inak sa označí v editore. Stojí výkon navyše a slovenský ASR má sám chyby, preto je voliteľná.
4. **V editore:** náhľad „ako sa to bude čítať“ (normalizovaný text, zvýraznené prepisy), tlačidlo „vygenerovať znova“ a slovník výslovnosti.

## iOS: generovanie na pozadí

- `BGContinuedProcessingTask` (iOS 26) je určený na úlohy spustené používateľom s ukazovateľom priebehu. Vývojári na fórach Apple však hlásia, že sa **pri zamknutom zariadení zastavuje** a niekedy nepredvídateľne skončí.
- **Návrh:**
  - generovať dopredu, kým hrá zvuk (režim audio na pozadí je legitímny, appka prehráva),
  - celú knihu generovať pri otvorenej appke s priebehom,
  - `BGContinuedProcessingTask` použiť ako pokus navyše, nie ako jedinú cestu.
- **Runtime:** sherpa-onnx (C/Swift API) cez vlastný Expo modul, alebo `react-native-executorch` so Supertonic 3 od Software Mansion. Rozhodne prototyp vo fáze 5.

## Rozhodnutia pre plán

- **Hlas pre SK aj EN:** Supertonic 3. Hlasy F1–F5 / M1–M5, predvolene vyberie používateľ po posluchu.
- **Web:** onnxruntime-web, WebGPU s fp32, záloha WASM. Model sa stiahne pri prvom použití a uloží sa do Cache Storage.
- **iOS:** natívny runtime (sherpa-onnx alebo ExecuTorch) s int8 alebo CoreML.
- **Do MVP nejde:** Kokoro ani Piper (GPL fonemizér), OmniVoice (CC-BY-NC, ťažký).
- **Fáza 1** začína normalizátorom SK/EN, lebo ten najviac ovplyvní kvalitu.

## Zdroje

- Supertonic 3: https://github.com/supertone-inc/supertonic · licencia: https://huggingface.co/Supertone/supertonic-3/blob/main/LICENSE
- sherpa-onnx Supertonic: https://k2-fsa.github.io/sherpa/onnx/tts/supertonic.html
- CoreML fp16: https://huggingface.co/aufklarer/Supertonic-3-CoreML-FP16
- ExecuTorch: https://huggingface.co/software-mansion/supertonic-ExecuTorch
- BGContinuedProcessingTask: https://developer.apple.com/forums/thread/796138 · https://developer.apple.com/forums/thread/805554
- G2P bez GPL: https://github.com/ai-ecoverse/slicc-ortllama/pull/49 · https://pypi.org/project/openphonemizer
