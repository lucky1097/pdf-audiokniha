import { readFile } from "node:fs/promises";
import { join } from "node:path";
import * as ort from "onnxruntime-node";
import { SupertonicEngine, VOICES, type OrtLike, type SupertonicAssets } from "@audiokniha/tts";

export type Variant = "fp32" | "int8";

/** Repo-local model folders (gitignored); see spike/phase0/fetch_models.py and README. */
export const MODEL_DIRS: Record<Variant, string> = {
  fp32: "spike/phase0/models/supertonic3-fp32",
  int8: "spike/phase0/models/sherpa-onnx-supertonic-3-tts-int8-2026-05-11",
};

export async function loadEngine(root: string, variant: Variant, threads = 4): Promise<SupertonicEngine> {
  const fp32 = join(root, MODEL_DIRS.fp32);
  const dir = join(root, MODEL_DIRS[variant]);
  const suffix = variant === "int8" ? ".int8.onnx" : ".onnx";
  const json = async (p: string) => JSON.parse(await readFile(p, "utf8"));
  const styles: SupertonicAssets["styles"] = {};
  for (const v of VOICES) styles[v] = await json(join(fp32, "voice_styles", `${v}.json`));
  const assets: SupertonicAssets = {
    modelId: `supertonic-3-${variant}`,
    config: await json(join(fp32, "tts.json")),
    indexer: await json(join(fp32, "unicode_indexer.json")),
    styles,
    models: {
      duration_predictor: join(dir, `duration_predictor${suffix}`),
      text_encoder: join(dir, `text_encoder${suffix}`),
      vector_estimator: join(dir, `vector_estimator${suffix}`),
      vocoder: join(dir, `vocoder${suffix}`),
    },
  };
  return SupertonicEngine.create(ort as unknown as OrtLike, assets, {
    executionProviders: ["cpu"],
    intraOpNumThreads: threads,
    graphOptimizationLevel: "all",
  });
}
