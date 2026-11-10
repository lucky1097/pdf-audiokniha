// Pronunciation dictionary: the user writes a word as it is in the text and how the voice should read it.
// Same model as the web app's Dictionary tab; saving regenerates only the sentences that contain the word.
import { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import type { BookController, BookState } from "./lib/book.ts";
import { useColors } from "./theme.ts";
import { Button } from "./ui.tsx";

export function Dictionary({ ctl, st }: { ctl: BookController; st: BookState }) {
  const c = useColors();
  const [word, setWord] = useState("");
  const [say, setSay] = useState("");
  // Books saved by older versions have no dictionary field.
  const dictionary = st.project.dictionary ?? {};
  const entries = Object.entries(dictionary);
  const ready = word.trim() !== "" && say.trim() !== "";

  const add = () => {
    const w = word.trim();
    const s = say.trim();
    if (!w || !s) return;
    ctl.update({ dictionary: { ...dictionary, [w]: s } });
    setWord("");
    setSay("");
  };

  const remove = (key: string) => {
    const d = { ...dictionary };
    delete d[key];
    ctl.update({ dictionary: d });
  };

  const field = { color: c.ink, borderColor: c.line, backgroundColor: c.surface };

  return (
    <View style={[s.card, { backgroundColor: c.surface }]}>
      <Text style={{ color: c.ink2, fontSize: 13 }}>
        Mená a slová, ktoré hlas číta zle, napíš tak, ako sa vyslovujú. Platí to pre celú knihu a znova sa pripravia len dotknuté vety.
      </Text>

      <View style={{ gap: 8 }}>
        <View style={{ gap: 4 }}>
          <Text style={{ color: c.ink, fontSize: 14, fontWeight: "600" }}>V texte</Text>
          <TextInput
            value={word}
            onChangeText={setWord}
            placeholder="Didolićová"
            placeholderTextColor={c.ink2}
            autoCapitalize="none"
            autoCorrect={false}
            style={[s.input, field]}
          />
        </View>
        <View style={{ gap: 4 }}>
          <Text style={{ color: c.ink, fontSize: 14, fontWeight: "600" }}>Čítať ako</Text>
          <TextInput
            value={say}
            onChangeText={setSay}
            placeholder="Didoličová"
            placeholderTextColor={c.ink2}
            autoCapitalize="none"
            autoCorrect={false}
            style={[s.input, field]}
          />
        </View>
        <Button title="Pridať" onPress={add} disabled={!ready} />
      </View>

      {entries.length ? (
        <View>
          {entries.map(([k, v]) => (
            <View key={k} style={[s.row, { borderColor: c.line }]}>
              <Text style={{ color: c.ink, fontSize: 15, flex: 1 }} numberOfLines={2}>
                <Text style={{ fontWeight: "700" }}>{k}</Text> → {v}
              </Text>
              <Button title="Odstrániť" kind="quiet" onPress={() => remove(k)} style={{ minHeight: 36, paddingHorizontal: 8 }} />
            </View>
          ))}
        </View>
      ) : (
        <Text style={{ color: c.ink2, fontSize: 14 }}>Zatiaľ žiadne slová.</Text>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderRadius: 16, padding: 16, gap: 12 },
  input: { height: 44, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, fontSize: 16 },
  row: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
});
