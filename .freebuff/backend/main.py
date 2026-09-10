"""SakshamAI – FastAPI backend.

Run locally:
    uvicorn main:app --reload --port 8000
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import ValidationError

from config import settings
from database import Base, engine
from routers import admin, applications, auth, calculator, dashboard, partners, public, recommendations, schemes, users
from seed import init_db

from services.scheduler import scheduler

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("sakshamai")


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    init_db()
    logger.info("SakshamAI database ready (%s)", settings.database_url.split("://")[0])
    scheduler.start()
    logger.info("24-Hour government schemes auto-sync scheduler started")
    yield
    scheduler.stop()
    logger.info("24-Hour government schemes auto-sync scheduler stopped")


app = FastAPI(
    title="SakshamAI API",
    description="AI-driven scheme matching for marginalized entrepreneurs.",
    version="1.0.0",
    lifespan=lifespan,
)

origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(public.router)
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(schemes.router)
app.include_router(recommendations.router)
app.include_router(calculator.router)
app.include_router(partners.router)
app.include_router(applications.router)
app.include_router(dashboard.router)
app.include_router(admin.router)


# ------------------------------------------------------------ error handling
@app.exception_handler(RequestValidationError)
async def validation_handler(request: Request, exc: RequestValidationError):
    logger.warning("Validation error on %s: %s", request.url.path, exc.errors()[:2])
    return JSONResponse(
        status_code=422,
        content={"detail": "Please check the information you entered and try again."},
    )


@app.exception_handler(ValidationError)
async def pydantic_handler(request: Request, exc: ValidationError):
    return JSONResponse(
        status_code=422,
        content={"detail": "Please check the information you entered and try again."},
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled error on %s", request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": "Something went wrong on our side. Please try again in a moment."},
    )


@app.get("/")
def root():
    return {"message": "SakshamAI API is running. See /docs for interactive documentation."}