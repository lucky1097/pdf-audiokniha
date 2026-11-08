"""Download and unpack the phase 0 TTS models from the sherpa-onnx tts-models release."""
import sys
import tarfile
import urllib.request
from pathlib import Path

BASE = "https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models"
MODELS = [
    "kokoro-int8-multi-lang-v1_0",
    "sherpa-onnx-supertonic-3-tts-int8-2026-05-11",
    "vits-piper-sk_SK-lili-medium",
]

out = Path(__file__).parent / "models"
out.mkdir(exist_ok=True)

for name in MODELS:
    if (out / name).is_dir():
        print(f"{name}: already there")
        continue
    archive = out / f"{name}.tar.bz2"
    print(f"{name}: downloading", flush=True)
    urllib.request.urlretrieve(f"{BASE}/{name}.tar.bz2", archive)
    print(f"{name}: extracting", flush=True)
    with tarfile.open(archive, "r:bz2") as tar:
        tar.extractall(out, filter="data")
    archive.unlink()

for d in sorted(out.iterdir()):
    print(d.name)
    for f in sorted(d.iterdir())[:14]:
        size = f.stat().st_size / 1e6 if f.is_file() else 0
        print(f"   {f.name}  {size:.1f} MB")
sys.exit(0)
