import pytest

from app.banned import BannedList
from app.dose import calculate
from app.parser import parse_label

banned = BannedList()


# ---- banned list ----
@pytest.mark.parametrize(
    "text",
    [
        "SAFE-GROW 500ml Contains Chlorpyrifos 20% EC. Dose: 500 ml/acre",
        "பெயர்: கில்லர்-எக்ஸ். உள்ளடக்கம்: மோனோகுரோட்டோபாஸ் 36% SL",
        "CONTAINS CHLORPYRIFAS 20 EC",  # OCR typo, caught by fuzzy match
    ],
)
def test_banned_detected(text):
    assert banned.find(text)


@pytest.mark.parametrize(
    "text",
    [
        "PADDY-SHIELD Contains Tricyclazole 75% WP. Dose: 120 g/acre",
        "NEEM-PLUS Contains Azadirachtin 1500 ppm",
        "பெயர்: காட்டன்-கார்டு. உள்ளடக்கம்: இமிடாக்ளோபிரிட் 17.8% SL",
    ],
)
def test_safe_not_flagged(text):
    assert banned.find(text) is None


# ---- parser ----
def test_parse_tamil_label():
    p = parse_label("பெயர்: பேடி-ஷீல்ட் 500 கிராம். உள்ளடக்கம்: டிரைசைக்ளசோல் 75% WP. அளவு: 120 கிராம்/ஏக்கர்")
    assert p.name == "பேடி-ஷீல்ட்".upper()
    assert p.ingredient == "டிரைசைக்ளசோல் 75% WP"
    assert (p.dose, p.unit) == (120.0, "g")


def test_parse_english_label():
    p = parse_label("COTTON-GUARD 250ml Contains Imidacloprid 17.8% SL. Dose: 50 ml/acre")
    assert p.name == "COTTON-GUARD"
    assert (p.dose, p.unit) == (50.0, "ml")


def test_parse_no_dose():
    assert parse_label("NEEM-PLUS 1L").dose == 0


# ---- dose ----
def test_dose_maths():
    r = calculate(dose_per_acre=500, acres=5, tank_litres=10, water_per_acre=200)
    assert r == {"total": 2500.0, "per_tank": 25.0}


@pytest.mark.parametrize("bad", [0, -1])
def test_dose_rejects_non_positive(bad):
    with pytest.raises(ValueError):
        calculate(bad, 1, 10)
