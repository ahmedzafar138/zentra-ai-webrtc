from contextlib import asynccontextmanager
import logging
import os
import time
from typing import AsyncIterator

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "1")

from app.api.v1.router import api_router
from app.core.config import get_settings
from app.services.bicep_curl_service import get_bicep_curl_service


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)
logger = logging.getLogger("model_gateway")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    logger.info("Starting Zentra model gateway")
    if settings.load_models_on_startup:
        get_bicep_curl_service().load()
    else:
        logger.warning(
            "Model startup loading is disabled. The bicep curl model will load "
            "on the first inference request."
        )
    yield
    logger.info("Stopping Zentra model gateway")


settings = get_settings()
app = FastAPI(title=settings.app_name, version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def request_logging_middleware(request: Request, call_next):
    started = time.perf_counter()
    response = await call_next(request)
    elapsed_ms = (time.perf_counter() - started) * 1000
    logger.info(
        "%s %s -> %s %.2fms",
        request.method,
        request.url.path,
        response.status_code,
        elapsed_ms,
    )
    return response


@app.get("/health")
def health() -> dict[str, object]:
    return {
        "status": "ok",
        "service": settings.app_name,
        "models": {
            "bicep_curl": get_bicep_curl_service().health(),
        },
    }


app.include_router(api_router, prefix=settings.api_prefix)
