from statistics import mean

def _pearson(xs, ys):
    if len(xs) < 3 or len(ys) < 3:
        return None
    mx, my = mean(xs), mean(ys)
    num = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    denx = sum((x - mx)**2 for x in xs)
    deny = sum((y - my)**2 for y in ys)
    if denx == 0 or deny == 0:
        return None
    return round(num / ((denx**0.5) * (deny**0.5)), 3)

def get_correlations(rows):
    eeg = [r[0] for r in rows if r[0] is not None]
    ecg = [r[1] for r in rows if r[1] is not None]
    temp = [r[2] for r in rows if r[2] is not None]
    light = [r[3] for r in rows if r[3] is not None]
    noise = [r[4] for r in rows if r[4] is not None]

    pairs = []

    def add(label, a, b):
        val = _pearson(a, b)
        if val is not None:
            pairs.append({"pair": label, "correlation": val})

    add("EEG vs ECG", eeg, ecg)
    add("EEG vs Temp", eeg, temp)
    add("EEG vs Light", eeg, light)
    add("EEG vs Noise", eeg, noise)
    add("ECG vs Temp", ecg, temp)
    add("Temp vs Light", temp, light)
    add("Temp vs Noise", temp, noise)

    return pairs
