---
version: 1
slug: "apps-web-src"
primary_target: "apps/web/src"
related_targets: []
---

# Web app: library, book, player, editor

**Scope:** the whole web app in `apps/web/src`: library, book view, chapter text editor and player. **Mode: Operate.**

**Audience and job:**
- Everyday listeners, students, people who find reading hard.
- The job: import a PDF, start listening, fix a misread sentence, export.

**Constraints:**
- Slovak UI.
- Light and dark from the system setting.
- Phone width up.
- WCAG 2.2 AA.
- Large tap targets (44 px).
- Keyboard-complete player.

## Direction contract

**THESIS:** a well-made audiobook app, the category standard at Audible/BookPlayer craft. Listening leads, editing is one tap away. It refuses the "developer tool" look of the sketch (toolbar of selects over a wall of textareas).

**OWN-WORLD:** neutral ground (white / near-black), ink #111827, one warm orange accent for play, progress and selection. Generated typographic covers carry each book's colour. System UI type at one scale, tabular figures. Rounded 12 px surfaces, soft offset shadows only on the player. One drawn icon set.

**STORY:**
1. The listener sees their books as covers with progress.
2. They open one and press a big Play.
3. Generation progress is visible but quiet.
4. Fixing text happens inside a chapter, sentence by sentence.

**FIRST VIEWPORT (book, desktop):**
- **Left:** a 240 px sidebar with the app name, the library and "Pridať knihu".
- **Center:** the book header (cover, title, author, meta, a big Play button, a generation progress row), then the chapter list with durations and state.
- **Right:** a 400 px player panel: cover, chapter title, scrubber, transport, speed.
- **Mobile:** single column, a bottom mini player, and a full player sheet on tap.

**FORM:** the category standard (canon), chosen by the user. seed:0288a0ef43fc992f

**FINISH:** unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
