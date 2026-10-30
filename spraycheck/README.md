# SprayCheck (ஸ்ப்ரே செக்)

Photograph a pesticide packet in Tamil Nadu and get, in Tamil text and voice:

1. whether the active ingredient is on the **banned list**,
2. if not, the **dose per tank** for your tank size and land area.

## How it works

```
packet photo ──► EasyOCR (Tamil + English) ──► label parser ──► banned-list check ──► dose calculator
                 pretrained neural OCR         regex rules      exact + fuzzy match   simple arithmetic
```

- **ML part:** text recognition uses [EasyOCR](https://github.com/JaidedAI/EasyOCR), a pretrained neural OCR model (CRAFT text detector + CRNN recognizer). No model is trained in this repo.
- **Rule part:** the banned verdict is a lookup in `data/banned_pesticides.json`, not a prediction. The dose is plain arithmetic from the dose printed on the label.
- OCR can misread a photo, so the app shows the recognised text and lets the user correct it and re-check.

> **Data warning:** `data/banned_pesticides.json` is **demo data**. Verify it against the official Tamil Nadu Gazette and CIB&RC notifications before anyone relies on it. Doses come only from the packet label; when in doubt, ask an agriculture officer.

## Project layout

```
app/
  main.py      FastAPI routes (/api/scan, /api/check-text, /api/dose, /api/health)
  ocr.py       EasyOCR wrapper
  parser.py    name / ingredient / dose extraction (Tamil + English labels)
  banned.py    banned-list lookup with fuzzy matching for OCR typos
  dose.py      dose maths
  service.py   ties the steps together
data/          banned_pesticides.json
static/        index.html, style.css, app.js (Tamil UI)
tests/         pytest unit tests
Dockerfile
```

## Run locally

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt     # EasyOCR pulls in PyTorch (large)
pytest                                  # unit tests
uvicorn app.main:app --reload           # open http://localhost:8000
```

The first photo scan downloads the OCR weights (~100 MB).

## API

| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/api/scan` | multipart `file` (image) | verdict + recognised text |
| POST | `/api/check-text` | `{"text": "..."}` | verdict (skips OCR) |
| POST | `/api/dose` | `{dose_per_acre, unit, acres, tank_litres, water_per_acre}` | `{total, per_tank, unit}` |
| GET | `/api/health` | | status + banned-list date |

Interactive docs: `/docs`.

## Deploy

GitHub only stores the code (and GitHub Pages can only serve static files), so the Python API needs a host that runs Docker:

1. Push this repo to GitHub.
2. Create a **Docker** web service from the repo on Render, Railway, Fly.io or Hugging Face Spaces (Docker SDK). It reads the `PORT` variable automatically.
3. Give it at least 2 GB RAM (PyTorch + OCR model).

The GitHub Actions workflow in `.github/workflows/ci.yml` runs the tests on every push.

## Limitations

- Accuracy depends on photo quality; curved or glossy packets can be misread.
- The banned list must be kept up to date by a person.
- Voice output uses the browser's Tamil voice, which not every phone has installed.
