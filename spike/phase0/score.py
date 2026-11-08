"""Phase 0: score the Whisper transcripts (asr.json, asr_web.json) three ways.

wer      - plain word error rate on lowercased words.
wer_snd  - Slovak only: compares how words sound, not how they are spelled (y=i, voicing pairs merged),
           because Whisper writes homophones like "vysela" for "visela" that a listener cannot tell apart.
cer      - character error rate on the same sound-normalized text; less harsh on one-letter slips.
Writes scores.json.
"""
import json
import re
import unicodedata
from pathlib import Path

from texts import GALLERY_SK, TEXTS

HERE = Path(__file__).parent
S = HERE / "samples"

WEB_REF = {
    "sk": "Keď Jana vystúpila z vlaku, mesto ešte spalo. Nad strechami visela riedka hmla a z pekárne na rohu voňal čerstvý chlieb. Zastala pri starej lipe, kde sa kedysi stretávala s otcom, a chvíľu len počúvala, ako sa ulica pomaly prebúdza.",
    "en": "The rain had stopped by the time Clara reached the old lighthouse. She paused at the door, listening to the waves breaking somewhere below, and for a moment she wondered whether coming back had been a mistake.",
}

SK_SOUND = str.maketrans({"y": "i", "ý": "í", "d": "t", "z": "s", "ž": "š", "b": "p", "v": "f", "g": "k", "h": "x", "ä": "e"})


def tokens(s: str, lang: str, sound: bool) -> list[str]:
    s = unicodedata.normalize("NFC", s.lower())
    words = re.findall(r"[^\W_]+", s)
    if sound and lang == "sk":
        words = [w.replace("ch", "x").translate(SK_SOUND) for w in words]
    return words


def edit(a: list, b: list) -> int:
    d = list(range(len(b) + 1))
    for i, x in enumerate(a, 1):
        prev, d[0] = d[0], i
        for j, y in enumerate(b, 1):
            prev, d[j] = d[j], min(d[j] + 1, d[j - 1] + 1, prev + (x != y))
    return d[len(b)]


def score(ref: str, hyp: str, lang: str) -> dict:
    r, h = tokens(ref, lang, False), tokens(hyp, lang, False)
    rs, hs = tokens(ref, lang, True), tokens(hyp, lang, True)
    rc, hc = list(" ".join(rs)), list(" ".join(hs))
    return {
        "wer": round(edit(r, h) / max(len(r), 1), 3),
        "wer_snd": round(edit(rs, hs) / max(len(rs), 1), 3),
        "cer": round(edit(rc, hc) / max(len(rc), 1), 3),
    }


def main() -> None:
    out = {}
    for row in json.loads((S / "asr.json").read_text(encoding="utf-8")):
        lang, ref = ("sk", GALLERY_SK) if row["text"] == "galeria" else TEXTS[row["text"]]
        out[row["file"]] = {**score(ref, row["transcript"], lang), "lang": lang, "transcript": row["transcript"]}
    if (S / "asr_web.json").exists():
        for row in json.loads((S / "asr_web.json").read_text(encoding="utf-8")):
            lang = row["file"].rsplit("_", 1)[1][:2]
            out[row["file"]] = {**score(WEB_REF[lang], row["transcript"], lang), "lang": lang, "transcript": row["transcript"]}
    (S / "scores.json").write_text(json.dumps(out, indent=2, ensure_ascii=False), encoding="utf-8")
    for f, v in out.items():
        print(f"{f:42s} WER {v['wer']:.3f}  zvuk-WER {v['wer_snd']:.3f}  CER {v['cer']:.3f}")


if __name__ == "__main__":
    main()
