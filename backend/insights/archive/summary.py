from statistics import mean, pstdev
from .core import calc_harmony


def compute_summary(rows):
    """Return dict with avg, min, max, improvement, stability, hri."""
    harmonies = [calc_harmony(r[0], r[1], r[2]) for r in rows]

    if not harmonies:
        return {
            "avg": 0,
            "min": 0,
            "max": 0,
            "improvement": 0,
            "stability": 0,
            "hri": 0,
        }

    avg_h = round(mean(harmonies), 2)
    min_h = round(min(harmonies), 2)
    max_h = round(max(harmonies), 2)

    mid = len(harmonies) // 2 or 1
    before = harmonies[:mid]
    after = harmonies[mid:]

    avg_before = round(mean(before), 2) if before else 0
    avg_after = round(mean(after), 2) if after else 0

    improvement = (
        round(((avg_after - avg_before) / avg_before) * 100, 2)
        if avg_before > 0
        else 0
    )

    try:
        stability = round(
            ((pstdev(before) - pstdev(after)) / pstdev(before)) * 100, 2
        ) if len(before) > 1 else 0
    except:
        stability = 0

    hri = round((improvement + stability) / 2, 2)

    return {
        "avg": avg_h,
        "min": min_h,
        "max": max_h,
        "improvement": improvement,
        "stability": stability,
        "hri": hri,
    }
