// Small shared pieces: buttons, the generated cover, the progress bar.
import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { coverColor, useColors } from "./theme.ts";

export function Button({ title, onPress, kind = "primary", disabled, busy, style }: {
  title: string;
  onPress: () => void;
  kind?: "primary" | "secondary" | "quiet";
  disabled?: boolean;
  busy?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useColors();
  const bg = kind === "primary" ? c.accent : kind === "secondary" ? c.surface : "transparent";
  const fg = kind === "primary" ? c.onAccent : kind === "secondary" ? c.ink : c.accentText;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [s.btn, { backgroundColor: bg, opacity: disabled ? 0.45 : pressed ? 0.8 : 1 }, style]}
    >
      {busy ? <ActivityIndicator color={fg} /> : <Text style={[s.btnText, { color: fg }]}>{title}</Text>}
    </Pressable>
  );
}

export function Cover({ title, size }: { title: string; size: number }) {
  return (
    <View style={[s.cover, { width: size, height: size, backgroundColor: coverColor(title), padding: size * 0.1 }]} accessibilityElementsHidden>
      {size >= 80 && (
        <Text style={[s.coverTitle, { fontSize: Math.max(12, size * 0.12) }]} numberOfLines={3}>
          {title}
        </Text>
      )}
    </View>
  );
}

export function Bar({ value }: { value: number }) {
  const c = useColors();
  return (
    <View style={[s.bar, { backgroundColor: c.line }]}>
      <View style={[s.barFill, { backgroundColor: c.accent, width: `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%` }]} />
    </View>
  );
}

export function Note({ children, tone = "plain" }: { children: ReactNode; tone?: "plain" | "warn" | "error" }) {
  const c = useColors();
  const bg = tone === "warn" ? c.warnSoft : tone === "error" ? c.warnSoft : c.surface;
  const fg = tone === "warn" ? c.warn : tone === "error" ? c.error : c.ink2;
  return (
    <View style={[s.note, { backgroundColor: bg }]}>
      <Text style={{ color: fg, fontSize: 15, lineHeight: 21 }}>{children}</Text>
    </View>
  );
}

/** The iOS share symbol: an open box with an arrow coming out of its top. Plain Views, so no SVG dependency. */
export function ShareIcon({ size = 20, color }: { size?: number; color: string }) {
  const w = 2; // stroke width
  const boxTop = size * 0.45;
  const tip = size * 0.08; // top of the arrow
  const stemH = size * 0.5 - tip;
  const armLen = size * 0.3; // length of each chevron bar
  const arm = armLen * Math.SQRT1_2; // how far one bar drops from the tip
  const armMidX = arm / 2;
  const armMidY = tip + arm / 2;
  const cx = size / 2;
  return (
    <View style={{ width: size, height: size }} accessibilityElementsHidden>
      {/* box: left, right and bottom walls, open at the top */}
      <View
        style={{
          position: "absolute",
          left: size * 0.2,
          top: boxTop,
          width: size * 0.6,
          height: size - boxTop,
          borderWidth: w,
          borderTopWidth: 0,
          borderColor: color,
          borderBottomLeftRadius: size * 0.12,
          borderBottomRightRadius: size * 0.12,
        }}
      />
      {/* stem */}
      <View style={{ position: "absolute", left: cx - w / 2, top: tip, width: w, height: stemH, backgroundColor: color }} />
      {/* arrow head: two bars, one at -45 and one at +45 degrees */}
      <View
        style={{
          position: "absolute",
          left: cx - armMidX - armLen / 2,
          top: armMidY - w / 2,
          width: armLen,
          height: w,
          borderRadius: w / 2,
          backgroundColor: color,
          transform: [{ rotate: "-45deg" }],
        }}
      />
      <View
        style={{
          position: "absolute",
          left: cx + armMidX - armLen / 2,
          top: armMidY - w / 2,
          width: armLen,
          height: w,
          borderRadius: w / 2,
          backgroundColor: color,
          transform: [{ rotate: "45deg" }],
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  btn: { minHeight: 48, paddingHorizontal: 18, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  btnText: { fontSize: 16, fontWeight: "600" },
  cover: { borderRadius: 10, justifyContent: "flex-end" },
  coverTitle: { color: "#fff", fontWeight: "800", letterSpacing: -0.3 },
  bar: { height: 6, borderRadius: 3, overflow: "hidden" },
  barFill: { height: 6, borderRadius: 3 },
  note: { borderRadius: 12, padding: 14 },
});
