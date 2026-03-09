def get_clinical_summary(rows):
    if not rows:
        return {"avg_harmony": 0, "min_harmony": 0, "max_harmony": 0}

    from statistics import mean

    harmonies = []
    for r in rows:
        eeg, ecg, temp = r[:3]
        thermal = (100 - abs(98.6 - temp)) * 1.2
        if eeg < 5: eeg *= 100
        if ecg < 5: ecg *= 100
        h = round(0.4*eeg + 0.4*ecg + 0.2*thermal, 2)
        harmonies.append(h)

    return {
        "avg_harmony": round(mean(harmonies), 2),
        "min_harmony": round(min(harmonies), 2),
        "max_harmony": round(max(harmonies), 2),
        "total_samples": len(harmonies)
    }
