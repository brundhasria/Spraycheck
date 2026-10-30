"""Text recognition with EasyOCR (pretrained neural OCR, Tamil + English).

The model is loaded lazily on the first request (the first call downloads weights).
"""
from __future__ import annotations

import io
from functools import lru_cache

MAX_SIDE = 1600  # downscale big phone photos for speed


@lru_cache(maxsize=1)
def _reader():
    import easyocr

    return easyocr.Reader(["ta", "en"], gpu=False)


def read_text(image_bytes: bytes) -> str:
    import numpy as np
    from PIL import Image

    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    img.thumbnail((MAX_SIDE, MAX_SIDE))
    lines = _reader().readtext(np.array(img), detail=0, paragraph=True)
    return " ".join(lines)
