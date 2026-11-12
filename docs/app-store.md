# App Store listing: Prečítaj mi

Texts to paste into App Store Connect. Slovak and English localisation. Limits in brackets.

## App Information
- **Name** [30]: `Prečítaj mi` (if taken: `Prečítaj mi: PDF nahlas`). "Audify" was taken.
- **Subtitle** [30]
  - SK: `PDF a texty nahlas, bez cloudu`
  - EN: `Turn PDFs into audiobooks`
- **Primary category:** Books. **Secondary:** Education.
- **Content rights:** "Yes, it contains third-party content and I have the rights": the voice model Supertonic 3
  (OpenRAIL-M, allows distribution and use in apps; downloaded from Hugging Face on first use).
- **Age rating:** answer "None" / "No" to every question → 4+. No user-generated content shared with others, no web
  browser, no chat, no ads.
- **Privacy Policy URL:** https://lucky1097.github.io/pdf-audiokniha/privacy.html
- **App Privacy (nutrition label):** "Data Not Collected".

## Pricing and Availability
- Price: Free (0). Availability: all countries.

## Version 1.0
- **Support URL:** https://lucky1097.github.io/pdf-audiokniha/support.html
- **Marketing URL:** https://lucky1097.github.io/pdf-audiokniha/
- **Copyright:** `2026 <your name>`

### Promotional text [170]
- SK: `Vyber PDF a počúvaj ho ako audioknihu. Hlas vzniká priamo v telefóne, po slovensky aj po anglicky. Zadarmo, bez účtu a bez reklám.`
- EN: `Pick a PDF and listen to it as an audiobook. The voice is made right on your phone, in Slovak and English. Free, no account, no ads.`

### Keywords [100, comma-separated, no spaces after commas]
- SK: `audiokniha,pdf,predčítanie,nahlas,čítanie,text na reč,hlas,kniha,offline,slovenčina,tts`
- EN: `audiobook,pdf,read aloud,text to speech,tts,reader,voice,offline,slovak,ebook,listen`

### Description [4000]
SK:
```
Appka Prečítaj mi zmení PDF alebo text na audioknihu. Hlas vzniká priamo v tvojom telefóne, takže kniha nikam neodchádza.

AKO TO FUNGUJE
1. Raz stiahneš hlas (asi 380 MB, najlepšie cez Wi‑Fi).
2. Pridáš PDF zo Súborov alebo vložíš text.
3. Počúvaš. Prvé vety hrajú hneď, ďalšie sa pripravujú počas počúvania.

ČO VIE
• Číta po slovensky aj po anglicky, jazyk spozná sám.
• Kapitoly z osnovy PDF; ťukneš na kapitolu a hrá ďalej.
• Počas čítania zvýrazňuje text.
• Celú knihu alebo jednotlivé kapitoly pripraví na počúvanie bez internetu.
• Hrá aj pri zamknutej obrazovke a so slúchadlami.
• Slovník výslovnosti pre mená a skratky.
• Hotovú audioknihu pošleš ako súbor s kapitolami (.m4b).
• Vynechá čísla strán, hlavičky a poznámky pod čiarou.

SÚKROMIE
Bez účtu, bez reklám, bez analytiky. Knihy aj zvuk zostávajú len v tvojom telefóne.

OTVORENÝ SOFTVÉR
Appka je zadarmo a jeho kód je otvorený (licencia MIT). Hlas Supertonic 3 je vytvorený umelou inteligenciou; ak nahrávku zverejníš, uveď to.

Naskenované PDF bez textu zatiaľ čítať nevie.
```
EN:
```
Prečítaj mi (Slovak for “Read to me”) turns a PDF or any text into an audiobook. The voice is made right on your phone, so your book never leaves it.

HOW IT WORKS
1. Download the voice once (about 380 MB, Wi‑Fi recommended).
2. Add a PDF from Files or paste text.
3. Listen. The first sentences play at once; the rest is prepared while you listen.

FEATURES
• Reads Slovak and English and detects the language itself.
• Chapters from the PDF outline; tap a chapter and it plays on.
• Highlights the text as it reads.
• Prepares the whole book or single chapters for listening offline.
• Plays with the screen locked and with headphones.
• Pronunciation dictionary for names and abbreviations.
• Share the finished audiobook as one file with chapters (.m4b).
• Skips page numbers, headers and footnotes.

PRIVACY
No account, no ads, no analytics. Your books and audio stay on your phone.

OPEN SOURCE
The app is free and open source (MIT licence). The Supertonic 3 voice is AI-generated; if you publish a recording, say so.

Scanned PDFs without a text layer cannot be read yet.
```

### What's New [4000]
- SK: `Prvá verzia.` EN: `First release.`

## App Review Information
- **Sign-in required:** No.
- **Contact:** your name, phone and e-mail (only Apple sees them).
- **Notes** (English):
```
Prečítaj mi (Slovak for "Read to me") reads PDFs and text aloud with an on-device text-to-speech model. No account, no server of our own.

How to test:
1. On first launch tap "Stiahnuť hlas" (Download voice). The voice model (about 380 MB) downloads once from huggingface.co (Supertonic 3, OpenRAIL-M licence). Wi-Fi recommended; it takes a few minutes.
2. Tap "Vložiť text" (Paste text), paste any paragraph in English or Slovak and tap "Vytvoriť knihu" (Create book). Or "Pridať PDF" (Add PDF) to pick a PDF from Files.
3. In the book, tap a chapter: speech is generated on the device and starts playing within seconds.

The UI is in Slovak. "O appke a licencie" (About and licences) at the bottom of the library shows the privacy summary, the AI voice notice, the voice model's use restrictions and all licences.

Background audio (UIBackgroundModes audio) is used to keep playing the audiobook with the screen locked and to keep generating the next sentences while it plays. The increased-memory-limit entitlement is needed to load the voice model.
```

## Screenshots
- iPhone 6.9" set (1320 × 2868 or 1290 × 2796), 3 to 10 images. No iPad (supportsTablet is false).
- Shots: welcome screen, library with books, book screen with chapters, playback with highlighted text, sharing / O appke.
- Take them on the iPhone (side button + volume up); `tools/` will scale them to the App Store size.
