from statistics import mean

def pearson(xs, ys):
    if len(xs) < 3: return None
    mx, my = mean(xs), mean(ys)
    num = sum((x-mx)*(y-my) for x,y in zip(xs,ys))
    den = (sum((x-mx)**2 for x in xs) * sum((y-my)**2 for y in ys)) ** 0.5
    if den == 0: return None
    return round(num/den, 3)

def get_correlation_map(rows):
    eeg = [r[0] for r in rows]
    ecg = [r[1] for r in rows]
    temp = [r[2] for r in rows]
    light = [r[3] for r in rows]
    noise = [r[4] for r in rows]

    corrs = []

    def add(label, a, b):
        val = pearson(a, b)
        if val is not None:
            corrs.append({"pair": label, "r": val})

    add("EEG vs Light", eeg, light)
    add("EEG vs Noise", eeg, noise)
    add("ECG vs Light", ecg, light)
    add("ECG vs Noise", ecg, noise)
    add("Temp vs Light", temp, light)
    add("Temp vs Noise", temp, noise)

    return corrs
