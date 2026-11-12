# Brief M: privacy and support pages on the site

## Goal
App Store Connect needs a Privacy Policy URL and a Support URL. Add two plain pages to the promo site (published
from apps/site to https://lucky1097.github.io/pdf-audiokniha/): privacy.html and support.html, Slovak first, then
English. The app is called "Audify" in the App Store; the web app keeps "Audiokniha".

## Files
Read: CLAUDE.md, apps/site/index.html (head and footer only: colours in `:root`, the footer at line ~440),
licenses/supertonic-3-OpenRAIL-M.txt (Attachment A at the end).
Create: apps/site/privacy.html, apps/site/support.html.
Change: apps/site/index.html: only add two links, "Súkromie" (privacy.html) and "Podpora" (support.html), to the
footer, in the style of the links already there. Nothing else in index.html.

## Look
Standalone pages, no external requests (no Google Fonts, no scripts): `font-family: system-ui, -apple-system,
"Segoe UI", sans-serif`. Inline `<style>`: max-width 42rem, centred, padding 24px 20px, line-height 1.6, 17px text,
colours from index.html (--p-bg #ffffff, --p-ink #111827, --p-muted #4b5563, accent #c2410c for links) and a dark
version under `@media (prefers-color-scheme: dark)` (bg #0f1115, ink #f3f4f6, muted #a3a9b6, links #fdba74).
`<meta name="viewport" content="width=device-width, initial-scale=1">`, `<html lang="sk">`, a `<title>`, the
favicon link as in index.html, a small "← Audiokniha" link to index.html at the top. The English part is a
`<section lang="en" id="en">` with an `<h2>`; a link "English" at the top jumps to #en.

## privacy.html: "Zásady ochrany súkromia" (EN: "Privacy Policy"), "Platné od 12. 11. 2026"
Covers the iPhone app Audify and the web app Audiokniha. Points, in plain short sentences:
- Nezbierame žiadne osobné údaje. Appka nemá účty, reklamy, analytiku ani sledovanie.
- Knihy, texty, slovník výslovnosti a vytvorený zvuk sú uložené len v tvojom zariadení a nikam ich neposielame.
  Zmažeš ich zmazaním knihy alebo celej appky.
- Hlasový model (asi 380 MB) appka raz stiahne zo stránky Hugging Face. Ako pri každom sťahovaní, Hugging Face
  pritom vidí IP adresu zariadenia; platia pre to zásady Hugging Face (link https://huggingface.co/privacy).
- Keď audioknihu zdieľaš, systém ju pošle tam, kam vyberieš ty.
- Táto stránka beží na GitHub Pages; GitHub môže zaznamenávať IP adresy návštevníkov (link
  https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement). Úvodná stránka
  načítava písmo z Google Fonts (link https://policies.google.com/privacy).
- Údaje nezbierame od nikoho, teda ani od detí.
- Zmeny zverejníme na tejto stránke s novým dátumom.
- Kontakt: e-mail `SUPPORT_EMAIL` (write exactly this placeholder as the visible text and in a mailto: link; the
  orchestrator replaces it).
The English section says the same.

## support.html: "Podpora" (EN: "Support")
- One line: Audify číta PDF a texty nahlas, po slovensky a po anglicky. Hlas vzniká priamo v telefóne.
- "Kontakt": "Napíš na SUPPORT_EMAIL." (same placeholder, mailto link) and "Chyby môžeš nahlásiť aj na GitHube"
  (link https://github.com/lucky1097/pdf-audiokniha/issues).
- "Časté otázky" (h2, each question an h3):
  - Ako pridám knihu? Ťukni na „Pridať PDF“ a vyber súbor zo Súborov. PDF z e‑mailu alebo zo Safari najprv ulož do
    Súborov. Text môžeš aj vložiť cez „Vložiť text“.
  - Prečo sa sťahuje 380 MB? To je hlasový model. Stiahne sa raz, najlepšie cez Wi‑Fi, a potom appka funguje aj bez
    internetu.
  - Moje PDF sa nedá prečítať. Naskenované strany bez textu zatiaľ čítať nevieme. Skús PDF, v ktorom sa dá text
    označiť.
  - Ako pošlem audioknihu niekomu inému? Na stránke knihy ťukni na tlačidlo zdieľania vedľa názvu. Ak nahrávku
    zverejníš, uveď, že hlas vytvorila umelá inteligencia.
  - Ako zmažem knihu? V knižnici knihu podrž prstom.
- "Podmienky použitia hlasu" (h2): "Hlas je model Supertonic 3 od Supertone Inc. pod licenciou OpenRAIL‑M. Používaním
  appky súhlasíš, že ho nepoužiješ:" then exactly this list:
  na nič, čo porušuje zákon; na zneužívanie alebo ubližovanie deťom; na šírenie overiteľne nepravdivých informácií
  s cieľom ublížiť iným; na šírenie osobných údajov, ktoré môžu niekomu ublížiť; na zverejňovanie obsahu bez jasného
  označenia, že ho vytvoril stroj; na ohováranie, ponižovanie alebo obťažovanie iných; na napodobňovanie iných ľudí
  bez ich súhlasu (deepfake); na plne automatické rozhodnutia, ktoré poškodzujú práva človeka; na diskrimináciu ľudí
  alebo skupín podľa správania, vlastností alebo chránených znakov; na zneužívanie zraniteľnosti ľudí pre ich vek,
  sociálnu situáciu, telesný alebo duševný stav; na lekárske rady a výklad lekárskych výsledkov; na súdne, policajné,
  imigračné alebo azylové rozhodovanie o ľuďoch.
  Then: "Záväzné je anglické znenie licencie:" link https://huggingface.co/Supertone/supertonic-3/blob/main/LICENSE.
- "Licencie": Kód appky je otvorený pod licenciou MIT (link https://github.com/lucky1097/pdf-audiokniha).
- English section: the same; for the voice terms copy the English "Attachment A / Use Restrictions" list (a) to (m)
  verbatim from licenses/supertonic-3-OpenRAIL-M.txt.

## Done when
1. `grep -c "SUPPORT_EMAIL" apps/site/privacy.html apps/site/support.html` shows at least 2 per file.
2. `grep -c "fonts.googleapis\|<script" apps/site/privacy.html apps/site/support.html` shows 0 for both files.
3. `grep -c "privacy.html\|support.html" apps/site/index.html` prints 2 or more, and `git diff --stat -- apps/site/index.html`
   shows only a few added lines.
4. `grep -c "<li" apps/site/support.html` is at least 25 (12 Slovak + 13 English restrictions).
5. `npm run build:site -w @audiokniha/web` from the repo root exits 0.
