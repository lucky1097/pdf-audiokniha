"""Match sherpa-onnx Supertonic speaker ids (voice.bin) to the official voice style JSONs (F1..M5)."""
import json
from pathlib import Path

import numpy as np

HERE = Path(__file__).parent
STYLES = HERE / "models" / "supertonic3-fp32" / "voice_styles"
BIN = HERE / "models" / "sherpa-onnx-supertonic-3-tts-int8-2026-05-11" / "voice.bin"

blob = np.fromfile(BIN, dtype=np.float32)
print("voice.bin floats:", blob.size)
result = {}
for f in sorted(STYLES.glob("*.json")):
    j = json.loads(f.read_text())
    ttl = np.asarray(j["style_ttl"]["data"], dtype=np.float32).ravel()
    probe = ttl[:64]
    # Slide the probe over the blob and find the exact (or closest) match.
    win = np.lib.stride_tricks.sliding_window_view(blob, probe.size)
    err = np.abs(win - probe).max(axis=1)
    pos = int(err.argmin())
    result[f.stem] = {"offset": pos, "max_abs_err": float(err[pos])}
per_speaker = None
offsets = sorted(v["offset"] for v in result.values())
if len(offsets) > 1:
    per_speaker = int(np.min(np.diff(offsets)))
for name, v in sorted(result.items(), key=lambda kv: kv[1]["offset"]):
    sid = v["offset"] // per_speaker if per_speaker else None
    print(f"{name}: offset {v['offset']}  sid {sid}  err {v['max_abs_err']:.2e}")
