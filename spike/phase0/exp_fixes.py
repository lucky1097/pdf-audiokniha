"""Phase 0b: do number normalization and per-sentence generation fix the problems seen in phase 0?

For each voice, every sentence is generated on its own, several times. Each take is checked by Whisper,
and we record seconds per character so we can see whether repeats show up as unusually long audio.
Writes samples/fixes/*.mp3 and samples/fixes/results.json.
"""
import json
import re
import time
from pathlib import Path

import numpy as np
import sherpa_onnx
import soundfile as sf
from faster_whisper import WhisperModel

from asr_check import load_16k
from gen_samples import gen_cfg, supertonic
from score import score

HERE = Path(__file__).parent
OUT = HERE / "samples" / "fixes"
OUT.mkdir(parents=True, exist_ok=True)

# What a normalizer should turn the phase 0 "tricky" passages into.
SK_NORM = (
    "Kapitola tri. Ráno pätnásteho marca dvetisícdvadsaťštyri bolo v Žiline asi tri stupne Celzia. "
    "Z reproduktora sa ozvalo: „Rýchlik R šesťsto dvanásť do Bratislavy mešká približne dvadsať minút.“ "
    "Jana si povzdychla. „Tak to sme zase tu,“ povedala potichu, napríklad sama sebe, a vybrala z tašky knihu "
    "o dejinách Uhorska v devätnástom storočí. Stála dvanásť eur päťdesiat centov, to jest o tridsať percent viac, než čakala."
)
SK_RAW = (
    "Kapitola 3. Ráno 15. marca 2024 bolo v Žiline asi 3 °C. Z reproduktora sa ozvalo: "
    "„Rýchlik R 612 do Bratislavy mešká približne 20 minút.“ Jana si povzdychla. "
    "„Tak to sme zase tu,“ povedala potichu, napr. sama sebe, a vybrala z tašky knihu "
    "o dejinách Uhorska v 19. storočí. Stála 12,50 €, t. j. o 30 % viac, než čakala."
)
EN_NORM = (
    "Chapter twelve. On March third, twenty nineteen, Doctor Evans paid one thousand two hundred fifty dollars and "
    "seventy-five cents for a one point five kilogram brass compass, roughly forty percent more than he had planned. "
    "\"It's worth every penny,\" he said, glancing at the clock: seven forty-five in the evening. "
    "His assistant, Missus O'Neill, wasn't so sure."
)

CASES = [
    # (case id, lang, text to speak, reference the listener should hear, takes)
    ("sk_norm", "sk", SK_NORM, SK_NORM, 3),
    ("sk_raw", "sk", SK_RAW, SK_NORM, 1),
    ("en_norm", "en", EN_NORM, EN_NORM, 1),
]
VOICES = [3, 6]


def sentences(text: str) -> list[str]:
    # Split after . ! ? (optionally followed by a closing quote) when the next sentence starts.
    parts = re.split(r"(?:(?<=[.!?])|(?<=[.!?][“”\"]))\s+(?=[„\"A-ZÁÄČĎÉÍĹĽŇÓÔŔŠŤÚÝŽ])", text.strip())
    return [p for p in parts if p]


def main() -> None:
    tts = supertonic()
    asr = WhisperModel("large-v3-turbo", device="cpu", compute_type="int8", cpu_threads=4)
    rows = []
    for case, lang, text, ref, takes in CASES:
        spoken, heard = sentences(text), sentences(ref)
        assert len(spoken) == len(heard), (case, len(spoken), len(heard))
        for voice in VOICES:
            for take in range(1, takes + 1):
                pieces = []
                for i, (s, r) in enumerate(zip(spoken, heard)):
                    t0 = time.perf_counter()
                    audio = tts.generate(s, gen_cfg(voice, 8, lang))
                    elapsed = time.perf_counter() - t0
                    x = np.asarray(audio.samples, dtype=np.float32)
                    dur = x.size / audio.sample_rate
                    f = OUT / f"{case}_v{voice}_t{take}_s{i}.wav"
                    sf.write(f, x, audio.sample_rate)
                    segs, _ = asr.transcribe(load_16k(f), language=lang, beam_size=5, vad_filter=False)
                    hyp = " ".join(seg.text.strip() for seg in segs)
                    sc = score(r, hyp, lang)
                    n_ref, n_hyp = len(r.split()), len(hyp.split())
                    rows.append({
                        "case": case, "voice": voice, "take": take, "sentence": i, "text": s, "transcript": hyp,
                        **sc, "seconds": round(dur, 2), "sec_per_char": round(dur / len(r), 4),
                        "extra_words": n_hyp - n_ref, "compute": round(elapsed, 2),
                    })
                    pieces.append(x)
                    pieces.append(np.zeros(int(0.35 * audio.sample_rate), dtype=np.float32))
                    print(f"{case} v{voice} t{take} s{i}: WERsnd {sc['wer_snd']:.2f} extra {n_hyp - n_ref:+d} "
                          f"s/char {dur / len(r):.3f} | {hyp[:70]}", flush=True)
                sf.write(OUT / f"{case}_v{voice}_t{take}.mp3", np.concatenate(pieces), audio.sample_rate, format="MP3")
    (OUT / "results.json").write_text(json.dumps(rows, indent=2, ensure_ascii=False), encoding="utf-8")


if __name__ == "__main__":
    main()
