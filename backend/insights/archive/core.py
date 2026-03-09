from .clinicals import get_clinical_summary
from .ratios import get_ratios
from .correlations import get_correlations

def get_full_insights_bundle(rows):
    return {
        "clinical_summary": get_clinical_summary(rows),
        "ratios": get_ratios(rows),
        "correlations": get_correlations(rows)
    }
