"""Banned-pesticide lookup (exact + light fuzzy matching for OCR typos)."""
from __future__ import annotations

import json
from difflib import SequenceMatcher
from pathlib import Path
from typing import Optional

DATA_FILE = Path(__file__).resolve().parent.parent / "data" / "banned_pesticides.json"

# Fuzzy matching only for long names; short names (e.g. "phorate") must match exactly
# so that we do not raise false alarms on unrelated words.
FUZZY_MIN_LEN = 8
FUZZY_THRESHOLD = 0.88


class BannedList:
    def __init__(self, path: Path = DATA_FILE):
        raw = json.loads(Path(path).read_text(encoding="utf-8"))
        self.verified_on: str = raw["verified_on"]
        self.verified_on_ta: str = raw["verified_on_ta"]
        self.names: list[str] = []
        for p in raw["pesticides"]:
            self.names.append(p["en"].lower())
            self.names.append(p["ta"])

    def find(self, text: str) -> Optional[str]:
        """Return the banned name found in `text`, or None."""
        low = " ".join(text.lower().split())
        for name in self.names:
            if name in low:
                return name
        words = low.split()
        for name in self.names:
            if len(name) < FUZZY_MIN_LEN:
                continue
            n = len(name.split())
            for i in range(len(words) - n + 1):
                cand = " ".join(words[i : i + n])
                if SequenceMatcher(None, name, cand).ratio() >= FUZZY_THRESHOLD:
                    return name
        return None
