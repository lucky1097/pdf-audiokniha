// Read along: the chapter being read, large, with the sentence the voice is on highlighted. Follows the voice
// paragraph by paragraph; scrolling by hand pauses that until "Sledovať čítanie". Tapping a sentence plays from it.
// It shows exactly what the voice says (numbers and abbreviations written out).
import type { Sentence } from "@audiokniha/core";
import { useEffect, useMemo, useRef, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View, type ScrollViewInstance } from "react-native";
import type { BookController, BookState } from "./lib/book.ts";
import { PlayerBar } from "./PlayerBar.tsx";
import { useColors } from "./theme.ts";

/** How far below the top the paragraph being read is kept. */
const FOLLOW_OFFSET = 96;

export function ReadAlong({ ctl, st, onClose }: { ctl: BookController; st: BookState; onClose: () => void }) {
  const c = useColors();
  const chapter = st.chapter;
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
  const currentParagraph = sentences[st.sentence]?.paragraph;

  const scrollTo = (paragraph: number | undefined, animated: boolean) => {
    const y = paragraph === undefined ? undefined : ys.current.get(`${chapter}:${paragraph}`);
    if (y !== undefined) scroll.current?.scrollTo({ y: Math.max(0, y - FOLLOW_OFFSET), animated });
  };

  useEffect(() => {
    if (follow) scrollTo(currentParagraph, true);
  }, [currentParagraph, chapter, follow]);

  const title = st.project.chapters[chapter]?.title || `Kapitola ${chapter + 1}`;
  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <View style={[s.header, { borderColor: c.line }]}>
          <Text style={{ flex: 1, color: c.ink2, fontSize: 15, fontWeight: "600" }} numberOfLines={1}>{title}</Text>
          <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button">
            <Text style={{ color: c.accentText, fontSize: 17, fontWeight: "600" }}>Hotovo</Text>
          </Pressable>
        </View>
        <ScrollView ref={scroll} contentContainerStyle={s.body} onScrollBeginDrag={() => setFollow(false)}>
          {paragraphs.map((p) => (
            <Text
              key={p.paragraph}
              onLayout={(e) => {
                ys.current.set(`${chapter}:${p.paragraph}`, e.nativeEvent.layout.y);
                if (follow && p.paragraph === currentParagraph) scrollTo(p.paragraph, false);
              }}
              style={p.paragraph === -1 ? [s.title, { color: c.ink }] : s.paragraph}
            >
              {p.sentences.map((x) => {
                const now = x.index === st.sentence;
                return (
                  <Text
                    key={x.index}
                    onPress={() => {
                      setFollow(true);
                      ctl.play(chapter, x.index);
                    }}
                    style={{ color: x.index < st.sentence ? c.ink2 : c.ink, backgroundColor: now ? c.accentSoft : "transparent" }}
                  >
                    {x.text}{" "}
                  </Text>
                );
              })}
            </Text>
          ))}
        </ScrollView>
        {!follow && (
          <Pressable onPress={() => setFollow(true)} style={[s.follow, { backgroundColor: c.ink }]} accessibilityRole="button">
            <Text style={{ color: c.bg, fontWeight: "600", fontSize: 15 }}>Sledovať čítanie</Text>
          </Pressable>
        )}
        <PlayerBar ctl={ctl} st={st} />
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  body: { paddingHorizontal: 22, paddingTop: 20, paddingBottom: 260, gap: 22 },
  title: { fontSize: 24, lineHeight: 31, fontWeight: "800" },
  paragraph: { fontSize: 21, lineHeight: 32 },
  follow: { position: "absolute", alignSelf: "center", bottom: 170, paddingHorizontal: 18, height: 44, borderRadius: 22, justifyContent: "center" },
});
