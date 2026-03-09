from fastapi import APIRouter, Query
from fastapi.responses import RedirectResponse

router = APIRouter()

@router.get("/health")
def health():
    return {"ok": True}

@router.get("/")
def root():
    # keep this consistent with your existing behavior
    return RedirectResponse(url="/dashboard?user=1")

@router.get("/dashboard")
def dashboard(user: int = Query(1, ge=1)):
    # your current logs show /dashboard redirects to /report/{user}
    return RedirectResponse(url=f"/report/{user}")
