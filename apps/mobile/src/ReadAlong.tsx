// Read along: the chapter being read, large, with the sentence the voice is on highlighted and, in it, the word
// (estimated from the sentence's timing, see core's wordSpans). Follows the voice paragraph by paragraph;
// scrolling by hand pauses that until "Sledovať čítanie". Tap a sentence to play from it, hold it for more.
// The header says which chapter of how many and opens the list of chapters. The text is exactly what the voice
// says (numbers and abbreviations written out).
import { PARAGRAPH_GAP, SENTENCE_GAP, wordAt, wordSpans, type Sentence } from "@audiokniha/core";
import { memo, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Alert, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, View, type ScrollViewInstance } from "react-native";
import type { BookController, BookState } from "./lib/book.ts";
import { PlayerBar } from "./PlayerBar.tsx";
import { useColors, type Colors } from "./theme.ts";

/** How far below the top the paragraph being read is kept. */
const FOLLOW_OFFSET = 96;
/** The voice starts a moment into each sentence's audio. */
const LEAD_IN = 0.05;
const CHAPTER_ROW = 56;

export function ReadAlong({ ctl, st, onClose }: { ctl: BookController; st: BookState; onClose: () => void }) {
  const c = useColors();
  const chapter = st.chapter;
  const count = st.project.chapters.length;
  const sentences = useMemo(() => ctl.sentencesOf(chapter), [ctl, chapter, st.project]);
  const paragraphs = useMemo(() => {
    const out: { paragraph: number; sentences: Sentence[] }[] = [];
    for (const s of sentences) {
      const last = out[out.length - 1];
      if (last && last.paragraph === s.paragraph) last.sentences.push(s);
      else out.push({ paragraph: s.paragraph, sentences: [s] });
    }
    return out;
  }, [sentences]);

  const scroll = useRef<ScrollViewInstance>(null);
  // Paragraph tops, keyed "chapter:paragraph" so a new chapter never reuses the old one's positions.
  const ys = useRef(new Map<string, number>());
  const [follow, setFollow] = useState(true);
  const [chapters, setChapters] = useState(false);
  const currentParagraph = sentences[st.sentence]?.paragraph;

  const scrollTo = (paragraph: number | undefined, animated: boolean) => {
    const y = paragraph === undefined ? undefined : ys.current.get(`${chapter}:${paragraph}`);
    if (y !== undefined) scroll.current?.scrollTo({ y: Math.max(0, y - FOLLOW_OFFSET), animated });
  };

  useEffect(() => {
    if (follow) scrollTo(currentParagraph, true);
  }, [currentParagraph, chapter, follow]);

  const play = (index: number) => {
    setFollow(true);
    ctl.play(chapter, index);
  };
  const more = (s: Sentence) =>
    Alert.alert(s.text.length > 90 ? `${s.text.slice(0, 90)}…` : s.text, undefined, [
      { text: "Prehrať odtiaľto", onPress: () => play(s.index) },
      { text: "Vygenerovať znova", onPress: () => ctl.regenerate(chapter, s) },
      { text: "Zrušiť", style: "cancel" },
    ]);

  const title = st.project.chapters[chapter]?.title || `Kapitola ${chapter + 1}`;
  const next = chapter + 1 < count ? st.project.chapters[chapter + 1] : null;
  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <View style={[s.header, { borderColor: c.line }]}>
          <Pressable
            onPress={() => setChapters(true)}
            accessibilityRole="button"
            accessibilityLabel={`Kapitola ${chapter + 1} z ${count}, ${title}. Zoznam kapitol`}
            style={({ pressed }) => [{ flex: 1, gap: 2, opacity: pressed ? 0.6 : 1 }]}
          >
            <Text style={{ color: c.ink2, fontSize: 13, fontWeight: "600" }}>
              Kapitola {chapter + 1} z {count} <Text style={{ color: c.accentText }}>· všetky ▾</Text>
            </Text>
            <Text style={{ color: c.ink, fontSize: 17, fontWeight: "700" }} numberOfLines={1}>{title}</Text>
          </Pressable>
          <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button">
            <Text style={{ color: c.accentText, fontSize: 17, fontWeight: "600" }}>Hotovo</Text>
          </Pressable>
        </View>
        <View style={{ height: 3, backgroundColor: c.line }}>
          <View style={{ height: 3, width: `${(Math.min(st.sentence + 1, sentences.length) / Math.max(1, sentences.length)) * 100}%`, backgroundColor: c.accent }} />
        </View>

        <ScrollView ref={scroll} contentContainerStyle={s.body} onScrollBeginDrag={() => setFollow(false)}>
          <Text style={{ color: c.ink2, fontSize: 14, lineHeight: 20 }}>
            Ťukni na vetu a čítanie pokračuje od nej. Keď niektorá znie zle, podrž ju a vygeneruj znova.
          </Text>
          {paragraphs.map((p) => (
            <Text
              key={p.paragraph}
              onLayout={(e) => {
                ys.current.set(`${chapter}:${p.paragraph}`, e.nativeEvent.layout.y);
                if (follow && p.paragraph === currentParagraph) scrollTo(p.paragraph, false);
              }}
              style={p.paragraph === -1 ? [s.title, { color: c.ink }] : s.paragraph}
            >
              {p.sentences.map((x) =>
                x.index === st.sentence ? (
                  <Spoken key={x.index} ctl={ctl} s={x} c={c} onPress={() => play(x.index)} onLongPress={() => more(x)} />
                ) : (
                  <Text
                    key={x.index}
                    onPress={() => play(x.index)}
                    onLongPress={() => more(x)}
                    style={{ color: x.index < st.sentence ? c.ink2 : c.ink }}
                  >
                    {x.text}{" "}
                  </Text>
                ),
              )}
            </Text>
          ))}
          {next && (
            <Pressable
              onPress={() => ctl.seek(chapter + 1, 0)}
              accessibilityRole="button"
              style={({ pressed }) => [s.next, { borderColor: c.line, backgroundColor: c.surface, opacity: pressed ? 0.7 : 1 }]}
            >
              <Text style={{ color: c.ink2, fontSize: 13, fontWeight: "600" }}>Ďalšia kapitola · {chapter + 2} z {count}</Text>
              <Text style={{ color: c.ink, fontSize: 17, fontWeight: "700" }} numberOfLines={2}>{next.title || `Kapitola ${chapter + 2}`} ›</Text>
            </Pressable>
          )}
        </ScrollView>
        {!follow && (
          <Pressable onPress={() => setFollow(true)} style={[s.follow, { backgroundColor: c.ink }]} accessibilityRole="button">
            <Text style={{ color: c.bg, fontWeight: "600", fontSize: 15 }}>Sledovať čítanie</Text>
          </Pressable>
        )}
        <PlayerBar ctl={ctl} st={st} />
        {chapters && (
          <ChapterList
            st={st}
            c={c}
            onPick={(i) => {
              setChapters(false);
              setFollow(true);
              ctl.seek(i, 0);
            }}
            onClose={() => setChapters(false)}
          />
        )}
      </View>
    </Modal>
  );
}

/** The sentence being read; only it re-renders as the voice moves from word to word. */
const Spoken = memo(function Spoken({ ctl, s: x, c, onPress, onLongPress }: { ctl: BookController; s: Sentence; c: Colors; onPress: () => void; onLongPress: () => void }) {
  const p = useSyncExternalStore(ctl.subscribeProgress, ctl.getProgress);
  const spans = useMemo(() => wordSpans(x.text), [x.text]);
  let word = -1;
  if (p.key === x.key && p.duration > 0) {
    const speech = Math.max(0.2, p.duration - LEAD_IN - (x.paragraphEnd ? PARAGRAPH_GAP : SENTENCE_GAP));
    word = wordAt(spans, (p.time - LEAD_IN) / speech);
  }
  const w = spans[word];
  return (
    <Text onPress={onPress} onLongPress={onLongPress} style={{ color: c.ink, backgroundColor: c.accentSoft }}>
      {w ? (
        <>
          {x.text.slice(0, w.start)}
          <Text style={{ color: c.accentText }}>{x.text.slice(w.start, w.end)}</Text>
          {x.text.slice(w.end)}
        </>
      ) : (
        x.text
      )}{" "}
    </Text>
  );
});

function ChapterList({ st, c, onPick, onClose }: { st: BookState; c: Colors; onPick: (i: number) => void; onClose: () => void }) {
  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <View style={[s.header, { borderColor: c.line }]}>
          <Text style={{ flex: 1, color: c.ink, fontSize: 17, fontWeight: "700" }}>Kapitoly</Text>
          <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button">
            <Text style={{ color: c.accentText, fontSize: 17, fontWeight: "600" }}>Zavrieť</Text>
          </Pressable>
        </View>
        <FlatList
          data={st.project.chapters}
          keyExtractor={(ch) => ch.id}
          initialScrollIndex={Math.max(0, st.chapter - 3)}
          getItemLayout={(_, i) => ({ length: CHAPTER_ROW, offset: CHAPTER_ROW * i, index: i })}
          contentContainerStyle={{ paddingBottom: 40 }}
          renderItem={({ item, index: i }) => {
            const here = i === st.chapter;
            return (
              <Pressable
                onPress={() => onPick(i)}
                accessibilityRole="button"
                accessibilityState={{ selected: here }}
                style={({ pressed }) => [s.row, { borderColor: c.line, backgroundColor: here ? c.accentSoft : "transparent", opacity: pressed ? 0.7 : 1 }]}
              >
                <Text style={{ width: 30, color: here ? c.accentText : c.ink2, fontVariant: ["tabular-nums"] }}>{i + 1}</Text>
                <Text style={{ flex: 1, color: here ? c.accentText : c.ink, fontSize: 16, fontWeight: here ? "700" : "500" }} numberOfLines={1}>
                  {item.title || `Kapitola ${i + 1}`}
                </Text>
                {here && <Text style={{ color: c.accentText, fontSize: 13, fontWeight: "600" }}>Tu si</Text>}
              </Pressable>
            );
          }}
        />
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  body: { paddingHorizontal: 22, paddingTop: 20, paddingBottom: 260, gap: 22 },
  title: { fontSize: 24, lineHeight: 31, fontWeight: "800" },
  paragraph: { fontSize: 21, lineHeight: 32 },
  next: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 16, gap: 4, marginTop: 8 },
  follow: { position: "absolute", alignSelf: "center", bottom: 170, paddingHorizontal: 18, height: 44, borderRadius: 22, justifyContent: "center" },
  row: { height: CHAPTER_ROW, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 20, borderBottomWidth: StyleSheet.hairlineWidth },
});
