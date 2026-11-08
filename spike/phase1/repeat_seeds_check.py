"""Transcribe out/repeat_seeds/*.wav and count repeats per sentence and step count."""
import json
from collections import defaultdict
from pathlib import Path

from faster_whisper import WhisperModel

from align_check import canon, load_16k, repeated, tokens

D = Path(__file__).parent / "out" / "repeat_seeds"
index = json.loads((D / "index.json").read_text(encoding="utf-8"))
model = WhisperModel("large-v3-turbo", device="cpu", compute_type="int8", cpu_threads=4)
stats = defaultdict(lambda: [0, 0])
for row in index:
    segs, _ = model.transcribe(load_16k(D / row["file"]), language="sk", beam_size=5, vad_filter=False)
    heard = " ".join(s.text.strip() for s in segs)
    reps = repeated(tokens(row["text"], "sk"), tokens(canon(heard, "sk"), "sk"))
    row.update(heard=heard, repeats=reps)
    stats[(row["id"], row["steps"])][0] += bool(reps)
    stats[(row["id"], row["steps"])][1] += 1
    print(f"{row['file']:28s} {'REPEAT ' + ';'.join(reps) if reps else 'ok'}", flush=True)
(D / "results.json").write_text(json.dumps(index, indent=1, ensure_ascii=False), encoding="utf-8")
for (sid, steps), (r, n) in sorted(stats.items()):
    print(f"{sid} steps={steps}: {r}/{n} takes repeated")
