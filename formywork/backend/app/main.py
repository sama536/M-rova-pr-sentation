"""Point d'entrée de FormyWork : API REST, temps réel (SSE) et interface web compilée."""

from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

from .api import routes_apply, routes_auth, routes_offers, routes_resumes
from .auth import current_user
from .config import ROOT_DIR, get_settings
from .db import SessionLocal
from .migrate import upgrade_database
from .models import User
from .services.events import broker

log = logging.getLogger("formywork")
STATIC_DIR = Path(__file__).resolve().parent / "static"


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    upgrade_database()
    if settings.demo_mode:
        from .demo.seed import seed_demo

        with SessionLocal() as db:
            seed_demo(db)
    scheduler = None
    if not getattr(app.state, "disable_scheduler", False):
        from .scheduler import build_scheduler

        scheduler = build_scheduler()
        scheduler.start()
    yield
    if scheduler:
        scheduler.shutdown(wait=False)


app = FastAPI(
    title="FormyWork", version="1.0.0", lifespan=lifespan, docs_url="/api/docs", openapi_url="/api/openapi.json"
)
app.include_router(routes_auth.router)
app.include_router(routes_offers.router)
app.include_router(routes_resumes.router)
app.include_router(routes_apply.router)


@app.exception_handler(RequestValidationError)
async def validation_handler(_request: Request, exc: RequestValidationError) -> JSONResponse:
    first = exc.errors()[0] if exc.errors() else {}
    field = ".".join(str(p) for p in first.get("loc", [])[1:])
    msg = first.get("msg", "Données invalides")
    return JSONResponse(status_code=422, content={"detail": f"Champ « {field} » invalide : {msg}" if field else msg})


@app.get("/api/health")
def health() -> dict:
    return {"ok": True, "demo_mode": get_settings().demo_mode}


@app.get("/api/events")
async def events(request: Request, user: User = Depends(current_user)) -> StreamingResponse:
    queue = broker.subscribe(user.id)

    async def stream():
        try:
            yield "event: hello\ndata: {}\n\n"
            while True:
                if await request.is_disconnected():
                    break
                try:
                    payload = await asyncio.wait_for(queue.get(), timeout=20)
                    yield payload
                except TimeoutError:
                    yield ": ping\n\n"
        finally:
            broker.unsubscribe(user.id, queue)

    return StreamingResponse(
        stream(), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}
    )


# ---------------------------------------------------------------- interface web compilée
if (STATIC_DIR / "assets").exists():
    app.mount("/assets", StaticFiles(directory=STATIC_DIR / "assets"), name="assets")


@app.get("/{path:path}", include_in_schema=False)
def spa(path: str):
    if path.startswith("api/"):
        return JSONResponse({"detail": "Introuvable"}, status_code=404)
    candidate = (STATIC_DIR / path).resolve()
    if path and candidate.is_file() and STATIC_DIR in candidate.parents:
        return FileResponse(candidate)
    index = STATIC_DIR / "index.html"
    if index.exists():
        return FileResponse(index)
    return JSONResponse({"detail": f"Interface non compilée. Lancez ./start.sh depuis {ROOT_DIR}."}, status_code=503)
