import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { About } from "./About.tsx";
import { BookScreen } from "./BookScreen.tsx";
import { Library } from "./Library.tsx";

export default function App() {
  const [open, setOpen] = useState<string | null>(null);
  const [about, setAbout] = useState(false);
  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      {open ? (
        <BookScreen id={open} onBack={() => setOpen(null)} />
      ) : about ? (
        <About onBack={() => setAbout(false)} />
      ) : (
        <Library onOpen={setOpen} onAbout={() => setAbout(true)} />
      )}
    </SafeAreaProvider>
  );
}
