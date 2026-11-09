import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BookController, BookState } from "./lib/book.ts";
import { useColors } from "./theme.ts";
import { Cover } from "./ui.tsx";

/** The player pinned to the bottom. With onOpenText, tapping the title (or "Text") opens the read-along view. */
export function PlayerBar({ ctl, st, onOpenText }: { ctl: BookController; st: BookState; onOpenText?: () => void }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const total = st.total[st.chapter] ?? 0;
  const ch = st.project.chapters[st.chapter];
  return (
    <View style={[s.player, { backgroundColor: c.raised, borderColor: c.line, paddingBottom: insets.bottom + 10 }]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Pressable
          onPress={onOpenText}
          disabled={!onOpenText}
          accessibilityRole={onOpenText ? "button" : undefined}
          accessibilityHint={onOpenText ? "Otvorí text, ktorý sa práve číta" : undefined}
          style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 12 }}
        >
          <Cover title={st.project.title} size={44} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: c.ink, fontWeight: "600", fontSize: 15 }} numberOfLines={1}>{ch?.title || `Kapitola ${st.chapter + 1}`}</Text>
            <Text style={{ color: c.ink2, fontSize: 13 }} numberOfLines={1}>
              {st.waiting ? "Pripravujem hlas…" : `Veta ${Math.min(st.sentence + 1, total)} z ${total}`}
              {st.rtf ? ` · ${st.rtf < 1 ? "stíha" : "nestíha"} (${st.rtf.toFixed(2)}×)` : ""}
            </Text>
          </View>
        </Pressable>
        {onOpenText && (
          <Pressable accessibilityLabel="Text, ktorý sa práve číta" onPress={onOpenText} style={[s.pill, { borderColor: c.line }]}>
            <Text style={{ color: c.ink, fontWeight: "600" }}>Text</Text>
          </Pressable>
        )}
        <Pressable accessibilityLabel="Rýchlosť" onPress={() => ctl.cycleRate()} style={[s.pill, { borderColor: c.line }]}>
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
  player: { position: "absolute", left: 0, right: 0, bottom: 0, borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 16, paddingTop: 12, gap: 10 },
  pill: { borderWidth: 1, borderRadius: 999, minWidth: 56, paddingHorizontal: 12, height: 36, alignItems: "center", justifyContent: "center" },
  play: { width: 60, height: 60, borderRadius: 30, alignItems: "center", justifyContent: "center" },
});
