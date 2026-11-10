// The round share button next to the book title. Tapping it builds the whole audiobook (.m4b) and opens the iOS
// share sheet; while it builds, a small sheet shows progress and the AI notice. The last result is kept, so a second
// tap on the same book shares it at once.
import { useRef, useState } from "react";
import { Alert, Modal, Pressable, Share, StyleSheet, Text, View } from "react-native";
import { aacAvailable } from "../modules/audio-encoder/index.ts";
import type { BookController, BookState } from "./lib/book.ts";
import { exportBook, type ExportResult } from "./lib/export.ts";
import { useColors } from "./theme.ts";
import { Bar, ShareIcon } from "./ui.tsx";

export function ShareBook({ ctl, st }: { ctl: BookController; st: BookState }) {
  const c = useColors();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  // The last built file, with the book and the ready count it was built from.
  const built = useRef<{ key: string; result: ExportResult } | null>(null);

  const ready = st.ready.reduce((a, b) => a + b, 0);
  const total = st.total.reduce((a, b) => a + b, 0);

  const share = async () => {
    // The sentence keys change with voice, language, text and seed, so the audio itself decides whether a file is current.
    const key = ctl.keys().join("|");
    const hit = built.current;
    if (hit && hit.key === key) {
      await Share.share({ url: hit.result.uri, title: st.project.title });
      return;
    }
    setProgress(0);
    setBusy(true);
    try {
      const r = await exportBook(ctl, (done, all) => setProgress(all > 0 ? done / all : 0));
      built.current = { key, result: r };
      setBusy(false);
      await Share.share({ url: r.uri, title: st.project.title });
    } catch (e) {
      setBusy(false);
      Alert.alert("Súbor sa nepodarilo pripraviť", e instanceof Error ? e.message : String(e));
    }
  };

  const onPress = () => {
    // First: without the encoder nothing can be shared, so do not offer to create the audiobook for it.
    if (!aacAvailable) {
      Alert.alert("Treba novšiu verziu appky", "Na posielanie audioknihy treba novšiu verziu appky.", [{ text: "OK" }]);
      return;
    }
    if (ready < total) {
      if (st.project.generating) {
        Alert.alert(
          "Audiokniha ešte nie je hotová",
          "Audiokniha sa ešte vytvára. Keď bude hotová, môžeš ju poslať alebo uložiť.",
          [{ text: "OK" }],
        );
      } else {
        Alert.alert("Audiokniha ešte nie je hotová", "Najprv ju vytvor, potom ju môžeš poslať alebo uložiť.", [
          { text: "Zrušiť", style: "cancel" },
          { text: "Vytvoriť audioknihu", onPress: () => ctl.setWholeBook(true) },
        ]);
      }
      return;
    }
    void share();
  };

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Poslať alebo uložiť audioknihu"
        onPress={onPress}
        style={({ pressed }) => [
          s.button,
          { borderColor: c.line, backgroundColor: c.surface, opacity: pressed ? 0.8 : 1 },
        ]}
      >
        <ShareIcon color={c.ink} />
      </Pressable>

      <Modal transparent animationType="fade" visible={busy} onRequestClose={() => {}}>
        <View style={[s.dim, { backgroundColor: "rgba(0,0,0,0.5)" }]}>
          <View style={[s.card, { backgroundColor: c.raised }]}>
            <Text style={[s.title, { color: c.ink }]}>Pripravujem súbor…</Text>
            <Bar value={progress} />
            <Text style={{ color: c.ink2, fontSize: 13, lineHeight: 18 }}>
              Hlas je vytvorený umelou inteligenciou. Ak nahrávku zverejníš, uveď to.
            </Text>
          </View>
        </View>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  dim: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  card: { width: "100%", maxWidth: 360, borderRadius: 16, padding: 20, gap: 14 },
  title: { fontSize: 17, fontWeight: "700" },
});
