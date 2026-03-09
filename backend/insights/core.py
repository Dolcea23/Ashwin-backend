from .clinicals import get_clinical_summary
from .ratios import get_ratio_analysis
from .correlations import get_correlation_map

def get_full_insights_bundle(rows):
    return {
        "clinical_summary": get_clinical_summary(rows),
        "ratios": get_ratio_analysis(rows),
        "correlations": get_correlation_map(rows)
    }
