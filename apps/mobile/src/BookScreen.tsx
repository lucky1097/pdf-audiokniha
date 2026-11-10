import { GARBLED_NOTE, type Voice } from "@audiokniha/core";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BookController, type BookState } from "./lib/book.ts";
import { getProject } from "./lib/storage.ts";
import { PlayerBar } from "./PlayerBar.tsx";
import { Dictionary } from "./Dictionary.tsx";
import { ReadAlong } from "./ReadAlong.tsx";
import { ShareBook } from "./ShareBook.tsx";
import { useColors, type Colors } from "./theme.ts";
import { Bar, Button, Cover, Note } from "./ui.tsx";

const VOICES: { id: Voice; label: string }[] = [
  ...(["F1", "F2", "F3", "F4", "F5"] as const).map((id, i) => ({ id, label: `Žena ${i + 1}` })),
  ...(["M1", "M2", "M3", "M4", "M5"] as const).map((id, i) => ({ id, label: `Muž ${i + 1}` })),
];

export function BookScreen({ id, onBack }: { id: string; onBack: () => void }) {
  const [ctl, setCtl] = useState<BookController | null>(null);
  useEffect(() => {
    let c: BookController | null = null;
    void getProject(id).then((p) => {
      if (p) setCtl((c = new BookController(p)));
    });
    return () => c?.dispose();
  }, [id]);
  return ctl ? <Book ctl={ctl} onBack={onBack} /> : null;
}

function Book({ ctl, onBack }: { ctl: BookController; onBack: () => void }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const st = useSyncExternalStore(ctl.subscribe, ctl.getState);
  const [voices, setVoices] = useState(false);
  const [dictionary, setDictionary] = useState(false);
  const [reading, setReading] = useState(false);
  const p = st.project;
  const ready = st.ready.reduce((a, b) => a + b, 0);
  const total = st.total.reduce((a, b) => a + b, 0);
  const left = total - ready;
  const pct = Math.round((ready / Math.max(1, total)) * 100);
  // Recounted when the ready count changes (a sentence was made or the audio was deleted).
  const audio = useMemo(() => ctl.audioSize(), [ctl, ready]);
  // Whole-book time estimate: recomputed only when the ready count or the measured speed changes, not per render.
  const mins = useMemo(() => Math.max(1, Math.round(ctl.estimate("all") / 60)), [ctl, ready, st.secondsPerChar]);
  const confirmDeleteAudio = () =>
    Alert.alert("Zmazať zvuk knihy?", "Text a záložka zostanú. Zvuk sa pri počúvaní pripraví znova.", [
      { text: "Zrušiť", style: "cancel" },
      { text: "Zmazať", style: "destructive", onPress: () => void ctl.deleteAudio() },
    ]);
  const chapterTitle = (i: number) => p.chapters[i]?.title || `Kapitola ${i + 1}`;
  const share = (i: number) => (i < st.chapter ? 1 : i > st.chapter ? 0 : Math.min(st.sentence + 1, st.total[i] ?? 0) / Math.max(1, st.total[i] ?? 0));
  const started = st.chapter > 0 || st.sentence > 0 || st.playing;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
      {/* Taps go through with the keyboard open ("Pridať" in the dictionary), and the inputs stay above it. */}
      <ScrollView contentContainerStyle={{ padding: 20, gap: 18, paddingBottom: 140 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
        <Button title="‹ Knižnica" kind="quiet" onPress={onBack} style={{ alignSelf: "flex-start", paddingHorizontal: 0 }} />
        <View style={{ flexDirection: "row", gap: 16, alignItems: "flex-end" }}>
          <Cover title={p.title} size={120} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={[s.h1, { color: c.ink }]} numberOfLines={3}>{p.title}</Text>
            <Text style={{ color: c.ink2, fontSize: 14 }}>
              {VOICES.find((v) => v.id === p.voice)?.label} · {p.lang === "sk" ? "slovenčina" : "angličtina"}
            </Text>
          </View>
          <View style={{ alignSelf: "center" }}>
            <ShareBook ctl={ctl} st={st} />
          </View>
        </View>

        <Status st={st} c={c} onRetry={() => ctl.retry()} />

        {/* Where the listening is: the chapter of how many, how far into it, and the way to its text. */}
        <View style={[s.card, { backgroundColor: c.accentSoft }]}>
          <Text style={{ color: c.accentText, fontSize: 13, fontWeight: "700" }}>
            {started ? "POČÚVAŠ" : "ZAČNI TU"} · KAPITOLA {st.chapter + 1} Z {p.chapters.length}
          </Text>
          <Text style={{ color: c.ink, fontSize: 19, fontWeight: "700" }} numberOfLines={2}>{chapterTitle(st.chapter)}</Text>
          <Bar value={share(st.chapter)} />
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Button title={st.playing ? "Pozastaviť" : started ? "Pokračovať" : "Prehrať"} onPress={() => ctl.toggle()} style={{ flex: 1 }} />
            <Button title="Zobraziť text" kind="secondary" onPress={() => setReading(true)} style={{ flex: 1 }} />
          </View>
        </View>

        {p.source?.imageOnlyPages.length ? <Note tone="warn">{p.source.imageOnlyPages.length} strán PDF je len naskenovaný obrázok, ich text v knihe chýba.</Note> : null}
        {p.source?.garbledChars ? <Note tone="warn">{GARBLED_NOTE}</Note> : null}

        {/* The one path to the whole audiobook: create it, watch it, or see that it is done. */}
        <View style={[s.card, { backgroundColor: c.surface }]}>
          {left > 0 && !p.generating && (
            <>
              <Button title="Vytvoriť audioknihu" onPress={() => ctl.setWholeBook(true)} />
              <Text style={{ color: c.ink2, fontSize: 14, lineHeight: 20 }}>
                {ready > 0 ? `Hotové ${pct} %. ` : ""}Pripravíme celú knihu naraz, potom ju počúvaš aj bez internetu. Trvá to asi {timeText(mins)}, nechaj telefón na nabíjačke.
              </Text>
            </>
          )}
          {left > 0 && p.generating && (
            <>
              <Text style={{ color: c.ink, fontSize: 16, fontWeight: "600" }}>Vytváram audioknihu</Text>
              <Bar value={ready / Math.max(1, total)} />
              <Text style={{ color: c.ink2, fontSize: 14, lineHeight: 20 }}>
                {pct} % · ešte asi {timeText(mins)}. Počúvať môžeš aj teraz.
              </Text>
              <Button title="Pozastaviť" kind="secondary" onPress={() => ctl.setWholeBook(false)} />
            </>
          )}
          {left === 0 && (
            <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
              <Text style={{ color: c.ok, fontSize: 20, fontWeight: "700" }}>✓</Text>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={{ color: c.ink, fontSize: 16, fontWeight: "600" }}>Audiokniha je hotová</Text>
                <Text style={{ color: c.ink2, fontSize: 14, lineHeight: 20 }}>
                  Počúvaš ju aj bez internetu. Poslať alebo uložiť ju môžeš tlačidlom vedľa názvu.
                </Text>
              </View>
            </View>
          )}
        </View>

        <View style={{ flexDirection: "row", gap: 10 }}>
          <Button title={p.lang === "sk" ? "Slovenčina" : "Angličtina"} kind="secondary" style={{ flex: 1 }} onPress={() => ctl.update({ lang: p.lang === "sk" ? "en" : "sk" })} />
          <Button
            title="Hlas"
            kind="secondary"
            style={{ flex: 1 }}
            onPress={() => {
              setVoices(!voices);
              setDictionary(false);
            }}
          />
          <Button
            title="Výslovnosť"
            kind="secondary"
            style={{ flex: 1 }}
            onPress={() => {
              setDictionary(!dictionary);
              setVoices(false);
            }}
          />
        </View>
        {dictionary && <Dictionary ctl={ctl} st={st} />}
        {voices && (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {VOICES.map((v) => (
              <Pressable
                key={v.id}
                onPress={() => ctl.update({ voice: v.id })}
                style={[s.chip, { borderColor: v.id === p.voice ? c.accent : c.line, backgroundColor: v.id === p.voice ? c.accent : "transparent" }]}
              >
                <Text style={{ color: v.id === p.voice ? c.onAccent : c.ink, fontWeight: "600" }}>{v.label}</Text>
              </Pressable>
            ))}
            <Text style={{ color: c.ink2, fontSize: 13, width: "100%" }}>Zmena hlasu alebo jazyka pripraví zvuk znova.</Text>
          </View>
        )}

        <View style={{ gap: 2 }}>
          <Text style={[s.h2, { color: c.ink }]}>Kapitoly</Text>
          <Text style={{ color: c.ink2, fontSize: 13 }}>Ťukni na kapitolu a začne hrať od začiatku.</Text>
        </View>
        <View>
          {p.chapters.map((ch, i) => {
            const here = i === st.chapter;
            const done = st.ready[i] >= st.total[i];
            const chapterPct = Math.round((st.ready[i] / Math.max(1, st.total[i])) * 100);
            const queued = ctl.isQueued(i);
            // Queued by the user, or part of the whole book being made: shows its percentage instead of the button.
            const inProgress = !done && (queued || p.generating);
            return (
              <Pressable
                key={ch.id}
                onPress={() => {
                  if (!here) ctl.play(i, 0);
                  else if (!st.playing) ctl.toggle();
                }}
                accessibilityState={{ selected: here }}
                style={({ pressed }) => [s.chapter, { borderColor: c.line, backgroundColor: here ? c.accentSoft : "transparent", opacity: pressed ? 0.7 : 1 }]}
              >
                <Text style={{ color: here ? c.accentText : c.ink2, width: 30, fontVariant: ["tabular-nums"], fontWeight: here ? "700" : "400" }}>{i + 1}</Text>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ color: here ? c.accentText : i < st.chapter ? c.ink2 : c.ink, fontSize: 16, fontWeight: here ? "700" : "500" }} numberOfLines={2}>
                    {chapterTitle(i)}
                  </Text>
                  {here && <Text style={{ color: c.accentText, fontSize: 13 }}>Tu si · veta {Math.min(st.sentence + 1, st.total[i])} z {st.total[i]}</Text>}
                </View>
                {done ? (
                  <Pressable accessibilityLabel="Kapitola je pripravená" style={s.action}>
                    <Text style={{ color: c.ok, fontSize: 20, fontWeight: "700" }}>✓</Text>
                  </Pressable>
                ) : inProgress ? (
                  <Pressable
                    accessibilityLabel={queued ? "Zastaviť prípravu kapitoly" : "Kapitola sa pripravuje"}
                    onPress={queued ? () => ctl.cancelChapter(i) : undefined}
                    style={s.action}
                  >
                    <Text style={{ color: c.accentText, fontSize: 13, fontWeight: "600" }}>{chapterPct} %</Text>
                  </Pressable>
                ) : (
                  <Pressable
                    accessibilityLabel="Pripraviť kapitolu na počúvanie bez internetu"
                    onPress={() => ctl.prepareChapter(i)}
                    style={s.action}
                  >
                    <View style={[s.download, { borderColor: c.line }]}>
                      <Text style={{ color: c.ink2, fontSize: 20, lineHeight: 22 }}>↓</Text>
                    </View>
                  </Pressable>
                )}
              </Pressable>
            );
          })}
        </View>

        <View style={{ gap: 8 }}>
          <Text style={[s.h3, { color: c.ink }]}>Úložisko</Text>
          <Text style={{ color: c.ink2, fontSize: 14 }}>Zvuk knihy zaberá {formatMb(audio)} MB.</Text>
          {audio > 0 && <Button title="Zmazať zvuk" kind="quiet" onPress={confirmDeleteAudio} style={{ alignSelf: "flex-start", paddingHorizontal: 0 }} />}
        </View>
      </ScrollView>
      <PlayerBar ctl={ctl} st={st} onOpenText={() => setReading(true)} />
      {reading && <ReadAlong ctl={ctl} st={st} onClose={() => setReading(false)} />}
    </View>
  );
}

/** "45 min", or "1 h 20 min" from an hour; the minutes are left out when they are zero. */
function timeText(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** One decimal below 10 MB, whole megabytes above; Slovak decimal comma. */
function formatMb(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return mb < 10 ? mb.toFixed(1).replace(".", ",") : String(Math.round(mb));
}

function Status({ st, c, onRetry }: { st: BookState; c: Colors; onRetry: () => void }) {
  if (st.phase === "downloading" && st.download) {
    const mb = (b: number) => Math.round(b / 1024 / 1024);
    return (
      <View style={[s.card, { backgroundColor: c.surface }]}>
        <Text style={{ color: c.ink, fontSize: 15, fontWeight: "600" }}>Sťahujem hlasový model</Text>
        <Text style={{ color: c.ink2, fontSize: 14 }}>{mb(st.download.bytes)} z asi {mb(st.download.total)} MB. Stiahne sa len raz.</Text>
        <Bar value={st.download.bytes / st.download.total} />
      </View>
    );
  }
  if (st.phase === "loading") return <Note>Pripravujem hlas…</Note>;
  if (st.phase === "error") {
    return (
      <View style={{ gap: 10 }}>
        <Note tone="error">Hlas sa nepodarilo pripraviť: {st.error}</Note>
        <Button title="Skúsiť znova" kind="secondary" onPress={onRetry} />
      </View>
    );
  }
  return null;
}

const s = StyleSheet.create({
  h1: { fontSize: 26, fontWeight: "800", letterSpacing: -0.4 },
  h2: { fontSize: 20, fontWeight: "700" },
  h3: { fontSize: 17, fontWeight: "700" },
  card: { borderRadius: 16, padding: 16, gap: 12 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, height: 40, justifyContent: "center" },
  // Padded and pulled back out, so the current chapter's tint has room while the text stays in line.
  chapter: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 52, paddingVertical: 8, paddingHorizontal: 10, marginHorizontal: -10, borderBottomWidth: StyleSheet.hairlineWidth },
  // The right-hand chapter control: a 44pt touch target, so it is easy to hit with a thumb.
  action: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  download: { width: 30, height: 30, borderRadius: 15, borderWidth: StyleSheet.hairlineWidth, alignItems: "center", justifyContent: "center" },
});
