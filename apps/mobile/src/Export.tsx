// Whole book → one .m4b file, then the iOS share sheet (save to Files, send, or open in Apple Books).
// Same texts and behaviour as the web app's Export tab.
import { AI_NOTICE } from "@audiokniha/core";
import { useState } from "react";
import { Share, StyleSheet, Text, View } from "react-native";
import { aacAvailable } from "../modules/audio-encoder/index.ts";
import type { BookController, BookState } from "./lib/book.ts";
import { exportBook, type ExportResult } from "./lib/export.ts";
import { useColors } from "./theme.ts";
import { Button, Note } from "./ui.tsx";

export function Export({ ctl, st }: { ctl: BookController; st: BookState }) {
  const c = useColors();
  const [working, setWorking] = useState<string | null>(null);
  const [result, setResult] = useState<ExportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ready = st.ready.reduce((a, b) => a + b, 0);
  const total = st.total.reduce((a, b) => a + b, 0);
  const missing = total - ready;
  const title = ctl.getState().project.title;

  const shareFile = (r: ExportResult) =>
    Share.share({ url: r.uri, title }).catch((e) => setError(e instanceof Error ? e.message : String(e)));

  const run = async () => {
    setResult(null);
    setError(null);
    setWorking("Ukladám zvuk, 0 %");
    try {
      const r = await exportBook(ctl, (done, all) =>
        setWorking(done >= all ? "Pripravujem súbor…" : `Ukladám zvuk, ${Math.round((done / all) * 100)} %`),
      );
      setResult(r);
      await shareFile(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setWorking(null);
    }
  };

  return (
    <View style={[s.card, { backgroundColor: c.surface }]}>
      <Text style={[s.h2, { color: c.ink }]}>Audiokniha</Text>
      <Text style={{ color: c.ink2, fontSize: 13 }}>
        Celá kniha ako jeden súbor .m4b s kapitolami. Otvoria ho appky na audioknihy aj prehrávače hudby.
      </Text>

      {!aacAvailable ? (
        <Note>Export potrebuje novšiu verziu appky.</Note>
      ) : (
        <>
          {missing > 0 && <Note tone="warn">Ešte treba pripraviť {missing} viet. Spusti „Pripraviť celú knihu“ hore.</Note>}
          <Text style={{ color: c.ink2, fontSize: 13 }}>
            {AI_NOTICE} Táto informácia sa zapíše do súboru. Ak nahrávku zverejníš, uveď to aj ty.
          </Text>
          <Button title="Vytvoriť audioknihu" onPress={() => void run()} disabled={missing > 0} busy={working !== null} />
          {working && <Text style={{ color: c.ink2, fontSize: 13 }} accessibilityLiveRegion="polite">{working}</Text>}
          {result && (
            <>
              <Text style={{ color: c.ink, fontSize: 15 }}>
                {duration(result.seconds)} · {result.chapters} kapitol · {megabytes(result.bytes)} MB
              </Text>
              <Button title="Zdieľať znova" kind="secondary" onPress={() => void shareFile(result)} />
            </>
          )}
        </>
      )}
      {error && <Note tone="error">Export sa nepodaril: {error}</Note>}
    </View>
  );
}

/** "2 h 5 min", or "5 min" under an hour. */
function duration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h} h ${m} min` : `${m} min`;
}

/** One decimal, Slovak decimal comma. */
function megabytes(bytes: number): string {
  return (bytes / 1e6).toFixed(1).replace(".", ",");
}

const s = StyleSheet.create({
  h2: { fontSize: 20, fontWeight: "700" },
  card: { borderRadius: 16, padding: 16, gap: 12 },
});
