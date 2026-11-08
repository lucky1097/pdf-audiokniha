"""Phase 0: Whisper check of the audio that bench.html generated in the browser (samples/web/)."""
import json
from pathlib import Path

from faster_whisper import WhisperModel

from asr_check import load_16k, wer

HERE = Path(__file__).parent
WEB = HERE / "samples" / "web"

# Same passages as TEXTS in web/bench.js.
REF = {
    "sk": "Keď Jana vystúpila z vlaku, mesto ešte spalo. Nad strechami visela riedka hmla a z pekárne na rohu voňal čerstvý chlieb. Zastala pri starej lipe, kde sa kedysi stretávala s otcom, a chvíľu len počúvala, ako sa ulica pomaly prebúdza.",
    "en": "The rain had stopped by the time Clara reached the old lighthouse. She paused at the door, listening to the waves breaking somewhere below, and for a moment she wondered whether coming back had been a mistake.",
}


def main() -> None:
    model = WhisperModel("large-v3-turbo", device="cpu", compute_type="int8", cpu_threads=4)
    rows = []
    for f in sorted(WEB.glob("*.wav")):
        lang = f.stem.rsplit("_", 1)[1]
        segments, _ = model.transcribe(load_16k(f), language=lang, beam_size=5, vad_filter=False)
        hyp = " ".join(s.text.strip() for s in segments)
        rows.append({"file": f"web/{f.name}", "wer": round(wer(REF[lang], hyp), 3), "transcript": hyp})
        print(f"{f.name:28s} WER {rows[-1]['wer']:.3f}  {hyp}", flush=True)
    (HERE / "samples" / "asr_web.json").write_text(json.dumps(rows, indent=2, ensure_ascii=False), encoding="utf-8")


if __name__ == "__main__":
    main()
