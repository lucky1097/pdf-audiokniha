"""Regenerate num2words-sk-cardinals.json, the oracle for Slovak cardinals (needs `pip install num2words`)."""
import json
from pathlib import Path

from num2words import num2words

nums = list(range(0, 131)) + [
    150, 199, 200, 222, 300, 345, 400, 500, 612, 999, 1000, 1001, 1100, 1250, 1848, 1918, 1984, 1999,
    2000, 2001, 2019, 2024, 2100, 3000, 4500, 5000, 10000, 12500, 21000, 99999, 100000, 250000,
    1000000, 2000000, 2500000, 5000000, 1000000000, 3000000000,
]
data = {str(k): num2words(k, lang="sk") for k in nums}
out = Path(__file__).with_name("num2words-sk-cardinals.json")
out.write_text(json.dumps(data, ensure_ascii=False, indent=0), encoding="utf-8")
print(len(data), data["2024"], data["2500000"], data["1001"], data["1000000000"])
