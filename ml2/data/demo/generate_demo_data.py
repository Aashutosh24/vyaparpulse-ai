"""
Generates SYNTHETIC demo transactions and payments for two fictional
micro-merchants, for development and demonstration only.

Per architecture doc section 22, this must never be presented as real
observed data or as public retail data. It's neither -- it's synthetic,
generated deterministically (fixed seed) so results are reproducible
offline, per section 23.

Extended for Phase 2 (forecasting, architecture doc section 7/8): the
original 28-day version was sized for demonstrating the Phase 1 feature
engine, not for evaluating a forecaster. With a 7-day feature warm-up and
a 7-day-ahead target, 28 days leaves ~15 usable rows per merchant --
nowhere near enough to honestly compare a baseline against XGBoost, and
with no day-of-week pattern at all, "day of week" (an explicit input
feature per section 7) would be pure noise. This version runs 150 days
and adds real weekly seasonality plus a growth trend / recurring dips,
so a baseline-vs-XGBoost comparison has something genuine to find (or
genuinely not find) instead of the answer being predetermined either way
by data scarcity.

Run: python3 data/demo/generate_demo_data.py
Writes: data/demo/demo_transactions.json, data/demo/demo_payments.json
"""
from __future__ import annotations

import json
import random
from datetime import datetime, timedelta
from pathlib import Path

random.seed(42)  # reproducibility (section 23)

OUT_DIR = Path(__file__).resolve().parent
START_DATE = datetime(2026, 4, 1, 8, 0, 0)
NUM_DAYS = 150

MERCHANTS = {
    "M001": {  # commuter tea stall: busy weekdays, quiet Sunday, mild organic growth
        "products": [("chai", 15), ("samosa", 20), ("biscuit", 10)],
        "daily_tx_range": (8, 18),
        "hour_weights": {8: 3, 9: 4, 10: 2, 13: 3, 17: 4, 18: 5, 19: 3, 20: 2},
        "pay_delay_days": (0, 1),
        "pay_full_prob": 0.9,
        # Mon..Sun (weekday(): 0=Mon .. 6=Sun)
        "weekday_multiplier": {0: 1.1, 1: 1.1, 2: 1.1, 3: 1.1, 4: 1.15, 5: 0.7, 6: 0.4},
        "growth_per_day": 0.0025,  # ~1.4x busier by day 150 than day 0
        "dip_periods": [],
    },
    "M002": {  # weekend-heavy kirana store, some slow payers, recurring restock dips
        "products": [],
        "daily_tx_range": (4, 10),
        "hour_weights": {9: 2, 11: 3, 14: 2, 16: 3, 19: 4, 21: 2},
        "pay_delay_days": (0, 5),
        "pay_full_prob": 0.6,
        "weekday_multiplier": {0: 0.8, 1: 0.8, 2: 0.85, 3: 0.85, 4: 1.1, 5: 1.3, 6: 1.25},
        "growth_per_day": 0.0,
        "dip_periods": [(14, 19), (42, 47), (70, 75), (98, 103), (126, 131)],  # ~every 4 weeks
    },
}


def _weighted_hour(weights: dict) -> int:
    hours, w = zip(*weights.items())
    return random.choices(hours, weights=w, k=1)[0]


def _in_dip(day_offset: int, dip_periods: list[tuple[int, int]]) -> bool:
    return any(start <= day_offset < end for start, end in dip_periods)


def generate() -> tuple[list[dict], list[dict]]:
    transactions, payments = [], []
    tx_counter, pay_counter = 1, 1

    for merchant_id, cfg in MERCHANTS.items():
        for day_offset in range(NUM_DAYS):
            day = START_DATE + timedelta(days=day_offset)

            base_n_tx = random.randint(*cfg["daily_tx_range"])
            weekday_mult = cfg["weekday_multiplier"][day.weekday()]
            growth_mult = 1.0 + cfg["growth_per_day"] * day_offset
            dip_mult = 0.35 if _in_dip(day_offset, cfg["dip_periods"]) else 1.0

            n_tx = max(0, round(base_n_tx * weekday_mult * growth_mult * dip_mult))

            for _ in range(n_tx):
                hour = _weighted_hour(cfg["hour_weights"])
                ts = day.replace(hour=hour, minute=random.randint(0, 59))
                tx_id = f"tx_{tx_counter:04d}"
                tx_counter += 1

                items = []
                amount = 0
                if cfg["products"]:
                    n_items = random.randint(1, 3)
                    for prod, price in random.sample(cfg["products"], k=min(n_items, len(cfg["products"]))):
                        qty = random.randint(1, 4)
                        items.append({"product": prod, "quantity": qty, "unit_price": price})
                        amount += qty * price
                else:
                    amount = random.randint(40, 600)

                transactions.append({
                    "transaction_id": tx_id,
                    "merchant_id": merchant_id,
                    "timestamp": ts.isoformat(),
                    "customer": random.choice(["Rahul", "Priya", "Amit", None, None]),
                    "items": items,
                    "amount": amount,
                    "confidence": round(random.uniform(0.82, 0.99), 2),
                })

                # payment behaviour
                if random.random() < cfg["pay_full_prob"]:
                    delay = random.randint(*cfg["pay_delay_days"])
                    pay_ts = ts + timedelta(days=delay, hours=random.randint(0, 5))
                    payments.append({
                        "payment_id": f"pay_{pay_counter:04d}",
                        "transaction_id": tx_id,
                        "merchant_id": merchant_id,
                        "timestamp": pay_ts.isoformat(),
                        "amount_paid": amount,
                        "method": random.choice(["cash", "upi", "card"]),
                        "status": "paid",
                    })
                    pay_counter += 1
                elif random.random() < 0.5:
                    delay = random.randint(*cfg["pay_delay_days"])
                    pay_ts = ts + timedelta(days=delay, hours=random.randint(0, 5))
                    partial = round(amount * random.uniform(0.3, 0.7))
                    payments.append({
                        "payment_id": f"pay_{pay_counter:04d}",
                        "transaction_id": tx_id,
                        "merchant_id": merchant_id,
                        "timestamp": pay_ts.isoformat(),
                        "amount_paid": partial,
                        "method": random.choice(["cash", "upi"]),
                        "status": "partial",
                    })
                    pay_counter += 1
                # else: no payment at all yet (fully outstanding)

    return transactions, payments


if __name__ == "__main__":
    tx, pay = generate()
    (OUT_DIR / "demo_transactions.json").write_text(json.dumps(tx, indent=2))
    (OUT_DIR / "demo_payments.json").write_text(json.dumps(pay, indent=2))
    print(f"wrote {len(tx)} transactions, {len(pay)} payments -> {OUT_DIR}")
