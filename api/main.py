import os
import uvicorn
from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware
from api.routes import router

app = FastAPI(
    title="LPU Campus Parking Intelligence System",
    description="End-to-End Parking Occupancy Prediction, Multi-Camera Vision, and Intelligent Recommendation Engine for Lovely Professional University.",
    version="2.0.0"
)

# CORS: allow_credentials=True requires explicit origin list (wildcard is rejected by browsers).
# In production set ALLOWED_ORIGINS env-var to your deployed domain.
_raw_origins = os.environ.get("ALLOWED_ORIGINS", "http://localhost:8000,http://127.0.0.1:8000")
_allowed_origins = [o.strip() for o in _raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Static Files (CSS, JS, favicon)
app.mount("/static", StaticFiles(directory="frontend/static"), name="static")

# Configure Templates (HTML)
templates = Jinja2Templates(directory="frontend/templates")

# Include Core API Routes (/api/...)
app.include_router(router)

# Favicon — prevents 404 spam in logs
@app.get("/favicon.ico", include_in_schema=False)
async def favicon():
    return FileResponse("frontend/static/favicon.ico")

# Root Web Dashboard Route
@app.get("/", response_class=HTMLResponse)
async def serve_dashboard(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

if __name__ == "__main__":
    uvicorn.run("api.main:app", host="0.0.0.0", port=8000, reload=True)
