"""Glue: OCR text -> parsed packet -> banned / ok verdict."""
from __future__ import annotations

from .banned import BannedList
from .parser import parse_label

BANNED = BannedList()


def analyze(text: str) -> dict:
    packet = parse_label(text)
    hit = BANNED.find(text)
    return {
        "status": "banned" if hit else ("ok" if packet.dose else "no_dose"),
        "name": packet.name,
        "ingredient": packet.ingredient,
        "matched_ban": hit,
        "dose": packet.dose,
        "unit": packet.unit,
        "ocr_text": text,
        "banned_list_verified": BANNED.verified_on_ta,
    }
