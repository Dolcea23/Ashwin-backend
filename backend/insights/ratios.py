def get_ratio_analysis(rows):
    ratios = []

    for eeg, ecg, temp, light, noise, ts in rows:
        bc = round(eeg/ecg, 3) if ecg else 0
        sn = round(light/noise, 3) if noise else 0
        ratios.append({
            "timestamp": ts,
            "brain_coherence": bc,
            "signal_noise": sn
        })

    return ratios
