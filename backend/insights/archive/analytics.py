# analytics.py — advanced analytics for Ashwin Insights

from statistics import mean, pstdev
from typing import List, Dict
from .core import calc_harmony, hrv_proxy

def compute_overview(harmonies: List[float]) -> Dict:
    if not harmonies:
        return {
            "avg": 0,
            "min": 0,
            "max": 0,
            "improvement": 0,
            "stability": 0,
            "hri": 0
        }

    avg = round(mean(harmonies), 2)
    mn = round(min(harmonies), 2)
    mx = round(max(harmonies), 2)

    mid = len(harmonies)//2 or 1
    before = harmonies[:mid]
    after = harmonies[mid:]

    avg_before = round(mean(before), 2)
    avg_after  = round(mean(after), 2)
    improvement = round(((avg_after - avg_before)/avg_before)*100, 2) if avg_before else 0

    try:
        stability = round(((pstdev(before)-pstdev(after)) / pstdev(before))*100, 2)
    except:
        stability = 0

    hri = round((improvement + stability)/2, 2)

    return {
        "avg": avg,
        "min": mn,
        "max": mx,
        "improvement": improvement,
        "stability": stability,
        "hri": hri
    }

def compute_environment_correlation(brain_vals, env_vals):
    if len(brain_vals) < 3 or len(env_vals) < 3:
        return 0
    try:
        mx, my = mean(brain_vals), mean(env_vals)
        num = sum((b - mx)*(e - my) for b, e in zip(brain_vals, env_vals))
        den = (sum((b - mx)**2 for b in brain_vals) * sum((e - my)**2 for e in env_vals)) ** 0.5
        return round(num / den, 3)
    except:
        return 0
