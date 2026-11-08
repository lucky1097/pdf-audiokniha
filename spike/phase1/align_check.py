"""Phase 1: check a whole synthesized chapter with Whisper.

The full audio is transcribed once (cached in <out-dir>/transcript.json). The transcript is canonicalized
with our own normalizer (Whisper writes "1860", the reference says "tisícosemstošesťdesiat") and aligned to
the whole chapter's spoken text in one global alignment. Each edit is then attributed to the sentence that
owns the reference word, so timing jitter at sentence boundaries cannot move words between sentences.
Slovak is compared by sound (y=i, voicing pairs) as in phase 0.

Per sentence we report inserted words, deleted words, substitutions and repeats (a word or phrase said
twice in a row that the text says once).

usage: python align_check.py <out-dir> [<out-dir> ...]
writes <out-dir>/check.json and prints a summary per chapter.
"""
import json
import re
import subprocess
import sys
import unicodedata
from pathlib import Path

import numpy as np
import soundfile as sf

ROOT = Path(__file__).resolve().parents[2]
NODE = r"C:\Program Files\nodejs\node.exe"
SK_SOUND = str.maketrans({"y": "i", "ý": "í", "d": "t", "z": "s", "ž": "š", "b": "p", "v": "f", "g": "k", "h": "x", "ä": "e"})


def canon(text: str, lang: str) -> str:
    """Run text through the TS normalizer so digits become words exactly like the reference."""
    return subprocess.run([NODE, str(ROOT / "apps/cli/src/main.ts"), "normalize", "--lang", lang],
                          input=text.encode("utf-8"), capture_output=True, check=True, cwd=ROOT).stdout.decode("utf-8")


def tokens(s: str, lang: str) -> list[str]:
    s = unicodedata.normalize("NFC", s.lower()).replace("-", " ")
    words = re.findall(r"[^\W_]+", s)
    if lang == "sk":
        words = [w.replace("ch", "x").translate(SK_SOUND) for w in words]
    return words


def align(ref: list[str], hyp: list[str]) -> list[tuple[str, int | None, str | None]]:
    """Levenshtein alignment → (op, ref_index, hyp_word); op in = sub ins del. Row-by-row to keep memory small."""
    n, m = len(ref), len(hyp)
    back = np.zeros((n + 1, m + 1), dtype=np.uint8)  # 0 diag, 1 up (del), 2 left (ins)
    prev = np.arange(m + 1)
    back[0, 1:] = 2
    for i in range(1, n + 1):
        cur = np.empty(m + 1, dtype=np.int64)
        cur[0] = i
        back[i, 0] = 1
        r = ref[i - 1]
        for j in range(1, m + 1):
            diag = prev[j - 1] + (r != hyp[j - 1])
            up = prev[j] + 1
            left = cur[j - 1] + 1
            if diag <= up and diag <= left:
                cur[j], back[i, j] = diag, 0
            elif up <= left:
                cur[j], back[i, j] = up, 1
            else:
                cur[j], back[i, j] = left, 2
        prev = cur
    ops = []
    i, j = n, m
    while i or j:
        b = back[i, j]
        if b == 0:
            ops.append(("=" if ref[i - 1] == hyp[j - 1] else "sub", i - 1, hyp[j - 1]))
            i, j = i - 1, j - 1
        elif b == 1:
            ops.append(("del", i - 1, None))
            i -= 1
        else:
            ops.append(("ins", None, hyp[j - 1]))
            j -= 1
    return ops[::-1]


def repeated(ref: list[str], hyp: list[str]) -> list[str]:
    """Words or phrases said twice in a row in the audio but not in the text."""
    out = []
    for n in (1, 2, 3):
        for k in range(len(hyp) - 2 * n + 1):
            a, b = hyp[k:k + n], hyp[k + n:k + 2 * n]
            if a == b and (n > 1 or len(a[0]) > 2):
                in_ref = any(ref[r:r + n] == a and ref[r + n:r + 2 * n] == a for r in range(len(ref)))
                if not in_ref:
                    out.append(" ".join(a + b))
    return out


def longest_run(ops, kind: str) -> int:
    best = cur = 0
    for op in ops:
        cur = cur + 1 if op[0] == kind else 0
        best = max(best, cur)
    return best


def load_16k(path: Path) -> np.ndarray:
    x, sr = sf.read(path, dtype="float32", always_2d=True)
    x = x.mean(axis=1)
    n = int(len(x) * 16000 / sr)
    return np.interp(np.linspace(0, len(x) - 1, n), np.arange(len(x)), x).astype(np.float32)


def transcript(out: Path, lang: str, model_holder: list) -> str:
    cache = out / "transcript.json"
    if cache.exists():
        return json.loads(cache.read_text(encoding="utf-8"))["text"]
    if not model_holder:
        from faster_whisper import WhisperModel
        model_holder.append(WhisperModel("large-v3-turbo", device="cpu", compute_type="int8", cpu_threads=4))
    pieces, _ = model_holder[0].transcribe(load_16k(out / "audio.wav"), language=lang, beam_size=5,
                                           vad_filter=False, condition_on_previous_text=False)
    text = " ".join(p.text.strip() for p in pieces)
    cache.write_text(json.dumps({"text": text}, ensure_ascii=False), encoding="utf-8")
    return text


def check(out: Path, model_holder: list) -> dict:
    meta = json.loads((out / "segments.json").read_text(encoding="utf-8"))
    lang, segs = meta["lang"], meta["segments"]
    hyp = tokens(canon(transcript(out, lang, model_holder), lang), lang)

    ref: list[str] = []
    owner: list[int] = []
    seg_ref: list[list[str]] = []
    for k, s in enumerate(segs):
        t = tokens(s["text"], lang)
        seg_ref.append(t)
        ref.extend(t)
        owner.extend([k] * len(t))

    per_seg: list[list[tuple]] = [[] for _ in segs]
    last = 0
    for op in align(ref, hyp):
        k = owner[op[1]] if op[1] is not None else last
        if op[1] is not None:
            last = k
        per_seg[k].append(op)

    rows, tot_err = [], 0
    for k, (s, ops) in enumerate(zip(segs, per_seg)):
        ins = sum(o[0] == "ins" for o in ops)
        dele = sum(o[0] == "del" for o in ops)
        sub = sum(o[0] == "sub" for o in ops)
        heard = [o[2] for o in ops if o[2] is not None]
        reps = repeated(seg_ref[k], heard)
        n = len(seg_ref[k])
        tot_err += ins + dele + sub
        flags = []
        if reps:
            flags.append("repeat")
        if longest_run(ops, "ins") >= 3:
            flags.append("extra-words")
        if longest_run(ops, "del") >= 3:
            flags.append("skip")
        if n >= 4 and (ins + dele + sub) / n > 0.35:
            flags.append("garbled")
        rows.append({"i": s["i"], "start": s["start"], "text": s["text"], "heard": " ".join(heard),
                     "ins": ins, "del": dele, "sub": sub, "words": n, "repeats": reps, "flags": flags})
    count = lambda f: sum(1 for r in rows if f in r["flags"])
    summary = {"dir": out.name, "lang": lang, "segments": len(rows), "audio_s": meta["audio"], "words": len(ref),
               "wer_sound": round(tot_err / max(len(ref), 1), 3), "flagged": sum(1 for r in rows if r["flags"]),
               "repeats": count("repeat"), "extra_words": count("extra-words"), "skips": count("skip"), "garbled": count("garbled")}
    (out / "check.json").write_text(json.dumps({"summary": summary, "segments": rows}, indent=1, ensure_ascii=False), encoding="utf-8")
    return summary


if __name__ == "__main__":
    holder: list = []
    for d in sys.argv[1:]:
        print(json.dumps(check(Path(d), holder), ensure_ascii=False), flush=True)
