"""
Orthonova FastAPI Application

Main entry point for the backend API server.
Handles CORS, routing, and application lifecycle.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.config import get_settings
from app.db.models import init_db
from app.api import intake, sensors, results, auth, patients, videos


# Lifespan context manager for startup/shutdown
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize database on startup."""
    print("Starting Orthonova API...")
    print("Initializing database...")
    try:
        init_db()
        print("Database initialized successfully")
    except Exception as e:
        print(f"Warning: Could not initialize database: {e}")
        print("Make sure MySQL is running and DATABASE_URL is correct in .env")

    yield

    print("Shutting down Orthonova API...")


# Create FastAPI app
app = FastAPI(
    title="Orthonova",
    description="Low-cost knee osteoarthritis screening tool API",
    version="0.1.0",
    lifespan=lifespan,
)

# Get settings
settings = get_settings()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routers
app.include_router(auth.router)
app.include_router(patients.router)
app.include_router(intake.router)
app.include_router(sensors.router)
app.include_router(results.router)
app.include_router(videos.router)


# Health check endpoint
@app.get("/")
async def root():
    """Root endpoint - health check."""
    return {
        "status": "healthy",
        "service": "orthonova-api",
        "version": "0.1.0",
        "docs": "/docs",
    }


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "healthy"}


# Run with: uvicorn app.main:app --reload
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
