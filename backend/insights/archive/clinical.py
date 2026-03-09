from statistics import mean, pstdev

def get_clinical_summary(rows):
    if not rows:
        return {}

    eeg = [r[0] for r in rows]
    ecg = [r[1] for r in rows]
    temp = [r[2] for r in rows]
    light = [r[3] for r in rows]
    noise = [r[4] for r in rows]

    mid = len(rows) // 2 or 1
    before = rows[:mid]
    after = rows[mid:]

    summary = {
        "count": len(rows),
        "eeg_avg": round(mean(eeg), 2),
        "ecg_avg": round(mean(ecg), 2),
        "temp_avg": round(mean(temp), 2),
        "light_avg": round(mean(light), 2),
        "noise_avg": round(mean(noise), 2),
        "eeg_min": min(eeg),
        "eeg_max": max(eeg),
        "ecg_min": min(ecg),
        "ecg_max": max(ecg),
        "temp_min": min(temp),
        "temp_max": max(temp),
        "before_count": len(before),
        "after_count": len(after),
    }

    return summary
