"""Phase 0: generate the same passages with Kokoro, Supertonic 3 and Piper (sk) via sherpa-onnx.

Writes MP3 samples to ./samples and timings to ./samples/results.json.
"""
import json
import time
from pathlib import Path

import numpy as np
import sherpa_onnx
import soundfile as sf

from texts import GALLERY_SK, TEXTS

HERE = Path(__file__).parent
M = HERE / "models"
OUT = HERE / "samples"
OUT.mkdir(exist_ok=True)
THREADS = 4

KOKORO = M / "kokoro-int8-multi-lang-v1_0"
SUPERTONIC = M / "sherpa-onnx-supertonic-3-tts-int8-2026-05-11"
PIPER = M / "vits-piper-sk_SK-lili-medium"

results = []


def kokoro(lexicon: str, lang: str, espeak: bool = True) -> sherpa_onnx.OfflineTts:
    cfg = sherpa_onnx.OfflineTtsKokoroModelConfig(
        model=str(KOKORO / "model.int8.onnx"),
        voices=str(KOKORO / "voices.bin"),
        tokens=str(KOKORO / "tokens.txt"),
        lexicon=str(KOKORO / lexicon),
        data_dir=str(KOKORO / "espeak-ng-data") if espeak else "",
        lang=lang,
    )
    return build(sherpa_onnx.OfflineTtsModelConfig(kokoro=cfg, num_threads=THREADS))


def supertonic() -> sherpa_onnx.OfflineTts:
    s = SUPERTONIC
    cfg = sherpa_onnx.OfflineTtsSupertonicModelConfig(
        duration_predictor=str(s / "duration_predictor.int8.onnx"),
        text_encoder=str(s / "text_encoder.int8.onnx"),
        vector_estimator=str(s / "vector_estimator.int8.onnx"),
        vocoder=str(s / "vocoder.int8.onnx"),
        tts_json=str(s / "tts.json"),
        unicode_indexer=str(s / "unicode_indexer.bin"),
        voice_style=str(s / "voice.bin"),
    )
    return build(sherpa_onnx.OfflineTtsModelConfig(supertonic=cfg, num_threads=THREADS))


def piper() -> sherpa_onnx.OfflineTts:
    # sherpa-onnx >= 2.0 no longer ships espeak-ng; Piper needs phonemes from an external phonemizer.
    cfg = sherpa_onnx.OfflineTtsVitsModelConfig(
        model=str(PIPER / "sk_SK-lili-medium.onnx"),
        tokens=str(PIPER / "tokens.txt"),
    )
    return build(sherpa_onnx.OfflineTtsModelConfig(vits=cfg, num_threads=THREADS))


def piper_cfg(text: str) -> sherpa_onnx.GenerationConfig:
    from piper_phonemize import phonemize_espeak  # espeak-ng based, GPL-3.0

    g = gen_cfg(0)
    g.phoneme_codepoints = [[ord(c) for c in s] for s in phonemize_espeak(text, "sk")]
    return g


def build(model_cfg) -> sherpa_onnx.OfflineTts:
    cfg = sherpa_onnx.OfflineTtsConfig(model=model_cfg, max_num_sentences=1)
    if not cfg.validate():
        raise ValueError("invalid sherpa-onnx config")
    return sherpa_onnx.OfflineTts(cfg)


def median_f0(samples: np.ndarray, sr: int) -> float:
    """Rough speaker pitch from autocorrelation over voiced 40 ms frames; used only to label voices."""
    frame = int(0.04 * sr)
    lo, hi = int(sr / 400), int(sr / 70)
    f0s = []
    for i in range(0, len(samples) - frame, frame):
        x = samples[i : i + frame]
        if np.sqrt(np.mean(x**2)) < 0.02:
            continue
        x = x - x.mean()
        ac = np.correlate(x, x, "full")[frame - 1 :]
        lag = lo + int(np.argmax(ac[lo:hi]))
        if ac[lag] > 0.3 * ac[0]:
            f0s.append(sr / lag)
    return float(np.median(f0s)) if f0s else 0.0


def run(tts, name: str, model: str, voice: str, text_id: str, text: str, gen) -> dict:
    t0 = time.perf_counter()
    audio = tts.generate(text, gen)
    elapsed = time.perf_counter() - t0
    samples = np.asarray(audio.samples, dtype=np.float32)
    if samples.size == 0:
        raise RuntimeError(f"{name}: empty audio")
    dur = samples.size / audio.sample_rate
    sf.write(OUT / f"{name}.mp3", samples, audio.sample_rate, format="MP3")
    row = {
        "file": f"{name}.mp3",
        "model": model,
        "voice": voice,
        "text": text_id,
        "seconds_audio": round(dur, 2),
        "seconds_compute": round(elapsed, 2),
        "rtf": round(elapsed / dur, 3),
        "f0_hz": round(median_f0(samples, audio.sample_rate)),
    }
    results.append(row)
    print(f"{name:40s} audio {dur:6.1f}s  compute {elapsed:6.1f}s  RTF {row['rtf']:.3f}", flush=True)
    return row


def gen_cfg(sid: int, steps: int | None = None, lang: str | None = None) -> sherpa_onnx.GenerationConfig:
    g = sherpa_onnx.GenerationConfig()
    g.sid = sid
    g.speed = 1.0
    if steps is not None:
        g.num_steps = steps
    if lang is not None:
        g.extra["lang"] = lang
    return g


def main() -> None:
    load = {}

    # Supertonic 3: audition all 10 voices on one Slovak line, then use the clearest female and male.
    t0 = time.perf_counter()
    st = supertonic()
    load["supertonic"] = round(time.perf_counter() - t0, 2)
    gallery = [
        run(st, f"galeria_supertonic_sid{sid}", "supertonic3", f"sid{sid}", "galeria", GALLERY_SK, gen_cfg(sid, 8, "sk"))
        for sid in range(10)
    ]
    female = max(gallery, key=lambda r: r["f0_hz"])["voice"]
    male = min(gallery, key=lambda r: r["f0_hz"] or 999)["voice"]
    for text_id, (lang, text) in TEXTS.items():
        for voice in (female, male):
            sid = int(voice[3:])
            run(st, f"{text_id}_supertonic_{voice}", "supertonic3", voice, text_id, text, gen_cfg(sid, 8, lang))
    # More flow-matching steps: is the extra compute audible?
    sid = int(female[3:])
    run(st, f"sk_proza_supertonic_{female}_16krokov", "supertonic3-16steps", female, "sk_proza", TEXTS["sk_proza"][1], gen_cfg(sid, 16, "sk"))
    del st

    # Piper sk_SK lili (single voice).
    t0 = time.perf_counter()
    pp = piper()
    load["piper_sk"] = round(time.perf_counter() - t0, 2)
    for text_id in ("sk_proza", "sk_zradny"):
        try:
            run(pp, f"{text_id}_piper_lili", "piper-sk-lili", "lili", text_id, "", piper_cfg(TEXTS[text_id][1]))
        except Exception as e:  # noqa: BLE001 - phonemizer may be unavailable on this machine
            load["piper_sk"] = f"failed: {e}"
            print("piper:", e)
            break
    del pp

    # Kokoro v1.0: American female/male, British female.
    t0 = time.perf_counter()
    ku = kokoro("lexicon-us-en.txt", "en-us")
    load["kokoro"] = round(time.perf_counter() - t0, 2)
    for text_id in ("en_prose", "en_tricky"):
        for voice, sid in (("af_heart", 3), ("am_michael", 16)):
            run(ku, f"{text_id}_kokoro_{voice}", "kokoro-v1.0", voice, text_id, TEXTS[text_id][1], gen_cfg(sid))
    del ku
    kb = kokoro("lexicon-gb-en.txt", "en-gb")
    run(kb, "en_prose_kokoro_bf_emma", "kokoro-v1.0", "bf_emma", "en_prose", TEXTS["en_prose"][1], gen_cfg(21))
    del kb

    # GPL check: can Kokoro run on the lexicon alone, without espeak-ng data?
    try:
        kn = kokoro("lexicon-us-en.txt", "en-us", espeak=False)
        run(kn, "en_tricky_kokoro_af_heart_bez_espeak", "kokoro-v1.0-no-espeak", "af_heart", "en_tricky", TEXTS["en_tricky"][1], gen_cfg(3))
        load["kokoro_no_espeak"] = "ok"
    except Exception as e:  # noqa: BLE001 - record whatever the runtime says
        load["kokoro_no_espeak"] = f"failed: {e}"
        print("kokoro without espeak:", e)

    (OUT / "results.json").write_text(
        json.dumps({"threads": THREADS, "load_seconds": load, "female": female, "male": male, "rows": results}, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    print("load:", load)


if __name__ == "__main__":
    main()
