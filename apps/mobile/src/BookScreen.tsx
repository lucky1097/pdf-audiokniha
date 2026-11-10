import { GARBLED_NOTE, type Voice } from "@audiokniha/core";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BookController, type BookState } from "./lib/book.ts";
import { getProject } from "./lib/storage.ts";
import { PlayerBar } from "./PlayerBar.tsx";
import { Dictionary } from "./Dictionary.tsx";
import { Export } from "./Export.tsx";
import { ReadAlong } from "./ReadAlong.tsx";
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
  // Recounted when the ready count changes (a sentence was made or the audio was deleted).
  const audio = useMemo(() => ctl.audioSize(), [ctl, ready]);
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

        <View style={[s.card, { backgroundColor: c.surface }]}>
          <Text style={{ color: c.ink, fontSize: 15 }}>
            {ready >= total ? "Celá kniha je pripravená, počúvať sa dá aj bez internetu." : `Pripravených ${Math.round((ready / Math.max(1, total)) * 100)} %. Zvyšok sa pripraví počas počúvania, alebo celú knihu naraz.`}
          </Text>
          <Bar value={ready / Math.max(1, total)} />
          {ready < total && (
            <Button
              title={p.generating ? "Zastaviť prípravu celej knihy" : "Pripraviť celú knihu"}
              kind="secondary"
              onPress={() => ctl.setWholeBook(!p.generating)}
            />
          )}
          {p.generating && <Text style={{ color: c.ink2, fontSize: 13 }}>Kým sa pripravuje celá kniha, obrazovka zostane zapnutá.</Text>}
          <Text style={{ color: c.ink2, fontSize: 13 }}>Zvuk knihy zaberá {formatMb(audio)} MB.</Text>
          {audio > 0 && <Button title="Zmazať zvuk" kind="quiet" onPress={confirmDeleteAudio} />}
        </View>

        <Export ctl={ctl} st={st} />

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
          <Text style={{ color: c.ink2, fontSize: 13 }}>Ťukni na kapitolu a počúvanie sa presunie na jej začiatok.</Text>
        </View>
        <View>
          {p.chapters.map((ch, i) => {
            const here = i === st.chapter;
            return (
              <Pressable
                key={ch.id}
                onPress={() => {
                  if (!here) ctl.seek(i, 0);
                  setReading(true);
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
                <Text style={{ color: st.ready[i] >= st.total[i] ? c.ok : c.ink2, fontSize: 13 }}>
                  {st.ready[i] >= st.total[i] ? "Pripravená" : st.ready[i] ? `${st.ready[i]} z ${st.total[i]} viet` : "Čaká"}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
      <PlayerBar ctl={ctl} st={st} onOpenText={() => setReading(true)} />
      {reading && <ReadAlong ctl={ctl} st={st} onClose={() => setReading(false)} />}
    </View>
  );
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
  card: { borderRadius: 16, padding: 16, gap: 12 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, height: 40, justifyContent: "center" },
  // Padded and pulled back out, so the current chapter's tint has room while the text stays in line.
  chapter: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 52, paddingVertical: 8, paddingHorizontal: 10, marginHorizontal: -10, borderBottomWidth: StyleSheet.hairlineWidth },
});
