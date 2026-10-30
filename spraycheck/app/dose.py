"""Dose arithmetic: label dose per acre -> total needed and amount per tank."""
from __future__ import annotations


def calculate(
    dose_per_acre: float,
    acres: float,
    tank_litres: float,
    water_per_acre: float = 200.0,
) -> dict:
    if min(dose_per_acre, acres, tank_litres, water_per_acre) <= 0:
        raise ValueError("all values must be greater than zero")
    total = dose_per_acre * acres
    per_tank = round(dose_per_acre * tank_litres / water_per_acre, 1)
    return {"total": round(total, 1), "per_tank": per_tank}
