---
name: Audiokniha
description: Turn any PDF into an audiobook that is read aloud on your own device.
colors:
  accent: "#c2410c"
  accent-hover: "#9a3412"
  accent-soft: "#ffedd5"
  accent-text: "#c2410c"
  on-accent: "#ffffff"
  bg: "#ffffff"
  surface: "#f4f5f7"
  raised: "#ffffff"
  ink: "#111827"
  ink-2: "#4b5563"
  line: "#e5e7eb"
  warn: "#92400e"
  warn-soft: "#fef3c7"
  error: "#b91c1c"
  ok: "#15803d"
  accent-dark: "#fb923c"
  accent-hover-dark: "#fdba74"
  accent-soft-dark: "#3a2414"
  accent-text-dark: "#fdba74"
  on-accent-dark: "#1a0e05"
  bg-dark: "#0f1115"
  surface-dark: "#161920"
  raised-dark: "#1c2028"
  ink-dark: "#f3f4f6"
  ink-2-dark: "#a3a9b6"
  line-dark: "#2a2f3a"
  warn-dark: "#fbbf24"
  warn-soft-dark: "#3a2c0e"
  error-dark: "#f87171"
  ok-dark: "#4ade80"
typography:
  display:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI Variable Text", "Segoe UI", system-ui, Roboto, "Helvetica Neue", sans-serif'
    fontSize: "34px"
    fontWeight: 800
    lineHeight: 1.15
    letterSpacing: "-0.025em"
  headline:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI Variable Text", "Segoe UI", system-ui, Roboto, "Helvetica Neue", sans-serif'
    fontSize: "32px"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  title:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI Variable Text", "Segoe UI", system-ui, Roboto, "Helvetica Neue", sans-serif'
    fontSize: "20px"
    fontWeight: 700
    lineHeight: 1.3
  body:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI Variable Text", "Segoe UI", system-ui, Roboto, "Helvetica Neue", sans-serif'
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI Variable Text", "Segoe UI", system-ui, Roboto, "Helvetica Neue", sans-serif'
    fontSize: "15px"
    fontWeight: 600
    lineHeight: 1.3
  meta:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI Variable Text", "Segoe UI", system-ui, Roboto, "Helvetica Neue", sans-serif'
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.4
    fontFeature: '"tnum"'
rounded:
  xs: "6px"
  sm: "8px"
  md: "12px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  2xl: "28px"
  3xl: "40px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "0 18px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
  button-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "0 18px"
    height: "44px"
  button-quiet-hover:
    backgroundColor: "{colors.surface}"
  icon-button:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    size: "44px"
  play-button-large:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.pill}"
    size: "64px"
  chip:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "0 12px"
    height: "44px"
  chip-on:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
  tag:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.accent-text}"
    rounded: "{rounded.pill}"
    padding: "2px 8px"
  tag-warn:
    backgroundColor: "{colors.warn-soft}"
    textColor: "{colors.warn}"
  nav-item:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "0 12px"
    height: "44px"
  nav-item-active:
    backgroundColor: "{colors.raised}"
  input-field:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "12px 14px"
  mini-player:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "8px 10px 8px 8px"
---

# Design System: Audiokniha

## Overview

**Creative North Star: "The Well-Made Player"**

Audiokniha looks and behaves like a good audiobook app, held to the bar of Audible and BookPlayer. It is the category standard done with full craft, not a distinctive world. The ground is neutral (white in light mode, near-black in dark), the type is the platform's own UI face, and the colour comes from two sources only: one warm orange accent that marks what is playing, progressing, selected or focused, and the generated cover of each book. Listening leads. The player stays reachable from every screen, and editing is one tap away inside a chapter.

The density is calm and generous. Body text is 17px, every control is at least 44px tall, and figures that change (durations, positions, speeds) are tabular so they do not jitter. Depth is almost absent. Surfaces separate by tone (bg, surface, raised) and 1px hairlines. The only lifted things belong to the player. Shapes are soft: 12px panels, 8px rows and covers, and pill-shaped buttons and chips.

Light and dark are equal citizens and follow `prefers-color-scheme`. Every token has a paired dark value, and both pass WCAG 2.2 AA.

**Key Characteristics:**
- Neutral ground, one orange accent, colour covers as the only other hue.
- System UI type on a short scale; weight (600 to 800) carries hierarchy more than size.
- 44px minimum touch target on every interactive element.
- Flat, tonal surfaces; soft shadows reserved for the player.
- One drawn icon set: 24px grid, 2px round strokes.
- The player moves with the viewport: side panel, then floating mini player plus full-screen sheet.

## Colors

A neutral cool-grey ground with a single burnt-orange voice; book covers bring the variety.

### Primary
- **Burnt Orange** (accent; Ember Orange in dark): the Play button, the scrubber fill and thumb, progress bars, the selected speed chip, checked switches, the selected tab underline, the selected voice border, the current-book dot in navigation, the drop zone while dragging, the text caret, and the focus ring. Its darker step (accent-hover) is the hover state of filled accent controls.
- **Apricot Wash** (accent-soft): the tinted background for the sentence now playing, normalized-text highlights in the "how it will be read" preview, the selected voice row, the import icon disc, `::selection`, and the recommendation tag.
- **Orange Ink** (accent-text): accent-coloured text and icons on neutral or soft grounds (current chapter name and number, generation status icon, segmented control selection). It equals accent in light mode and lightens in dark mode to keep contrast.
- **On-Accent** (on-accent): text and glyphs on a filled accent surface; white in light, near-black brown in dark.

### Neutral
- **Paper White / Night** (bg): the page ground and the full-screen player sheet.
- **Mist Grey / Graphite** (surface): the sidebar, the side player panel, the generation row, segmented track, and hover fills on rows and quiet buttons.
- **Raised** (raised): the active nav item, inputs and textareas, the mini player, and the selected segment. In light mode it matches bg and lifts by contrast against surface.
- **Ink** (ink): primary text.
- **Slate** (ink-2): secondary text, metadata, durations, hints.
- **Hairline** (line): 1px borders and dividers, unfilled progress tracks, the off switch, the dashed import border.

### Status
- **Amber** (warn, warn-soft): uncertain guesses in the reading preview (wash plus a 2px underline) and warning notes.
- **Signal Red** (error): import errors and the armed delete button.
- **Leaf Green** (ok): the "nothing leaves the device" shield and the chapter-ready check.

### Generated cover colours
Covers are not tokens. Each book's cover is `hsl(65 + hash % 280, 45%, 30%)` from an FNV-1a hash of its title, so hues run from 65° to 344° and never enter the red-orange band the accent owns. 30% lightness keeps white title text at AA.

### Named Rules
**The One Voice Rule.** Orange means state: playing, progressing, selected, focused, or the one primary action. It is never decoration, never a heading colour, and never a section background.

**The Cover Band Rule.** Generated covers stay inside hues 65° to 344° at 45% saturation and 30% lightness. Apart from the amber warning and red error status tokens, nothing else may use the accent's hue band.

**The Paired Theme Rule.** Every colour exists as a light and dark pair and swaps through `prefers-color-scheme`. A new colour without its dark twin is unfinished.

## Typography

**Display Font:** the system UI stack (-apple-system, BlinkMacSystemFont, Segoe UI Variable Text, Segoe UI, system-ui, Roboto, Helvetica Neue, sans-serif)
**Body Font:** the same stack
**Label/Mono Font:** the same stack with tabular figures where numbers change

**Character:** the platform's own voice, the way native audiobook players speak. Hierarchy comes from heavy weights and tight tracking at the top, not from a second family.

### Hierarchy
- **Display** (800, 34px, 1.15, -0.025em): the book title on the book page; 26px on phones.
- **Headline** (800, 32px, 1.2, -0.02em): page titles; 26px on phones. The 22px/800 wordmark in the sidebar shares this treatment.
- **Title** (700, 20px): section titles, the chapter title in the player, the import heading, paragraph headings in the editor.
- **Body** (400, 17px, 1.55): all running text. Editor sentences use 1.65 and the source preview 1.75, both capped at 68ch.
- **Label** (600, 15px): buttons, nav items, tabs, form labels, chapter names.
- **Meta** (400, 14px, tabular figures): durations, scrub times, book metadata, player status. 13px/600 is the tag and small-print size.

### Named Rules
**The Steady Numbers Rule.** Any number that updates or lines up in a column (times, chapter numbers, speeds, progress) uses `font-variant-numeric: tabular-nums`.

**The One Family Rule.** The interface uses only the system UI stack. Hierarchy is built with weight, size and tracking.

## Layout

A three-column app shell on desktop: a 248px sidebar, a fluid main column, and a 380px player panel that appears only once something is playing. The main column centres content at 920px max with 40px side padding, 120px bottom padding (room for the mini player), and a 28px vertical rhythm between blocks.

The library is a cover grid: `auto-fill` columns of at least 168px with 28px row and 22px column gaps; two columns on phones. The book page puts a 200px cover beside the title block (32px gap), then tabs and a chapter list of 60px rows separated by hairlines.

Responsive behaviour:
- **At 1180px and below:** the player panel disappears. A floating mini player sits 16px above the bottom of the main column (cover thumb, chapter, time, play, and a 3px progress line along its bottom edge). Tapping it opens the full player as a full-screen sheet capped at 480px wide.
- **At 760px and below:** the sidebar becomes a horizontal top bar with icon-only nav (labels kept for screen readers). The privacy note hides, page padding drops to 24px/16px, and the book header stacks and centres. The mini player spans 12px from each edge and respects the safe-area inset.
- **On touch devices** (`hover: none`), hover-revealed controls (delete on a cover, re-generate on a sentence) are always visible.

Spacing steps that recur: 4, 8, 12, 16, 24, 28 and 40px, with 10px and 22px as the in-between gaps used inside rows and the player stack.

## Elevation & Depth

The system is flat and tonal. Surfaces separate by stepping between bg, surface and raised, with 1px hairlines. The only real shadows belong to the player, which is the one object meant to float above the library.

### Shadow Vocabulary
- **Player lift** (`box-shadow: 0 8px 24px rgba(17,24,39,0.08), 0 2px 6px rgba(17,24,39,0.06)`; dark: `0 8px 24px rgba(0,0,0,0.45), 0 2px 6px rgba(0,0,0,0.3)`): the large cover in the player and the floating mini player.
- **Panel edge** (`box-shadow: -8px 0 24px rgba(17,24,39,0.06)`): the left edge of the desktop player panel against the main column.
- **Thumb** (`box-shadow: 0 1px 3px rgba(0,0,0,0.3)`): the knobs of the scrubber and the toggle switch, so they read as draggable.
- **Cover hairline** (`box-shadow: inset 0 0 0 1px rgba(255,255,255,0.08)`, plus a 160° white sheen at 14% fading by 45%): gives every generated cover a printed edge.

### Named Rules
**The Only The Player Floats Rule.** Cards, rows, the library grid and page sections never cast shadows. A library cover answers hover with a 3px lift, not a shadow.

## Shapes

The shapes are soft and friendly. Panels, the import zone, the generation row and the mini player use 12px corners. Rows, inputs, covers, nav items and voice options use 8px. Anything pressable on its own (buttons, chips, tags, segmented controls, the delete pill) is a full pill, and Play and icon buttons are circles. Progress bars are 6px tall (4px under a library cover) with 3px rounded ends. Borders are always 1px hairlines; the one exception is the 2px dashed border of the import drop zone. Covers are square (1:1) and clip their content.

## Components

### Buttons
Pills that are clear and calm.
- **Shape:** full pill (999px), 44px minimum height, 600 weight at 15px.
- **Primary:** accent fill with on-accent text, 0 18px padding; hover steps to accent-hover over 0.15s.
- **Quiet:** transparent with a hairline border and ink text; hover fills with surface.
- **Small:** same height (44px), 0 12px padding, 14px text. Small is narrower, never shorter.
- **Disabled:** 45% opacity, default cursor.
- **Focus:** a 3px accent outline at 2px offset, used everywhere.

### Play Button (signature)
A filled accent circle with a solid triangle glyph. 64px on the book page, 44px in the mini player. Hover goes to accent-hover; pressing scales it to 0.95. It is the largest accent mass on any screen.

### Icon Buttons
44px transparent circles with ink glyphs; hover fills with surface. The player transport grows them to 52px with 28px spacing.

### Chips and Tags
- **Speed chips:** 44px pills with a hairline border and tabular 14px/600 text; the selected one fills with accent.
- **Tags:** 13px/600 small pills on accent-soft with accent-text (recommendation), or warn-soft with warn (uncertain guesses).
- **Segmented control:** a surface pill track with 4px inset; the selected segment is raised with accent-text and a hairline outline.

### Cards / Containers
- **Book card:** a square generated cover (8px radius) with the title (16px/700, two lines max), meta in slate, and a 4px progress bar. There is no card chrome; the cover is the card.
- **Generation row:** a surface panel at 12px radius with 14px/16px padding, holding the status, a spinner or check, and a progress bar.
- **Import zone:** a 2px dashed hairline border at 12px radius with 24px padding; while dragging, the border turns accent and the fill turns accent-soft.

### Inputs / Fields
- **Style:** raised fill, 1px hairline border, 8px radius, 12px 14px padding, 1.6 line height, accent caret.
- **Focus:** the global 3px accent outline.
- **Radios and checkboxes** use `accent-color` at 18px. **Switches** are 44x26 tracks, hairline-grey off and accent on, with a white 20px thumb that slides in 0.15s.

### Navigation
- **Sidebar (desktop):** a surface column with a 22px/800 wordmark, then 44px nav rows at 15px/600 with 8px radius. Hover fills with line, and the active row is raised. The open book shows as a row with an 8px accent dot. A green shield privacy note is pinned to the bottom.
- **Tabs:** 15px/600 slate labels on a hairline baseline; the selected tab is ink with a 3px accent underline.
- **Phone:** the sidebar becomes a top bar of icon-only nav items that scrolls sideways.

### Chapter List
60px rows with a tabular number column, the chapter name (600, ellipsis), duration and state. The current chapter turns its number and name accent-text. Rows hover to surface.

### Sentence Editor (signature)
Each sentence is a row with a 26px status dot: dashed hairline ring when not yet generated, surface disc when ready, accent disc when playing. The playing sentence gets an accent-soft wash. A re-generate icon appears on hover or focus, and is always visible on touch. The reading preview marks normalized text with accent-soft and uncertain guesses with warn-soft plus a 2px warn underline.

### Player
- **Panel / sheet:** a stack with 22px gaps. The cover is up to 320px with the player lift shadow, then centred status, chapter title and book name, then the scrubber, transport and speed chips.
- **Scrubber:** a 6px track filled with accent to the current position over line, and an 18px accent thumb with a 3px bg ring.
- **Mini player:** a raised bar at 12px radius with a hairline border and the player lift shadow, with a 3px accent progress line along its bottom edge.
- **Sheet motion:** rises 24px and fades in over 0.28s on `cubic-bezier(0.16, 1, 0.3, 1)`. All motion collapses under `prefers-reduced-motion`.

### Icons
One drawn set on a 24px grid with 2px round-capped, round-joined strokes in `currentColor`. Shapes are filled only where the glyph is solid (play, pause, skip, stop). Icons are inline SVG, hidden from assistive technology, and sit beside a text label or an aria-label.

## Do's and Don'ts

### Do:
- **Do** keep every interactive element at 44px or more in its smallest dimension; make compact variants narrower, never shorter.
- **Do** reserve the accent for play, progress, selection, focus and the single primary action on a screen.
- **Do** give every new colour a dark-mode pair and check both against WCAG 2.2 AA.
- **Do** use tabular figures for any number that updates or aligns.
- **Do** draw new icons on the 24px grid with 2px round strokes, matching the existing set.
- **Do** separate surfaces with tone (bg, surface, raised) and 1px hairlines before reaching for a shadow.
- **Do** make hover-revealed controls permanently visible under `hover: none`, and honour `prefers-reduced-motion`.

### Don't:
- **Don't** add a second accent hue, or use orange for headings, decoration or section fills.
- **Don't** generate covers or illustrations inside the accent's red-orange band (345° to 65°). The amber warning and red error tokens are the only other hues allowed there, and only for status.
- **Don't** put shadows on library cards, rows, tabs or page sections; only the player floats.
- **Don't** add a web font or a second type family; use the system UI stack.
- **Don't** use icon fonts, emoji or mixed icon sets.
- **Don't** borrow the identity of the author's other project, Hits & Licks (black noir, blackletter, pixel art).
