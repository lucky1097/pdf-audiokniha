// Same sentences, several seeds, 8 vs 16 steps: are repeats random per seed, and do more steps help?
// Writes out/repeat_seeds/<sentence>_s<steps>_seed<seed>.wav and index.json.
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { loadEngine } from "../../apps/cli/src/engine.ts";
import { encodeWav } from "../../apps/cli/src/wav.ts";

const ROOT = resolve(import.meta.dirname, "../..");
const OUT = join(import.meta.dirname, "out", "repeat_seeds");
const SENTENCES: Record<string, string> = {
  krivan: "Odbočuje z nej päť hlavných chrbátov na juh s vrcholy (Kriváň, Končistá, Gerlachovský štít, Slavkovský štít, Lomnický štít,) štyri na sever (Kozi Wierch,",
  vyska: "Vo Vysokých Tatrách nájdeme dvadsaťšesť vrcholov prevyšujúcich výšku dvetisíc päťsto metrov. desať vrcholov s výškou nad dvetisíc metrov nad morom v",
};
await mkdir(OUT, { recursive: true });
const engine = await loadEngine(ROOT, "fp32", 4);
const index = [];
for (const [id, text] of Object.entries(SENTENCES)) {
  for (const steps of [8, 16]) {
    for (let seed = 1; seed <= 5; seed++) {
      const audio = await engine.synthesize(text, { lang: "sk", voice: "F4", steps, seed });
      const file = `${id}_s${steps}_seed${seed}.wav`;
      await writeFile(join(OUT, file), encodeWav(audio, engine.sampleRate));
      index.push({ id, steps, seed, file, text });
      process.stdout.write(`${file}\n`);
    }
  }
}
await writeFile(join(OUT, "index.json"), JSON.stringify(index, null, 1));
