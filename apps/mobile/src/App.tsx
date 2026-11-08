import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { BookScreen } from "./BookScreen.tsx";
import { Library } from "./Library.tsx";

export default function App() {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      {open ? <BookScreen id={open} onBack={() => setOpen(null)} /> : <Library onOpen={setOpen} />}
    </SafeAreaProvider>
  );
}
