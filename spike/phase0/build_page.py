"""Phase 0: build the listening page (samples/index.html) from results.json, asr.json and asr_web.json."""
import html
import json
from pathlib import Path

from texts import GALLERY_SK, TEXTS

HERE = Path(__file__).parent
S = HERE / "samples"
res = json.loads((S / "results.json").read_text(encoding="utf-8"))
scores = json.loads((S / "scores.json").read_text(encoding="utf-8"))
e = html.escape

MODEL_NAMES = {
    "supertonic3": "Supertonic 3",
    "supertonic3-16steps": "Supertonic 3 · 16 krokov",
    "piper-sk-lili": "Piper sk · lili",
    "kokoro-v1.0": "Kokoro v1.0",
    "kokoro-v1.0-no-espeak": "Kokoro v1.0 bez espeak",
}
VOICE_NAMES = {"sid3": "hlas 3 · ženský", "sid6": "hlas 6 · mužský"}
TEXT_TITLES = {
    "sk_proza": "Slovenská próza",
    "sk_zradny": "Slovenský text s číslami a skratkami",
    "en_prose": "Anglická próza",
    "en_tricky": "Anglický text s číslami a skratkami",
}

# Browser numbers measured in bench.html on this PC (Chromium, GTX 1050 Ti, 8 threads).
SPEED = [
    ("Supertonic 3", "Prehliadač, WebGPU (GTX 1050 Ti), fp32, 380 MB", 0.075, True),
    ("Supertonic 3", "Prehliadač, WebGPU (GTX 1050 Ti), int8, 145 MB", 0.21, False),
    ("Supertonic 3", "Procesor tohto PC (i3), natívne, int8", 0.29, True),
    ("Supertonic 3", "Prehliadač bez GPU (WASM, 8 vlákien)", 1.0, False),
    ("Piper sk", "Procesor tohto PC, natívne", 0.063, False),
    ("Kokoro v1.0", "Procesor tohto PC, natívne, int8", 1.7, False),
]


def book_hour(rtf: float) -> str:
    m = rtf * 60
    return f"{m:.0f} min" if m < 90 else f"{m / 60:.1f} h"


def player(file: str) -> str:
    return f'<audio controls preload="none" src="{e(file)}"></audio>'


def wer_chip(sc: dict | None) -> str:
    # Slovak is scored by sound (wer_snd) so Whisper's spelling of homophones does not count as an error.
    if not sc:
        return '<span class="chip">bez prepisu</span>'
    w = sc["wer_snd"] if sc["lang"] == "sk" else sc["wer"]
    cls = "ok" if w <= 0.05 else "warn" if w <= 0.15 else "bad"
    return f'<span class="chip {cls}">{w * 100:.0f} % slov inak</span>'


def score_note(sc: dict | None) -> str:
    if not sc:
        return ""
    if sc["lang"] == "sk":
        return f'<p class="note">Podľa zvuku {sc["wer_snd"] * 100:.0f} % slov inak · podľa pravopisu {sc["wer"] * 100:.0f} % · znaky {sc["cer"] * 100:.0f} %</p>'
    return f'<p class="note">{sc["wer"] * 100:.0f} % slov inak · znaky {sc["cer"] * 100:.0f} %</p>'


rows_by_text: dict[str, list[dict]] = {}
for r in res["rows"]:
    rows_by_text.setdefault(r["text"], []).append(r)

sections = []
for text_id, title in TEXT_TITLES.items():
    lang, ref = TEXTS[text_id]
    items = []
    for r in rows_by_text.get(text_id, []):
        sc = scores.get(r["file"])
        voice = VOICE_NAMES.get(r["voice"], r["voice"])
        items.append(
            f"""<li class="take">
  <div class="take-head"><strong>{e(MODEL_NAMES.get(r['model'], r['model']))}</strong><span class="voice">{e(voice)}</span>{wer_chip(sc)}</div>
  {player(r['file'])}
  <details><summary>Čo počul Whisper</summary><p class="transcript">{e(sc['transcript'] if sc else '—')}</p>{score_note(sc)}</details>
</li>"""
        )
    sections.append(
        f"""<section class="text-block" id="{text_id}">
  <h3>{e(title)}</h3>
  <blockquote lang="{lang}">{e(ref)}</blockquote>
  <ul class="takes">{''.join(items)}</ul>
</section>"""
    )

gallery = []
for r in rows_by_text.get("galeria", []):
    sid = int(r["voice"][3:])
    gallery.append(
        f'<li><div class="take-head"><strong>Hlas {sid}</strong><span class="voice">{"ženský" if r["f0_hz"] > 150 else "mužský"} · {r["f0_hz"]} Hz</span></div>{player(r["file"])}</li>'
    )

web_items = "".join(
    f'<li class="take"><div class="take-head"><strong>{"Slovensky" if sc["lang"] == "sk" else "Anglicky"} · WebGPU v prehliadači</strong><span class="voice">štýl F1</span>{wer_chip(sc)}</div>{player(f)}'
    f'<details><summary>Čo počul Whisper</summary><p class="transcript">{e(sc["transcript"])}</p>{score_note(sc)}</details></li>'
    for f, sc in scores.items()
    if f.startswith("web/")
)

speed_rows = "".join(
    f'<tr class="{"pick" if pick else ""}"><td>{e(m)}</td><td>{e(env)}</td><td class="num">{rtf:.2f}</td><td class="num">{book_hour(rtf)}</td></tr>'
    for m, env, rtf, pick in SPEED
)

page = f"""<title>Skúška hlasov</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Literata:opsz,wght@7..72,500;7..72,700&family=Atkinson+Hyperlegible:wght@400;700&display=swap">
<style>
/* Layout: one reading column, a speed table, then listening blocks per passage; a lab report about book voices. */
:root {{
  --paper: #f4f5f2; --ink: #1d2327; --muted: #5d676d; --rule: #d5dad6; --card: #ffffff;
  --accent: #2f5d62; --ok: #2e7d4f; --warn: #a86b12; --bad: #b3372e;
  --display: "Literata", Georgia, "Times New Roman", serif;
  --body: "Atkinson Hyperlegible", "Segoe UI", system-ui, sans-serif;
}}
@media (prefers-color-scheme: dark) {{ :root:not([data-theme="light"]) {{
  --paper: #14181a; --ink: #e6ebe8; --muted: #9aa5a8; --rule: #2c3437; --card: #1b2023;
  --accent: #7fb5b8; --ok: #6cc28f; --warn: #e0a64a; --bad: #ec7d72; color-scheme: dark; }} }}
:root[data-theme="dark"] {{
  --paper: #14181a; --ink: #e6ebe8; --muted: #9aa5a8; --rule: #2c3437; --card: #1b2023;
  --accent: #7fb5b8; --ok: #6cc28f; --warn: #e0a64a; --bad: #ec7d72; color-scheme: dark; }}
body {{ background: var(--paper); color: var(--ink); font: 16px/1.6 var(--body);
  padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }}
main {{ max-width: 760px; margin: 0 auto; padding-block: 40px 64px; display: grid; gap: 40px; }}
h1, h2, h3 {{ font-family: var(--display); line-height: 1.2; text-wrap: balance; margin: 0; }}
h1 {{ font-size: clamp(2rem, 6vw, 2.8rem); }}
h2 {{ font-size: 1.5rem; }}
h3 {{ font-size: 1.15rem; }}
p {{ margin: 0; max-width: 65ch; }}
header {{ display: grid; gap: 12px; }}
.lede {{ font-size: 1.1rem; color: var(--muted); }}
section {{ display: grid; gap: 16px; }}
.verdict {{ background: var(--card); border: 1px solid var(--rule); border-left: 4px solid var(--accent); padding: 18px 20px; display: grid; gap: 10px; }}
.verdict ul {{ margin: 0; padding-left: 20px; display: grid; gap: 6px; }}
.table-wrap {{ overflow-x: auto; }}
table {{ border-collapse: collapse; width: 100%; font-variant-numeric: tabular-nums; }}
th, td {{ text-align: left; padding: 8px 10px; border-bottom: 1px solid var(--rule); vertical-align: top; }}
th {{ font-size: .8rem; letter-spacing: .04em; text-transform: uppercase; color: var(--muted); font-weight: 700; }}
td.num {{ text-align: right; white-space: nowrap; }}
tr.pick td {{ font-weight: 700; }}
tr.pick td:first-child {{ box-shadow: inset 3px 0 0 var(--accent); }}
.note {{ font-size: .9rem; color: var(--muted); }}
blockquote {{ margin: 0; padding: 12px 16px; border-left: 2px solid var(--rule); color: var(--muted); font-family: var(--display); font-size: .98rem; }}
.takes, .gallery {{ list-style: none; margin: 0; padding: 0; display: grid; gap: 12px; }}
.gallery {{ grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); }}
.take, .gallery li {{ background: var(--card); border: 1px solid var(--rule); padding: 12px 14px; display: grid; gap: 8px; min-width: 0; }}
.take-head {{ display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px 12px; }}
.voice {{ color: var(--muted); font-size: .92rem; }}
.chip {{ margin-left: auto; font-size: .8rem; font-weight: 700; padding: 2px 8px; border: 1px solid currentColor; color: var(--muted); }}
.chip.ok {{ color: var(--ok); }} .chip.warn {{ color: var(--warn); }} .chip.bad {{ color: var(--bad); }}
audio {{ width: 100%; height: 40px; }}
details summary {{ cursor: pointer; color: var(--accent); font-size: .92rem; }}
details summary:focus-visible, audio:focus-visible {{ outline: 2px solid var(--accent); outline-offset: 2px; }}
.transcript {{ font-size: .95rem; padding-top: 6px; }}
.findings {{ margin: 0; padding-left: 20px; display: grid; gap: 10px; }}
</style>
<main>
<header>
  <h1>Skúška hlasov</h1>
  <p class="lede">Fáza 0 appky PDF → audiokniha. Rovnaké texty som nechal prečítať modely, ktoré bežia priamo v zariadení, bez cloudu. Rýchlosť je meraná na tvojom PC (i3-10105F, GTX 1050 Ti). Presnosť meria Whisper: prepíše nahrávku a porovná ju s pôvodným textom.</p>
</header>

<section class="verdict" aria-labelledby="v">
  <h2 id="v">Čo je overené a čo rozhodne tvoj posluch</h2>
  <ul>
    <li><strong>Overené:</strong> Supertonic 3 číta slovenčinu aj angličtinu jedným modelom, bez GPL kódu a bez cloudu. V prehliadači s WebGPU vyrobí hodinu knihy asi za 4,5 minúty, na procesore tohto PC za ~20 minút.</li>
    <li><strong>Zrozumiteľnosť:</strong> v slovenskej próze Whisper počul podľa zvuku 8–10 % slov inak (Piper 12 %). Pri anglickej próze to bolo 0 %. Časť z toho sú chyby Whispera, nie hlasu.</li>
    <li><strong>Na čo sa pri počúvaní sústrediť:</strong> mužský hlas 6 občas zopakuje slovo alebo vetu („hmla-hmla“, dvakrát „Jana si povzdychla“) a niekde skráti dlhú samohlásku („prebudza“). V dlhej knihe by to rušilo.</li>
    <li><strong>Čísla a symboly</strong> (°C, €, t. j., napr.) nečíta správne žiadny model. Treba ich pred čítaním prepísať na slová, čo je prvá úloha fázy 1.</li>
    <li><strong>Kokoro</strong> v prozaickom texte znie dobre, ale bez GPL fonemizéra vynecháva čísla aj mená (aj „Clara“) a na procesore je pomalší ako reálny čas.</li>
  </ul>
  <p class="note">Môj návrh je Supertonic 3 pre oba jazyky. Či znie dosť dobre na celé knihy, rozhodni podľa ukážok nižšie.</p>
</section>

<section aria-labelledby="speed">
  <h2 id="speed">Rýchlosť</h2>
  <p>RTF je čas výpočtu delený dĺžkou zvuku. Menej je lepšie: 0,1 znamená 10× rýchlejšie, ako sa to počúva.</p>
  <p class="note">Merané len na tomto PC. iPhone, notebooky s integrovanou grafikou a Safari na mobile zatiaľ netestované, rovnako ani dlhé generovanie, pri ktorom sa môže prejaviť prehrievanie.</p>
  <div class="table-wrap"><table>
    <thead><tr><th>Model</th><th>Kde beží</th><th>RTF</th><th>Hodina knihy</th></tr></thead>
    <tbody>{speed_rows}</tbody>
  </table></div>
</section>

<section aria-labelledby="listen">
  <h2 id="listen">Ukážky</h2>
  <p class="note">Supertonic: ženský hlas 3 a mužský hlas 6 (pohlavie som odhadol z výšky hlasu). Kokoro: af_heart, am_michael a bf_emma. Pri slovenčine počítam rozdiely podľa zvuku, takže „vysela“ namiesto „visela“ sa nepočíta ako chyba.</p>
</section>
{''.join(sections)}

<section aria-labelledby="fix">
  <h2 id="fix">Pred a po úprave</h2>
  <p>Rovnaký zradný text, mužský hlas 6. „Pred“ je text tak, ako je v knihe, generovaný naraz. „Po“ má čísla, symboly a skratky prepísané na slová a každú vetu generovanú zvlášť.</p>
  <ul class="takes">
    <li class="take"><div class="take-head"><strong>Slovensky, pred úpravou</strong><span class="voice">opakuje vetu, nečíta °C ani €</span></div>{player("sk_zradny_supertonic_sid6.mp3")}</li>
    <li class="take"><div class="take-head"><strong>Slovensky, po úprave</strong><span class="voice">bez opakovaní, čísla čítané</span></div>{player("fixes/sk_norm_v6_t1.mp3")}</li>
    <li class="take"><div class="take-head"><strong>Slovensky, po úprave, ženský hlas 3</strong></div>{player("fixes/sk_norm_v3_t1.mp3")}</li>
    <li class="take"><div class="take-head"><strong>Anglicky, pred úpravou</strong><span class="voice">„two to fifty followers“</span></div>{player("en_tricky_supertonic_sid6.mp3")}</li>
    <li class="take"><div class="take-head"><strong>Anglicky, po úprave</strong><span class="voice">Whisper počul presne $1,250.75</span></div>{player("fixes/en_norm_v6_t1.mp3")}</li>
  </ul>
</section>

<section aria-labelledby="web">
  <h2 id="web">Supertonic v prehliadači</h2>
  <p>Toto vygenerovala testovacia stránka priamo v Chromiu cez WebGPU. Je to ten istý model v inom runtime, s hlasovým štýlom F1 a kratším textom, preto čísla nie sú priamo porovnateľné s ukážkami vyššie.</p>
  <ul class="takes">{web_items}</ul>
</section>

<section aria-labelledby="gal">
  <h2 id="gal">Všetkých 10 hlasov Supertonicu</h2>
  <blockquote lang="sk">{e(GALLERY_SK)}</blockquote>
  <ul class="gallery">{''.join(gallery)}</ul>
</section>

<section aria-labelledby="find">
  <h2 id="find">Čo z toho plynie pre ďalšie fázy</h2>
  <ul class="findings">
    <li><strong>Licencia Supertonicu</strong> (BigScience OpenRAIL-M) povoľuje šírenie v appke aj na webe. Používateľ však nesmie zverejniť generovaný obsah bez označenia. Appka preto pridá upozornenie a export zapíše do metadát „hlas generovaný AI“.</li>
    <li><strong>sherpa-onnx 2.0</strong> už neobsahuje espeak-ng. Supertonic fonemizér nepotrebuje, takže iOS build ostane bez GPL.</li>
    <li><strong>Web:</strong> fp32 cez WebGPU je najrýchlejší, ale stiahne sa 380 MB. Overíme verziu fp16 (asi 190 MB). Bez WebGPU beží WASM zhruba v reálnom čase, čo stačí na počúvanie počas generovania.</li>
    <li><strong>iOS:</strong> generovať sa dá, kým hrá zvuk. <code>BGContinuedProcessingTask</code> (iOS 26) existuje, ale podľa vývojárov sa pri zamknutom telefóne zastavuje. Celá kniha sa teda generuje pri otvorenej appke alebo počas počúvania.</li>
  </ul>
</section>
</main>
"""

(S / "index.html").write_text(page, encoding="utf-8")
print("wrote", S / "index.html")
