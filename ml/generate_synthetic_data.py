"""
Generise sinteticki dataset "laznih" zaposlenih za trening burnout/anomaly modela.

Pokretanje:
    python generate_synthetic_data.py
    python generate_synthetic_data.py --n 500 --seed 42

Izlaz:
    data/synthetic_dataset.csv  (kolone: employee_id, 8 feature-a, label)
"""

import argparse
import os
import random

import numpy as np
import pandas as pd

# --- konstante (moraju odgovarati ml/FEATURES.md) ---
RECENT_DAYS = 15
BASELINE_DAYS = 30
TOTAL_WORKDAYS = RECENT_DAYS + BASELINE_DAYS

AT_RISK_PREVALENCE = 0.20  # ~20% sintetickih zaposlenih je "at risk"

# distribucija za NORMALNO ponasanje (isto kao u seedAttendance.js)
P_ON_TIME = 0.85
P_LATE = 0.12
P_ABSENT = 0.03


def sample_normal_day(rng):
    """Vraca (arrival_hour, hours_worked) ili None ako je odsutan. Sve u lokalnom vremenu."""
    r = rng.random()
    if r < P_ABSENT:
        return None
    if r < P_ABSENT + P_LATE:
        # LATE: dolazak posle 14h lokalno (isLateAfter14Local)
        arrival = rng.uniform(14.1, 16.0)
        hours = max(1.0, rng.normal(4.0, 0.7))
        return arrival, hours
    # ON_TIME - povremeno (10%) prekovremeni dan (deadline i sl.), ne znaci da je at-risk
    arrival = rng.normal(8.5, 0.5)
    arrival = min(max(arrival, 7.0), 9.5)
    if rng.random() < 0.10:
        hours = max(4.0, rng.normal(10.0, 1.3))  # povremeni overtime kod normalnih
    else:
        hours = max(4.0, rng.normal(8.0, 0.9))
    return arrival, hours


def sample_burnout_day(rng):
    """Rani dolazak, dug radni dan - ali blazi i manje dosledan nego pre (realno preklapanje
    sa normalnim obrascem, ne savrseno razdvojivo)."""
    arrival = rng.normal(7.8, 0.6)
    arrival = min(max(arrival, 6.5), 9.0)
    hours = max(6.0, rng.normal(10.5, 1.6))
    return arrival, hours


def generate_employee(rng, employee_id, at_risk):
    """Vraca listu od TOTAL_WORKDAYS dana, svaki (arrival_hour, hours_worked) ili None.
    Dani su hronoloski: index 0 = najstariji (deo BASELINE), poslednji = najskoriji (deo RECENT)."""

    days = []

    # BASELINE (svi zaposleni, bez obzira na label, ponasaju se "normalno")
    for _ in range(BASELINE_DAYS):
        days.append(sample_normal_day(rng))

    # RECENT
    if at_risk:
        # nasumicno 40-80% recent dana je burnout obrazac, ostatak normalan (sum)
        burnout_fraction = rng.uniform(0.4, 0.8)
        for _ in range(RECENT_DAYS):
            if rng.random() < burnout_fraction:
                days.append(sample_burnout_day(rng))
            else:
                days.append(sample_normal_day(rng))
    else:
        for _ in range(RECENT_DAYS):
            days.append(sample_normal_day(rng))

    return days


def compute_features(days):
    """days: lista od TOTAL_WORKDAYS elemenata, hronoloski (najstariji prvi).
    Vraca dict sa 8 feature-a, isto kao sto ce Node da racuna iz prave baze."""

    baseline_days = days[:BASELINE_DAYS]
    recent_days = days[BASELINE_DAYS:]

    def avg_hours(day_list):
        worked = [d[1] for d in day_list if d is not None]
        return float(np.mean(worked)) if worked else 0.0

    avg_hours_recent = avg_hours(recent_days)
    avg_hours_baseline = avg_hours(baseline_days)
    hours_deviation = avg_hours_recent - avg_hours_baseline

    # LATE = dolazak posle 14h lokalno (isti kriterijum kao app logika)
    late_count = sum(1 for d in recent_days if d is not None and d[0] >= 14.0)
    absent_count = sum(1 for d in recent_days if d is None)
    pct_late_recent = late_count / RECENT_DAYS
    pct_absent_recent = absent_count / RECENT_DAYS

    arrivals_recent = [d[0] for d in recent_days if d is not None]
    if arrivals_recent:
        avg_arrival_hour_recent = float(np.mean(arrivals_recent))
        arrival_time_std_dev_recent = (
            float(np.std(arrivals_recent, ddof=0)) if len(arrivals_recent) > 1 else 0.0
        )
    else:
        avg_arrival_hour_recent = 0.0
        arrival_time_std_dev_recent = 0.0

    # trend_slope: nagib linearne regresije (dan_indeks -> radni sati), samo dani sa podacima
    hours_with_index = [
        (i, d[1]) for i, d in enumerate(recent_days) if d is not None
    ]
    if len(hours_with_index) >= 2:
        xs = np.array([p[0] for p in hours_with_index], dtype=float)
        ys = np.array([p[1] for p in hours_with_index], dtype=float)
        slope, _intercept = np.polyfit(xs, ys, 1)
        trend_slope = float(slope)
    else:
        trend_slope = 0.0

    return {
        "avg_hours_recent": avg_hours_recent,
        "avg_hours_baseline": avg_hours_baseline,
        "hours_deviation": hours_deviation,
        "pct_late_recent": pct_late_recent,
        "pct_absent_recent": pct_absent_recent,
        "avg_arrival_hour_recent": avg_arrival_hour_recent,
        "arrival_time_std_dev_recent": arrival_time_std_dev_recent,
        "trend_slope": trend_slope,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--n", type=int, default=400, help="Broj sintetickih zaposlenih")
    parser.add_argument("--seed", type=int, default=42, help="Random seed (reproduktivnost)")
    args = parser.parse_args()

    random.seed(args.seed)
    rng = np.random.default_rng(args.seed)

    rows = []
    n_at_risk = 0

    for i in range(args.n):
        at_risk = rng.random() < AT_RISK_PREVALENCE
        if at_risk:
            n_at_risk += 1
        days = generate_employee(rng, i, at_risk)
        features = compute_features(days)
        row = {"employee_id": i, **features, "label": int(at_risk)}
        rows.append(row)

    df = pd.DataFrame(rows)

    os.makedirs("data", exist_ok=True)
    out_path = os.path.join("data", "synthetic_dataset.csv")
    df.to_csv(out_path, index=False)

    print(f"Generisano {len(df)} sintetickih zaposlenih -> {out_path}")
    print(f"At-risk: {n_at_risk} ({n_at_risk / len(df) * 100:.1f}%)")
    print("\nProsecne vrednosti feature-a po klasi:")
    print(df.groupby("label").mean(numeric_only=True).drop(columns=["employee_id"]))


if __name__ == "__main__":
    main()