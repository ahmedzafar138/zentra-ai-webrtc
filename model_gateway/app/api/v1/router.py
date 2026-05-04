from fastapi import APIRouter

from app.api.v1 import bicep_curl

api_router = APIRouter()
api_router.include_router(bicep_curl.router)
