from .core import calc_harmony


def chart_timeseries(rows):
    """Return labels and data arrays for Chart.js."""
    labels = [r[5][11:19] for r in rows]  # Extract time from ISO timestamp
    harmonies = [calc_harmony(r[0], r[1], r[2]) for r in rows]
    return labels, harmonies
