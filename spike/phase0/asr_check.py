"""Phase 0: transcribe every sample with Whisper and score it against the source text.

This is an intelligibility proxy (did the voice say the right words?), not a naturalness score.
Writes ./samples/asr.json.
"""
import json
import re
import unicodedata
from pathlib import Path

import numpy as np
import soundfile as sf
from faster_whisper import WhisperModel

from texts import GALLERY_SK, TEXTS

HERE = Path(__file__).parent
OUT = HERE / "samples"


def words(s: str) -> list[str]:
    s = unicodedata.normalize("NFC", s.lower())
    return re.findall(r"[^\W_]+", s)


def wer(ref: str, hyp: str) -> float:
    r, h = words(ref), words(hyp)
    d = list(range(len(h) + 1))
    for i, rw in enumerate(r, 1):
        prev, d[0] = d[0], i
        for j, hw in enumerate(h, 1):
            cur = min(d[j] + 1, d[j - 1] + 1, prev + (rw != hw))
            prev, d[j] = d[j], cur
    return d[len(h)] / max(len(r), 1)


def load_16k(path: Path) -> np.ndarray:
    # faster-whisper's own decoder breaks with the installed PyAV, so decode and resample here.
    x, sr = sf.read(path, dtype="float32", always_2d=True)
    x = x.mean(axis=1)
    n = int(len(x) * 16000 / sr)
    return np.interp(np.linspace(0, len(x) - 1, n), np.arange(len(x)), x).astype(np.float32)


def main() -> None:
    results = json.loads((OUT / "results.json").read_text(encoding="utf-8"))
    model = WhisperModel("large-v3-turbo", device="cpu", compute_type="int8", cpu_threads=4)
    rows = []
    for row in results["rows"]:
        text_id = row["text"]
        lang, ref = ("sk", GALLERY_SK) if text_id == "galeria" else TEXTS[text_id]
        segments, _ = model.transcribe(load_16k(OUT / row["file"]), language=lang, beam_size=5, vad_filter=False)
        hyp = " ".join(s.text.strip() for s in segments)
        score = round(wer(ref, hyp), 3)
        rows.append({"file": row["file"], "text": text_id, "wer": score, "transcript": hyp})
        print(f"{row['file']:42s} WER {score:.3f}  {hyp[:90]}", flush=True)
    (OUT / "asr.json").write_text(json.dumps(rows, indent=2, ensure_ascii=False), encoding="utf-8")


if __name__ == "__main__":
    main()
