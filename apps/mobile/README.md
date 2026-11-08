# Audiokniha pre iPhone

Expo (React Native) appka. Používa rovnaký engine (`packages/tts`), normalizér a model knihy (`packages/core`) ako web.
Hlas Supertonic 3 beží v telefóne cez onnxruntime-react-native na CPU. Model (asi 380 MB) sa stiahne pri prvom
prehrávaní do telefónu a potom hlas funguje aj bez internetu. PDF číta pdf.js v skrytom WebView, rovnako ako na webe.

## Nová verzia cez TestFlight (hlavná cesta)

Appka sa postaví v cloude cez EAS (macOS s Xcode), podpíše sa Apple Developer účtom a nahrá do App Store Connect.
Do iPhonu sa inštaluje appkou **TestFlight**, bez režimu pre vývojárov a bez servera na počítači. Každá ďalšia verzia
príde v TestFlighte ako aktualizácia. EAS stavia to, čo je commitnuté.

V priečinku `apps/mobile` (v PowerShelli cez `eas.cmd`, pozri nižšie):

```bash
eas.cmd build -p ios --profile production --auto-submit
```

- Pri prvom spustení sa EAS spýta na Apple účet, vytvorí distribučný certifikát a App Store profil a ak appka v App
  Store Connect ešte nie je, založí ju (názov v obchode musí byť jedinečný; ak je „Audiokniha“ obsadený, zvoľ iný,
  názov pod ikonou v telefóne sa tým nemení).
- Build trvá 15–30 minút, potom ho Apple spracúva ďalších 5–15 minút. Číslo buildu sa zvyšuje samo.
- V App Store Connect → appka → **TestFlight** pridaj seba do **Internal Testing** (stačí raz). V iPhone potom v
  appke TestFlight ťukni **Inštalovať** / **Aktualizovať**.

## Development build (rýchle úpravy cez Wi‑Fi)

Postaví sa v cloude cez EAS a nainštaluje ako „development build“. Potom sa zmeny v kóde dostanú do telefónu cez Wi‑Fi
z počítača, bez ďalšieho buildu.

V PowerShelli na Windows sú skripty `npm.ps1`, `npx.ps1` a `eas.ps1` zablokované (execution policy), preto príkazy
nižšie volajú `npm.cmd` a `eas.cmd`. Okrem inštalácie sa všetky spúšťajú v priečinku `apps/mobile`.

1. Nainštaluj EAS CLI a prihlás sa (účet na expo.dev je zadarmo):
   ```bash
   npm.cmd install -g eas-cli
   ```
   ```bash
   cd C:\Users\Lucky\Documents\pdf-audiokniha\apps\mobile
   ```
   ```bash
   eas.cmd login
   ```
2. Prepoj projekt s Expo. Doplní `extra.eas.projectId` do `app.json`; túto zmenu treba commitnúť:
   ```bash
   eas.cmd init
   ```
3. Zaregistruj iPhone. Príkaz ukáže QR kód; otvor ho v iPhone a nainštaluj profil
   (Nastavenia → Stiahnutý profil):
   ```bash
   eas.cmd device:create
   ```
4. Spusti build. EAS sa spýta na prihlásenie do Apple Developer účtu, sám vytvorí certifikáty a profil a na App ID
   zapne schopnosť **Increased Memory Limit** (appka ju má v `app.json`, aby sa 380 MB model zmestil do pamäte):
   ```bash
   eas.cmd build -p ios --profile development
   ```
   Trvá to asi 15–30 minút, na bezplatnom pláne aj s čakaním v rade. Na konci dostaneš odkaz a QR kód na inštaláciu.
5. V iPhone zapni **Nastavenia → Súkromie a bezpečnosť → Režim pre vývojárov** (iPhone sa reštartuje).
6. Na počítači spusti server. iPhone a počítač musia byť na tej istej Wi‑Fi; ak sa Windows spýta na firewall pre
   Node.js, povoľ súkromnú sieť:
   ```bash
   npm.cmd start
   ```
   V appke v iPhone vyber server z ponuky alebo naskenuj QR kód z terminálu.

EAS stavia to, čo je v gite (commitnuté). Pred buildom treba zmeny commitnúť.

## Kontroly bez iPhonu

```bash
npm run typecheck -w @audiokniha/mobile
```
```bash
npm run bundle:ios -w @audiokniha/mobile
```

## Čo appka vie (fáza 5, prvý krok)

- knižnica, import PDF a textu, vloženie textu,
- stiahnutie modelu s priebehom, generovanie pred prehrávačom aj celej knihy (obrazovka zostane zapnutá),
- prehrávač s rýchlosťou a ovládaním na zamknutej obrazovke, hrá aj na pozadí,
- text kapitoly po vetách, „Znova“ pri zle prečítanej vete, výber hlasu a jazyka.

Zatiaľ chýba: export .m4b, slovník výslovnosti, CoreML (Neural Engine), generovanie s appkou na pozadí bez prehrávania.
