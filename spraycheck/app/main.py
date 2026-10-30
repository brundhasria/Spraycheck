"""FastAPI app: JSON API + static frontend."""
from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from . import __version__
from .dose import calculate
from .service import BANNED, analyze

MAX_UPLOAD = 10 * 1024 * 1024  # 10 MB
STATIC_DIR = Path(__file__).resolve().parent.parent / "static"

app = FastAPI(title="SprayCheck", version=__version__)


class TextIn(BaseModel):
    text: str = Field(min_length=1, max_length=5000)


class DoseIn(BaseModel):
    dose_per_acre: float = Field(gt=0)
    unit: str = Field(pattern="^(ml|g)$")
    acres: float = Field(gt=0)
    tank_litres: float = Field(gt=0)
    water_per_acre: float = Field(default=200, gt=0)


@app.get("/api/health")
def health():
    return {"status": "ok", "version": __version__, "banned_list_verified": BANNED.verified_on_ta}


@app.post("/api/scan")
async def scan(file: UploadFile = File(...)):
    """Packet photo -> OCR -> verdict."""
    data = await file.read()
    if not data:
        raise HTTPException(400, "காலி கோப்பு")
    if len(data) > MAX_UPLOAD:
        raise HTTPException(413, "படம் மிகப் பெரியது (அதிகபட்சம் 10 MB)")
    from .ocr import read_text  # heavy import, load on demand

    try:
        text = read_text(data)
    except Exception as exc:  # unreadable image
        raise HTTPException(422, "படத்தைப் படிக்க முடியவில்லை") from exc
    if not text.strip():
        raise HTTPException(422, "படத்தில் எழுத்து எதுவும் கண்டறியப்படவில்லை")
    return analyze(text)


@app.post("/api/check-text")
def check_text(body: TextIn):
    """Skip OCR: check label text typed/corrected by the user."""
    return analyze(body.text)


@app.post("/api/dose")
def dose(body: DoseIn):
    result = calculate(body.dose_per_acre, body.acres, body.tank_litres, body.water_per_acre)
    return {**result, "unit": body.unit}


# Must be last: serves the frontend at "/"
app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")
