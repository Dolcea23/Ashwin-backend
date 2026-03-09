# insights/insights.py
from statistics import mean, pstdev
from typing import List, Dict, Any


def summarize_harmonies(harmonies: List[float]) -> Dict[str, float]:
    """
    Given a list of harmony values, compute key stats used across the backend:
    - avg
    - min / max
    - avg_before / avg_after
    - improvement %
    - stability %
    - hri (Harmony Recovery Index)
    """
    if not harmonies:
        return {
            "avg": 0.0,
            "min": 0.0,
            "max": 0.0,
            "avg_before": 0.0,
            "avg_after": 0.0,
            "improvement": 0.0,
            "stability": 0.0,
            "hri": 0.0,
        }

    avg = round(mean(harmonies), 2)
    min_h = round(min(harmonies), 2)
    max_h = round(max(harmonies), 2)

    mid = len(harmonies) // 2 or 1
    before = harmonies[:mid]
    after = harmonies[mid:]

    avg_before = round(mean(before), 2) if before else 0.0
    avg_after = round(mean(after), 2) if after else 0.0

    improvement = (
        round(((avg_after - avg_before) / avg_before) * 100, 2)
        if avg_before
        else 0.0
    )

    # stability: reduction in standard deviation from before → after
    stability = 0.0
    if len(before) > 1:
        try:
            stability = round(
                ((pstdev(before) - pstdev(after)) / pstdev(before)) * 100, 2
            )
        except Exception:
            stability = 0.0

    hri = round((improvement + stability) / 2, 2)

    return {
        "avg": avg,
        "min": min_h,
        "max": max_h,
        "avg_before": avg_before,
        "avg_after": avg_after,
        "improvement": improvement,
        "stability": stability,
        "hri": hri,
    }


def build_ratio_rows(rows: List[Any]):
    """
    Input rows: (eeg, ecg, temp, light, noise, timestamp)
    Returns list of (timestamp, brain_coherence, signal_to_noise)
    """
    ratio_rows = []
    for eeg, ecg, temp, light, noise, ts in rows:
        if eeg is not None and ecg not in (None, 0):
            brain_coherence = round(eeg / ecg, 3)
        else:
            brain_coherence = 0.0

        if noise is not None and light is not None and noise > 0:
            signal_to_noise = round(light / noise, 3)
        else:
            signal_to_noise = 0.0

        ratio_rows.append((ts, brain_coherence, signal_to_noise))

    return ratio_rows


def build_correlation_pairs(pearson_fn, rows: List[Any]):
    """
    Input rows: (eeg, ecg, temperature, light, noise, timestamp)
    Uses the provided pearson function from main to compute correlations.
    Returns list of (label, value).
    """
    if len(rows) < 5:
        return []

    eeg_vals = [r[0] for r in rows if r[0] is not None]
    ecg_vals = [r[1] for r in rows if r[1] is not None]
    temp_vals = [r[2] for r in rows if r[2] is not None]
    light_vals = [r[3] for r in rows if r[3] is not None]
    noise_vals = [r[4] for r in rows if r[4] is not None]

    corrs = []

    def add_corr(label, xs, ys):
        if xs and ys:
            val = pearson_fn(xs, ys)
            if val is not None:
                corrs.append((label, val))

    add_corr("EEG vs Light", eeg_vals, light_vals)
    add_corr("EEG vs Noise", eeg_vals, noise_vals)
    add_corr("ECG vs Light", ecg_vals, light_vals)
    add_corr("ECG vs Noise", ecg_vals, noise_vals)
    add_corr("Temp vs Light", temp_vals, light_vals)
    add_corr("Temp vs Noise", temp_vals, noise_vals)

    return corrs
