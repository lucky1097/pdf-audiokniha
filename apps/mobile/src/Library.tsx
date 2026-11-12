import { chaptersFromText, detectLang, newProject, type Project } from "@audiokniha/core";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { Alert, FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  MODEL_BYTES,
  NO_VOICE_MESSAGE,
  getModelDownload,
  startModelDownload,
  subscribeModelDownload,
  voiceAvailable,
} from "./lib/engine.ts";
import { deleteBookAudio, deleteProject, listProjects, saveProject } from "./lib/storage.ts";
import { PdfReader, type PdfResult } from "./PdfReader.tsx";
import { useColors } from "./theme.ts";
import { Bar, Button, Cover, Note } from "./ui.tsx";

/** PDFs are passed to the reader as base64; past this size the phone would hold too much in memory. */
const MAX_PDF_BYTES = 60 * 1024 * 1024;

const mb = (bytes: number) => Math.round(bytes / 1048576);

export function Library({ onOpen, onAbout }: { onOpen: (id: string) => void; onAbout: () => void }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [books, setBooks] = useState<Project[]>([]);
  // False until the first listProjects() result, so the welcome never flashes for users who have books.
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paste, setPaste] = useState<string | null>(null);
  const [pdf, setPdf] = useState<{ base64: string; name: string } | null>(null);
  const dl = useSyncExternalStore(subscribeModelDownload, getModelDownload);

  const reload = useCallback(
    // A failed read still sets loaded, or the screen would stay blank with nothing to tap.
    () => void listProjects()
      .then(setBooks)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoaded(true)),
    [],
  );
  useEffect(reload, [reload]);

  const downloading = voiceAvailable && dl.status === "downloading";
  const voiceMissing = voiceAvailable && (dl.status === "missing" || dl.status === "error");
  const welcome = loaded && voiceMissing && books.length === 0;

  // The store keeps the error; the rejection is shown from the store, so it is only swallowed here.
  function downloadVoice() {
    startModelDownload().catch(() => {});
  }

  function create(title: string, chapters: { title: string; paragraphs: string[] }[], extra: Partial<Project> = {}) {
    if (!chapters.length) throw new Error("V súbore sa nenašiel žiadny text.");
    const sample = chapters.slice(0, 3).flatMap((ch) => ch.paragraphs).join(" ");
    // No GPU path on the phone yet: 8 flow-matching steps, as on the web's CPU path.
    const p = { ...newProject(title, detectLang(sample), chapters, false), ...extra };
    saveProject(p);
    onOpen(p.id);
  }

  async function pickFile() {
    setError(null);
    const res = await DocumentPicker.getDocumentAsync({ type: ["application/pdf", "text/plain"], copyToCacheDirectory: true });
    if (res.canceled || !res.assets[0]) return;
    const asset = res.assets[0];
    const file = new File(asset.uri);
    try {
      if (/\.pdf$/i.test(asset.name) || asset.mimeType === "application/pdf") {
        if ((asset.size ?? file.size ?? 0) > MAX_PDF_BYTES) throw new Error("PDF je príliš veľké (viac ako 60 MB).");
        setBusy("Čítam PDF…");
        setPdf({ base64: await file.base64(), name: asset.name });
      } else {
        const text = await file.text();
        create(asset.name.replace(/\.[^.]+$/, ""), chaptersFromText(text, detectLang(text)));
      }
    } catch (e) {
      setBusy(null);
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  function onPdf(r: PdfResult, name: string) {
    setPdf(null);
    setBusy(null);
    try {
      const chapters = r.book.chapters.filter((ch) => ch.paragraphs.length);
      if (!chapters.length && r.book.imageOnlyPages.length) {
        throw new Error("Toto PDF obsahuje len naskenované strany bez textu. Skeny zatiaľ čítať nevieme, skús PDF s textom.");
      }
      create(r.title, chapters.map((ch, i) => ({ title: ch.title || `Kapitola ${i + 1}`, paragraphs: ch.paragraphs })), {
        author: r.author || undefined,
        source: { file: name, pages: r.pageCount, imageOnlyPages: r.book.imageOnlyPages, garbledChars: r.book.removed.garbled },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  function confirmDelete(p: Project) {
    Alert.alert("Odstrániť knihu?", `„${p.title}“ zmizne z tohto telefónu aj s pripraveným zvukom.`, [
      { text: "Zrušiť", style: "cancel" },
      { text: "Odstrániť", style: "destructive", onPress: () => void removeBook(p) },
    ]);
  }

  async function removeBook(p: Project) {
    const others = await listProjects();
    deleteProject(p.id);
    deleteBookAudio(p, others);
    reload();
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
      <FlatList
        data={books}
        keyExtractor={(b) => b.id}
        contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 24, gap: 12 }}
        ListHeaderComponent={
          <View style={{ gap: 16, marginBottom: 8 }}>
            {!loaded ? null : welcome ? (
              <>
                <Text style={[st.h1, { color: c.ink }]}>Knihy nahlas, priamo v telefóne</Text>
                <Step n={1} title="Stiahni hlas" text="Raz, asi 380 MB, najlepšie cez Wi‑Fi." />
                <Step n={2} title="Pridaj knihu" text="PDF alebo text knihy." />
                <Step n={3} title="Počúvaj" text="Všetko zostáva v tvojom telefóne, nič sa nikam neposiela." />
                {error && <Note tone="error">{error}</Note>}
                {dl.status === "error" && <Note tone="error">{`Hlas sa nepodarilo stiahnuť: ${dl.error ?? ""}`}</Note>}
                <Button
                  title={dl.status === "error" ? "Skúsiť znova" : "Stiahnuť hlas"}
                  onPress={downloadVoice}
                  style={{ alignSelf: "stretch" }}
                />
                <Button title="Najprv pridať knihu" kind="quiet" onPress={() => void pickFile()} disabled={!!busy} />
                {busy && <Text style={{ color: c.ink2, textAlign: "center" }}>{busy}</Text>}
                <Text style={{ color: c.ink2, fontSize: 13, textAlign: "center" }}>Hlas je vytvorený umelou inteligenciou.</Text>
                <Pressable accessibilityRole="button" onPress={onAbout}>
                  <Text style={{ color: c.accentText, fontSize: 13, textAlign: "center" }}>
                    Používaním appky súhlasíš s podmienkami použitia hlasu.
                  </Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={[st.h1, { color: c.ink }]}>Knižnica</Text>
                {downloading && (
                  <View style={[st.card, { backgroundColor: c.surface }]}>
                    <Text style={{ color: c.ink, fontSize: 17, fontWeight: "700" }}>Sťahujem hlas</Text>
                    <Bar value={dl.progress ? dl.progress.bytes / dl.progress.total : 0} />
                    <Text style={{ color: c.ink2, fontSize: 14 }}>
                      {`${mb(dl.progress?.bytes ?? 0)} z ${mb(MODEL_BYTES)} MB · nechaj appku otvorenú`}
                    </Text>
                  </View>
                )}
                {voiceMissing && books.length > 0 && (
                  <View style={[st.card, { backgroundColor: c.surface }]}>
                    <Text style={{ color: c.ink, fontSize: 17, fontWeight: "700" }}>Hlas ešte nie je stiahnutý</Text>
                    <Text style={{ color: c.ink2, fontSize: 15, lineHeight: 21 }}>
                      Asi 380 MB, najlepšie cez Wi‑Fi. Potom funguje aj bez internetu.
                    </Text>
                    {dl.status === "error" && <Note tone="error">{`Hlas sa nepodarilo stiahnuť: ${dl.error ?? ""}`}</Note>}
                    <Button title="Stiahnuť hlas" kind="secondary" onPress={downloadVoice} />
                  </View>
                )}
                {error && <Note tone="error">{error}</Note>}
                {!voiceAvailable && <Note tone="warn">{NO_VOICE_MESSAGE}</Note>}
                {books.length === 0 && (
                  <Text style={{ color: c.ink2, fontSize: 15, lineHeight: 21 }}>
                    Pridaj prvú knihu. PDF nájdeš v Súboroch, v e‑maile alebo v Stiahnutých.
                  </Text>
                )}
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <Button title="Pridať PDF" onPress={() => void pickFile()} busy={!!busy} style={{ flex: 1 }} />
                  <Button title="Vložiť text" kind="secondary" onPress={() => setPaste("")} disabled={!!busy} style={{ flex: 1 }} />
                </View>
                {busy && <Text style={{ color: c.ink2 }}>{busy}</Text>}
                {books.length > 0 && <Text style={[st.h2, { color: c.ink, marginTop: 8 }]}>Moje knihy</Text>}
              </>
            )}
          </View>
        }
        ListFooterComponent={
          <Button title="O appke a licencie" kind="quiet" onPress={onAbout} style={{ alignSelf: "center", marginTop: 24 }} />
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => onOpen(item.id)}
            onLongPress={() => confirmDelete(item)}
            accessibilityHint="Podržaním knihu odstrániš"
            style={({ pressed }) => [st.row, { opacity: pressed ? 0.7 : 1 }]}
          >
            <Cover title={item.title} size={64} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ color: c.ink, fontSize: 17, fontWeight: "600" }} numberOfLines={2}>{item.title}</Text>
              <Text style={{ color: c.ink2, fontSize: 14 }}>
                {item.chapters.length} {item.chapters.length === 1 ? "kapitola" : item.chapters.length < 5 ? "kapitoly" : "kapitol"} · {item.lang === "sk" ? "slovenčina" : "angličtina"}
              </Text>
            </View>
          </Pressable>
        )}
      />

      {pdf && (
        <PdfReader
          base64={pdf.base64}
          fileName={pdf.name}
          onPage={(n, total) => setBusy(`Čítam PDF, strana ${n} z ${total}`)}
          onDone={(r) => onPdf(r, pdf.name)}
          onError={(m) => { setPdf(null); setBusy(null); setError(`PDF sa nepodarilo prečítať: ${m}`); }}
        />
      )}

      <Modal visible={paste !== null} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setPaste(null)}>
        <View style={{ flex: 1, backgroundColor: c.bg, padding: 20, gap: 14 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={[st.h2, { color: c.ink }]}>Vložiť text</Text>
            <Button title="Zrušiť" kind="quiet" onPress={() => setPaste(null)} />
          </View>
          <TextInput
            value={paste ?? ""}
            onChangeText={setPaste}
            multiline
            autoFocus
            placeholder="Sem vlož text knihy. Prázdny riadok oddeľuje odseky, riadok „Kapitola 2“ začína novú kapitolu."
            placeholderTextColor={c.ink2}
            style={[st.input, { color: c.ink, backgroundColor: c.surface }]}
            textAlignVertical="top"
          />
          <Button
            title="Vytvoriť knihu"
            disabled={!paste?.trim()}
            onPress={() => {
              try {
                const text = paste ?? "";
                setPaste(null);
                create("Vložený text", chaptersFromText(text, detectLang(text)));
              } catch (e) {
                setError(e instanceof Error ? e.message : String(e));
              }
            }}
          />
        </View>
      </Modal>
    </View>
  );
}

/** One numbered step of the welcome screen. */
function Step({ n, title, text }: { n: number; title: string; text: string }) {
  const c = useColors();
  return (
    <View style={{ flexDirection: "row", gap: 14, alignItems: "flex-start" }}>
      <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: c.accentSoft, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: c.accentText, fontSize: 16, fontWeight: "700" }}>{n}</Text>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: c.ink, fontSize: 17, fontWeight: "700" }}>{title}</Text>
        <Text style={{ color: c.ink2, fontSize: 15, lineHeight: 21 }}>{text}</Text>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  h1: { fontSize: 34, fontWeight: "800", letterSpacing: -0.5 },
  h2: { fontSize: 20, fontWeight: "700" },
  card: { borderRadius: 16, padding: 16, gap: 12 },
  row: { flexDirection: "row", gap: 14, alignItems: "center" },
  input: { flex: 1, borderRadius: 12, padding: 14, fontSize: 17, lineHeight: 24 },
});
