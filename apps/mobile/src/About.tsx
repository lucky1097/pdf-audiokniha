// "O appke": privacy, the AI notice, the voice model's terms of use (OpenRAIL-M) and the licences of what ships.
import Constants from "expo-constants";
import { useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LICENSES } from "./generated/licenses.ts";
import { useColors } from "./theme.ts";
import { Button } from "./ui.tsx";

const SITE = "https://lucky1097.github.io/pdf-audiokniha";

/** The OpenRAIL-M use restrictions, passed on as terms of use (the licence requires it). */
const RESTRICTIONS = [
  "na nič, čo porušuje zákon;",
  "na zneužívanie alebo ubližovanie deťom;",
  "na šírenie overiteľne nepravdivých informácií s cieľom ublížiť iným;",
  "na šírenie osobných údajov, ktoré môžu niekomu ublížiť;",
  "na zverejňovanie obsahu bez jasného označenia, že ho vytvoril stroj;",
  "na ohováranie, ponižovanie alebo obťažovanie iných;",
  "na napodobňovanie iných ľudí bez ich súhlasu (deepfake);",
  "na plne automatické rozhodnutia, ktoré poškodzujú práva človeka;",
  "na diskrimináciu ľudí alebo skupín podľa správania, vlastností alebo chránených znakov;",
  "na zneužívanie zraniteľnosti ľudí pre ich vek, sociálnu situáciu, telesný alebo duševný stav;",
  "na lekárske rady a výklad lekárskych výsledkov;",
  "na súdne, policajné, imigračné alebo azylové rozhodovanie o ľuďoch.",
];

export function About({ onBack }: { onBack: () => void }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  // One licence text is open at a time.
  const [open, setOpen] = useState<number | null>(null);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: insets.bottom + 24 }}>
        <Button title="‹ Knižnica" kind="quiet" onPress={onBack} style={{ alignSelf: "flex-start", paddingHorizontal: 0 }} />
        <Text style={[st.h1, { color: c.ink }]}>O appke</Text>
        <Text style={{ color: c.ink2, fontSize: 15, lineHeight: 21 }}>{`Prečítaj mi ${Constants.expoConfig?.version ?? ""}`}</Text>

        <View style={[st.card, { backgroundColor: c.surface }]}>
          <Text style={[st.heading, { color: c.ink }]}>Súkromie</Text>
          <Text style={[st.text, { color: c.ink2 }]}>
            Knihy, texty aj zvuk zostávajú len v tomto telefóne. Appka nemá účty, reklamy ani analytiku a nič o tebe
            neposiela. Z internetu raz stiahne hlasový model zo stránky Hugging Face.
          </Text>
          <Button
            title="Zásady súkromia"
            kind="quiet"
            onPress={() => void Linking.openURL(`${SITE}/privacy.html`)}
            style={{ alignSelf: "flex-start", paddingHorizontal: 0 }}
          />
        </View>

        <View style={[st.card, { backgroundColor: c.surface }]}>
          <Text style={[st.heading, { color: c.ink }]}>Hlas je vytvorený umelou inteligenciou</Text>
          <Text style={[st.text, { color: c.ink2 }]}>
            Číta model Supertonic 3 od Supertone Inc. Ak nahrávku zverejníš alebo pošleš ďalej, uveď, že hlas vytvorila
            umelá inteligencia.
          </Text>
        </View>

        <View style={[st.card, { backgroundColor: c.surface }]}>
          <Text style={[st.heading, { color: c.ink }]}>Podmienky použitia hlasu</Text>
          <Text style={[st.text, { color: c.ink2 }]}>
            Model hlasu je pod licenciou OpenRAIL‑M. Používaním appky súhlasíš, že ho nepoužiješ:
          </Text>
          {RESTRICTIONS.map((r) => (
            <View key={r} style={{ flexDirection: "row", gap: 8 }}>
              <Text style={[st.text, { color: c.ink2 }]}>•</Text>
              <Text style={[st.text, { color: c.ink2, flex: 1 }]}>{r}</Text>
            </View>
          ))}
          <Text style={[st.text, { color: c.ink2 }]}>Záväzné je anglické znenie licencie nižšie.</Text>
        </View>

        <View style={[st.card, { backgroundColor: c.surface }]}>
          <Text style={[st.heading, { color: c.ink }]}>Licencie</Text>
          <Text style={[st.text, { color: c.ink2 }]}>Appka Prečítaj mi je otvorený softvér pod licenciou MIT.</Text>
          <Button
            title="Zdrojový kód na GitHube"
            kind="quiet"
            onPress={() => void Linking.openURL("https://github.com/lucky1097/pdf-audiokniha")}
            style={{ alignSelf: "flex-start", paddingHorizontal: 0 }}
          />
          {LICENSES.map((l, i) => (
            <View key={l.name} style={{ gap: 6 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: open === i }}
                onPress={() => setOpen(open === i ? null : i)}
                style={({ pressed }) => [st.licRow, { borderColor: c.line, opacity: pressed ? 0.7 : 1 }]}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ color: c.ink, fontSize: 16, fontWeight: "600" }}>{l.name}</Text>
                  <Text style={{ color: c.ink2, fontSize: 14 }}>{l.licence}</Text>
                </View>
                <Text style={{ color: c.ink2, fontSize: 20, fontWeight: "600" }}>{open === i ? "−" : "+"}</Text>
              </Pressable>
              {open === i && (
                <Text selectable style={{ color: c.ink2, fontSize: 12, lineHeight: 17, paddingHorizontal: 4 }}>
                  {l.text}
                </Text>
              )}
            </View>
          ))}
        </View>

        <View style={[st.card, { backgroundColor: c.surface }]}>
          <Text style={[st.heading, { color: c.ink }]}>Podpora</Text>
          <Text style={[st.text, { color: c.ink2 }]}>Otázky a chyby nám napíš cez stránku podpory.</Text>
          <Button
            title="Podpora"
            kind="quiet"
            onPress={() => void Linking.openURL(`${SITE}/support.html`)}
            style={{ alignSelf: "flex-start", paddingHorizontal: 0 }}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  h1: { fontSize: 34, fontWeight: "800", letterSpacing: -0.5 },
  card: { borderRadius: 16, padding: 16, gap: 10 },
  heading: { fontSize: 17, fontWeight: "700" },
  text: { fontSize: 15, lineHeight: 21 },
  licRow: { flexDirection: "row", gap: 12, alignItems: "center", borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 12 },
});
