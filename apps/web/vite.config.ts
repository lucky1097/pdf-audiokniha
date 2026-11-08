import { createReadStream, existsSync, statSync } from "node:fs";
import { copyFile, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

const ROOT = resolve(import.meta.dirname, "../..");
const ORT_DIST = join(ROOT, "node_modules/onnxruntime-web/dist");
// Dev only: serve the Supertonic files already downloaded for the spikes, laid out like the
// Hugging Face repo (onnx/*, voice_styles/*), so development does not re-download 380 MB.
const LOCAL_MODEL = join(ROOT, "spike/phase0/models/supertonic3-fp32");

const TYPES: Record<string, string> = {
  ".mjs": "text/javascript",
  ".js": "text/javascript",
  ".wasm": "application/wasm",
  ".json": "application/json",
  ".onnx": "application/octet-stream",
};

function serveDir(prefix: string, dir: (rest: string) => string | null): Plugin["configureServer"] {
  return (server) => {
    server.middlewares.use(prefix, (req, res, next) => {
      const rest = decodeURIComponent((req.url ?? "/").split("?")[0]).replace(/^\/+/, "");
      const file = dir(rest);
      if (!file || rest.includes("..") || !existsSync(file) || !statSync(file).isFile()) return next();
      res.setHeader("Content-Type", TYPES[extname(file)] ?? "application/octet-stream");
      res.setHeader("Content-Length", statSync(file).size);
      res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
      // onnxruntime's thread workers are started from these files and must be isolated too.
      res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
      createReadStream(file).pipe(res);
    });
  };
}

/** onnxruntime-web loads its .wasm/.mjs at runtime from `wasmPaths`; serve them in dev, copy them on build. */
function ortFiles(): Plugin {
  return {
    name: "ort-files",
    configureServer: serveDir("/ort", (rest) => join(ORT_DIST, rest)),
    async writeBundle(options) {
      const out = join(options.dir!, "ort");
      await mkdir(out, { recursive: true });
      // Copy exactly the runtime files the webgpu bundle asks for (1.30 loads the asyncify build; older versions jsep),
      // read from the bundle itself so an onnxruntime upgrade cannot leave the build without them.
      const bundle = await readFile(join(ORT_DIST, "ort.webgpu.bundle.min.mjs"), "utf8");
      const wanted = new Set<string>();
      for (const [name] of bundle.matchAll(/ort-wasm-simd-threaded[\w.]*\.mjs/g)) wanted.add(name).add(name.replace(/\.mjs$/, ".wasm"));
      const have = new Set(await readdir(ORT_DIST));
      const missing = [...wanted].filter((f) => !have.has(f));
      if (!wanted.size || missing.length) throw new Error(`ort-files: runtime files not found in onnxruntime-web/dist: ${missing.join(", ") || "none named in the bundle"}`);
      for (const f of wanted) await copyFile(join(ORT_DIST, f), join(out, f));
    },
  };
}

function localModel(): Plugin {
  return {
    name: "local-model",
    apply: "serve",
    configureServer: serveDir("/models", (rest) => {
      if (rest.startsWith("onnx/")) return join(LOCAL_MODEL, rest.slice(5));
      if (rest.startsWith("voice_styles/")) return join(LOCAL_MODEL, rest);
      return null;
    }),
  };
}

/** Dev only: POST /__dev/save?name=x.m4b stores a file in spike/phase2/out, so exports can be checked with ffmpeg. */
function devSave(): Plugin {
  return {
    name: "dev-save",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/__dev/save", async (req, res) => {
        const name = new URL(req.url ?? "", "http://x").searchParams.get("name") ?? "";
        if (req.method !== "POST" || !/^[\w.-]+$/.test(name)) return void (res.statusCode = 400, res.end());
        const chunks: Buffer[] = [];
        for await (const c of req) chunks.push(c as Buffer);
        const dir = join(ROOT, "spike/phase2/out");
        await mkdir(dir, { recursive: true });
        await writeFile(join(dir, name), Buffer.concat(chunks));
        res.statusCode = 204;
        res.end();
      });
    },
  };
}

// Multi-threaded WASM needs a cross-origin isolated page.
const isolation = { "Cross-Origin-Opener-Policy": "same-origin", "Cross-Origin-Embedder-Policy": "require-corp" };

export default defineConfig(({ command }) => ({
  plugins: [react(), ortFiles(), localModel(), devSave()],
  define: {
    __MODEL_BASE__: JSON.stringify(command === "serve" ? "/models" : "https://huggingface.co/Supertone/supertonic-3/resolve/main"),
  },
  server: { port: 5178, strictPort: true, headers: isolation },
  preview: { port: 5179, headers: isolation },
  optimizeDeps: { exclude: ["onnxruntime-web"] },
  worker: { format: "es" },
  build: { target: "es2022" },
}));
