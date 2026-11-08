"""Phase 1 chapter test texts (not committed; see SOURCES.md).

- sk_kukucin:  Slovak Wikipedia, "Martin Kukučín" (CC BY-SA 4.0), plain-text extract.
- sk_tatry:    Slovak Wikipedia, "Vysoké Tatry (pohorie)" (CC BY-SA 4.0), plain-text extract.
- en_holmes:   Project Gutenberg #1661, The Adventures of Sherlock Holmes (public domain), start of chapter I.
- en_tatras:   English Wikipedia, "High Tatras" (CC BY-SA 4.0), plain-text extract.
Each text is cut to roughly the given number of words at a paragraph boundary.
"""
import json
import re
import ssl
import urllib.parse
import urllib.request
from pathlib import Path

import certifi

HERE = Path(__file__).parent
OUT = HERE / "texts"
OUT.mkdir(exist_ok=True)
UA = {"User-Agent": "audiokniha-test/0.1 (personal research; contact via GitHub)"}


CTX = ssl.create_default_context(cafile=certifi.where())


def get(url: str) -> str:
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60, context=CTX) as r:
        return r.read().decode("utf-8")


def wiki(lang: str, title: str) -> str:
    q = urllib.parse.urlencode({"action": "query", "prop": "extracts", "explaintext": 1, "titles": title, "format": "json", "redirects": 1})
    pages = json.loads(get(f"https://{lang}.wikipedia.org/w/api.php?{q}"))["query"]["pages"]
    text = next(iter(pages.values()))["extract"]
    # Section headings become their own short paragraphs; drop reference-like sections.
    text = re.split(r"\n=+ (?:Referencie|Literatúra|Externé odkazy|Pozri aj|Iné projekty|References|See also|External links|Further reading|Notes)[^\n]*=+", text)[0]
    text = re.sub(r"\n=+ ([^=\n]+?) =+", r"\n\n\1", text)
    return text


def cut(text: str, words: int) -> str:
    out, n = [], 0
    for p in [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]:
        out.append(p)
        n += len(p.split())
        if n >= words:
            break
    return "\n\n".join(out)


def holmes() -> str:
    raw = get("https://www.gutenberg.org/cache/epub/1661/pg1661.txt")
    start = raw.index("To Sherlock Holmes she is always")
    body = raw[start:]
    paras = [re.sub(r"\s*\n\s*", " ", p).strip() for p in re.split(r"\r?\n\s*\r?\n", body)]
    return "I. A SCANDAL IN BOHEMIA\n\nI.\n\n" + "\n\n".join(p for p in paras if p)


TEXTS = {
    "sk_kukucin": lambda: cut(wiki("sk", "Martin Kukučín"), 1100),
    "sk_tatry": lambda: cut(wiki("sk", "Vysoké Tatry (pohorie)"), 1100),
    "en_holmes": lambda: cut(holmes(), 1300),
    "en_tatras": lambda: cut(wiki("en", "High Tatras"), 900),
}

for name, fn in TEXTS.items():
    t = fn()
    (OUT / f"{name}.txt").write_text(t, encoding="utf-8")
    print(f"{name}: {len(t.split())} words, {t.count(chr(10) * 2) + 1} paragraphs | {t[:90]!r}")
