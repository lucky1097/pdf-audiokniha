import { chaptersFromText, detectLang, newProject, type Project } from "@audiokniha/core";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { useCallback, useEffect, useState } from "react";
import { Alert, FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NO_VOICE_MESSAGE, modelDownloaded, voiceAvailable } from "./lib/engine.ts";
import { deleteBookAudio, deleteProject, listProjects, saveProject } from "./lib/storage.ts";
import { PdfReader, type PdfResult } from "./PdfReader.tsx";
import { useColors } from "./theme.ts";
import { Button, Cover, Note } from "./ui.tsx";

/** PDFs are passed to the reader as base64; past this size the phone would hold too much in memory. */
const MAX_PDF_BYTES = 60 * 1024 * 1024;

export function Library({ onOpen }: { onOpen: (id: string) => void }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [books, setBooks] = useState<Project[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paste, setPaste] = useState<string | null>(null);
  const [pdf, setPdf] = useState<{ base64: string; name: string } | null>(null);

  const reload = useCallback(() => void listProjects().then(setBooks), []);
  useEffect(reload, [reload]);

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
            <Text style={[st.h1, { color: c.ink }]}>Knižnica</Text>
            <View style={[st.card, { backgroundColor: c.surface }]}>
              <Text style={[st.h2, { color: c.ink }]}>Pridať knihu</Text>
              <Text style={{ color: c.ink2, fontSize: 15, lineHeight: 21 }}>
                Vyber PDF alebo textový súbor, prípadne vlož text. Hlas ho prečíta po slovensky alebo po anglicky.
              </Text>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <Button title="Vybrať súbor" onPress={() => void pickFile()} busy={!!busy} style={{ flex: 1 }} />
                <Button title="Vložiť text" kind="secondary" onPress={() => setPaste("")} disabled={!!busy} style={{ flex: 1 }} />
              </View>
              {busy && <Text style={{ color: c.ink2 }}>{busy}</Text>}
            </View>
            {error && <Note tone="error">{error}</Note>}
            {!voiceAvailable && <Note tone="warn">{NO_VOICE_MESSAGE}</Note>}
            {voiceAvailable && !modelDownloaded() && (
              <Note>
                Pri prvom prehrávaní sa stiahne hlasový model, asi 380 MB. Odporúčame Wi‑Fi. Potom hlas funguje aj bez internetu.
              </Note>
            )}
            {books.length > 0 && <Text style={[st.h2, { color: c.ink, marginTop: 8 }]}>Moje knihy</Text>}
          </View>
        }
        ListEmptyComponent={<Text style={{ color: c.ink2, fontSize: 15 }}>Zatiaľ tu nie je žiadna kniha.</Text>}
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

const st = StyleSheet.create({
  h1: { fontSize: 34, fontWeight: "800", letterSpacing: -0.5 },
  h2: { fontSize: 20, fontWeight: "700" },
  card: { borderRadius: 16, padding: 16, gap: 12 },
  row: { flexDirection: "row", gap: 14, alignItems: "center" },
  input: { flex: 1, borderRadius: 12, padding: 14, fontSize: 17, lineHeight: 24 },
});
