"""Re-transcribe one stretch of a chapter on its own, to tell a voice skip from a Whisper dropout.

usage: python recheck_range.py <out-dir> <first-segment> <last-segment>
"""
import json
import sys
from pathlib import Path

from faster_whisper import WhisperModel

from align_check import load_16k

out, a, b = Path(sys.argv[1]), int(sys.argv[2]), int(sys.argv[3])
meta = json.loads((out / "segments.json").read_text(encoding="utf-8"))
segs = meta["segments"]
audio = load_16k(out / "audio.wav")
start, end = segs[a]["start"], segs[b]["end"] + 0.3
model = WhisperModel("large-v3-turbo", device="cpu", compute_type="int8", cpu_threads=4)
pieces, _ = model.transcribe(audio[int(start * 16000):int(end * 16000)], language=meta["lang"], beam_size=5,
                             vad_filter=False, condition_on_previous_text=False)
print(f"segments {a}-{b} ({end - start:.0f} s):")
for s in segs[a:b + 1]:
    print("  REF:", s["text"])
print("HEARD:", " ".join(p.text.strip() for p in pieces))
