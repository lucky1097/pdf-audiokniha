import type { Voice } from "@audiokniha/core";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BookController, type BookState } from "./lib/book.ts";
import { getProject } from "./lib/storage.ts";
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
  const [open, setOpen] = useState<number | null>(null);
  const [voices, setVoices] = useState(false);
  const p = st.project;
  const ready = st.ready.reduce((a, b) => a + b, 0);
  const total = st.total.reduce((a, b) => a + b, 0);

  if (open !== null) return <ChapterText ctl={ctl} st={st} chapter={open} onBack={() => setOpen(null)} />;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 18, paddingBottom: 140 }}>
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
        </View>

        <View style={{ flexDirection: "row", gap: 10 }}>
          <Button title={p.lang === "sk" ? "Slovenčina" : "Angličtina"} kind="secondary" style={{ flex: 1 }} onPress={() => ctl.update({ lang: p.lang === "sk" ? "en" : "sk" })} />
          <Button title="Hlas" kind="secondary" style={{ flex: 1 }} onPress={() => setVoices(!voices)} />
        </View>
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

        <Text style={[s.h2, { color: c.ink }]}>Kapitoly</Text>
        {p.chapters.map((ch, i) => (
          <Pressable key={ch.id} onPress={() => setOpen(i)} style={({ pressed }) => [s.chapter, { borderColor: c.line, opacity: pressed ? 0.7 : 1 }]}>
            <Text style={{ color: i === st.chapter ? c.accentText : c.ink2, width: 28, fontVariant: ["tabular-nums"] }}>{i + 1}</Text>
            <Text style={{ flex: 1, color: i === st.chapter ? c.accentText : c.ink, fontSize: 16, fontWeight: "500" }} numberOfLines={2}>
              {ch.title || `Kapitola ${i + 1}`}
            </Text>
            <Text style={{ color: st.ready[i] >= st.total[i] ? c.ok : c.ink2, fontSize: 13 }}>
              {st.ready[i] >= st.total[i] ? "Pripravená" : st.ready[i] ? `${st.ready[i]} z ${st.total[i]} viet` : "Čaká"}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      <PlayerBar ctl={ctl} st={st} />
    </View>
  );
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

function ChapterText({ ctl, st, chapter, onBack }: { ctl: BookController; st: BookState; chapter: number; onBack: () => void }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  // Rebuilt when the project changes (a seed, the voice); ready flags come with each state change.
  const sentences = useMemo(() => ctl.sentencesOf(chapter), [ctl, chapter, st.project]);
  const title = st.project.chapters[chapter].title || `Kapitola ${chapter + 1}`;
  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
      <FlatList
        data={sentences}
        keyExtractor={(x) => String(x.index)}
        contentContainerStyle={{ padding: 20, paddingBottom: 140, gap: 4 }}
        ListHeaderComponent={
          <View style={{ gap: 10, marginBottom: 10 }}>
            <Button title="‹ Kapitoly" kind="quiet" onPress={onBack} style={{ alignSelf: "flex-start", paddingHorizontal: 0 }} />
            <Text style={[s.h1, { color: c.ink }]}>{title}</Text>
            <Text style={{ color: c.ink2, fontSize: 14, lineHeight: 20 }}>Takto hlas kapitolu prečíta. Ťukni na vetu a začne sa prehrávať. Ak nejaká znie zle, vygeneruj ju znova.</Text>
          </View>
        }
        renderItem={({ item }) => {
          const now = st.chapter === chapter && st.sentence === item.index;
          return (
            <Pressable onPress={() => ctl.play(chapter, item.index)} style={[s.sentence, { backgroundColor: now ? c.accentSoft : "transparent" }]}>
              <Text style={{ flex: 1, color: c.ink, fontSize: 17, lineHeight: 25 }}>{item.text}</Text>
              <Pressable accessibilityLabel="Vygenerovať túto vetu znova" hitSlop={8} onPress={() => ctl.regenerate(chapter, item)} style={[s.again, { borderColor: c.line }]}>
                <Text style={{ color: c.ink2, fontSize: 13 }}>Znova</Text>
              </Pressable>
            </Pressable>
          );
        }}
      />
      <PlayerBar ctl={ctl} st={st} />
    </View>
  );
}

function PlayerBar({ ctl, st }: { ctl: BookController; st: BookState }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const total = st.total[st.chapter] ?? 0;
  const ch = st.project.chapters[st.chapter];
  return (
    <View style={[s.player, { backgroundColor: c.raised, borderColor: c.line, paddingBottom: insets.bottom + 10 }]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Cover title={st.project.title} size={44} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: c.ink, fontWeight: "600", fontSize: 15 }} numberOfLines={1}>{ch?.title || `Kapitola ${st.chapter + 1}`}</Text>
          <Text style={{ color: c.ink2, fontSize: 13 }} numberOfLines={1}>
            {st.waiting ? "Pripravujem hlas…" : `Veta ${Math.min(st.sentence + 1, total)} z ${total}`}
            {st.rtf ? ` · ${st.rtf < 1 ? "stíha" : "nestíha"} (${st.rtf.toFixed(2)}×)` : ""}
          </Text>
        </View>
        <Pressable accessibilityLabel="Rýchlosť" onPress={() => ctl.cycleRate()} style={[s.rate, { borderColor: c.line }]}>
          <Text style={{ color: c.ink, fontWeight: "600" }}>{String(st.rate).replace(".", ",")}×</Text>
        </Pressable>
      </View>
      <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 36 }}>
        <Pressable accessibilityLabel="Predchádzajúca veta" hitSlop={10} onPress={() => ctl.previous()}>
          <Text style={{ color: c.ink, fontSize: 26 }}>⏮</Text>
        </Pressable>
        <Pressable accessibilityLabel={st.playing ? "Pozastaviť" : "Prehrať"} onPress={() => ctl.toggle()} style={[s.play, { backgroundColor: c.accent }]}>
          <Text style={{ color: c.onAccent, fontSize: 24, fontWeight: "700" }}>{st.playing ? "❚❚" : "▶"}</Text>
        </Pressable>
        <Pressable accessibilityLabel="Ďalšia veta" hitSlop={10} onPress={() => ctl.next()}>
          <Text style={{ color: c.ink, fontSize: 26 }}>⏭</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  h1: { fontSize: 26, fontWeight: "800", letterSpacing: -0.4 },
  h2: { fontSize: 20, fontWeight: "700" },
  card: { borderRadius: 16, padding: 16, gap: 12 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, height: 40, justifyContent: "center" },
  chapter: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 52, borderBottomWidth: StyleSheet.hairlineWidth },
  sentence: { flexDirection: "row", gap: 10, alignItems: "flex-start", padding: 10, borderRadius: 10 },
  again: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, marginTop: 2 },
  player: { position: "absolute", left: 0, right: 0, bottom: 0, borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 16, paddingTop: 12, gap: 10 },
  rate: { borderWidth: 1, borderRadius: 999, minWidth: 56, height: 36, alignItems: "center", justifyContent: "center" },
  play: { width: 60, height: 60, borderRadius: 30, alignItems: "center", justifyContent: "center" },
});
