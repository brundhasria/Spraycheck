"""Extract name / ingredient / dose-per-acre from OCR text (Tamil or English labels)."""
from __future__ import annotations

import re
from dataclasses import dataclass

UNKNOWN_NAME = "தெரியவில்லை"

_NAME_TA = re.compile(r"பெயர்:\s*(.+?)(?=\s+\d|\.|,|$)")
_NAME_EN = re.compile(r"^\s*([A-Za-z][\w\- ]{1,20}?)(?=\s+\d|\s+contains|\.|,|$)", re.I)
_ING_TA = re.compile(r"உள்ளடக்கம்:\s*(.+?)(?=\.\s*அளவு|$)")
_ING_EN = re.compile(
    r"contains\s+([A-Za-z ]+?\s*\d*\.?\d*\s*(?:%|ppm)?\s*[A-Z]{0,3})(?=[.,]|\s+dose|$)", re.I
)
_DOSE_TA = re.compile(r"(\d+(?:\.\d+)?)\s*(மி\.?\s?லி|கிராம்|கி\.?)\s*/\s*ஏக்கர்")
_DOSE_EN = re.compile(r"(\d+(?:\.\d+)?)\s*(ml|gms?|g)\s*(?:/|per)\s*acre", re.I)


@dataclass
class Packet:
    name: str
    ingredient: str
    dose: float  # per acre, 0 when not found
    unit: str  # "ml" or "g"


def _first(patterns, text: str) -> str:
    for p in patterns:
        m = p.search(text)
        if m:
            return m.group(1).strip()
    return ""


def parse_label(text: str) -> Packet:
    text = " ".join(text.split())
    name = _first([_NAME_TA, _NAME_EN], text) or UNKNOWN_NAME
    ingredient = _first([_ING_TA, _ING_EN], text)

    dose, unit = 0.0, "ml"
    m = _DOSE_TA.search(text)
    if m:
        dose = float(m.group(1))
        unit = "ml" if m.group(2).startswith("மி") else "g"
    else:
        m = _DOSE_EN.search(text)
        if m:
            dose = float(m.group(1))
            unit = "ml" if m.group(2).lower() == "ml" else "g"

    return Packet(name=name.upper(), ingredient=ingredient, dose=dose, unit=unit)
