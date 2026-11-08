# Audiokniha pre iPhone

Expo (React Native) appka. Používa rovnaký engine (`packages/tts`), normalizér a model knihy (`packages/core`) ako web.
Hlas Supertonic 3 beží v telefóne cez onnxruntime-react-native na CPU. Model (asi 380 MB) sa stiahne pri prvom
prehrávaní do telefónu a potom hlas funguje aj bez internetu. PDF číta pdf.js v skrytom WebView, rovnako ako na webe.

## Prvá inštalácia do iPhonu (bez Macu)

Postaví sa v cloude cez EAS a nainštaluje ako „development build“. Potom sa zmeny v kóde dostanú do telefónu cez Wi‑Fi
z počítača, bez ďalšieho buildu.

1. Nainštaluj EAS CLI a prihlás sa (účet na expo.dev je zadarmo):
   ```bash
   npm install -g eas-cli
   ```
   ```bash
   eas login
   ```
2. V priečinku `apps/mobile` prepoj projekt s Expo (doplní `projectId` do `app.json`):
   ```bash
   eas init
   ```
3. Zaregistruj iPhone. Príkaz ukáže QR kód; otvor ho v iPhone a nainštaluj profil:
   ```bash
   eas device:create
   ```
4. Spusti build. EAS sa spýta na prihlásenie do Apple Developer účtu a sám vytvorí certifikáty:
   ```bash
   eas build -p ios --profile development
   ```
   Trvá to asi 15–30 minút. Na konci dostaneš odkaz a QR kód na inštaláciu.
5. V iPhone zapni **Nastavenia → Súkromie a bezpečnosť → Režim pre vývojárov** (iPhone sa reštartuje).
6. Na počítači spusti server (iPhone a počítač musia byť na tej istej Wi‑Fi):
   ```bash
   npm start -w @audiokniha/mobile
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
