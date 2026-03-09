def get_ratios(rows):
    ratios = []

    for eeg, ecg, temp, light, noise, ts in rows:
        brain_coherence = round(eeg / ecg, 3) if ecg else 0
        thermo = round(98.6 / temp, 3) if temp else 0
        signal_noise = round(light / noise, 3) if noise else 0

        ratios.append({
            "timestamp": ts,
            "brain_coherence": brain_coherence,
            "thermoregulation": thermo,
            "signal_to_noise": signal_noise
        })

    return ratios
