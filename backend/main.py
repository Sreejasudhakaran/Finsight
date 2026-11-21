from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import asyncio
import json
import yfinance as yf
from datetime import datetime

from database import engine, Base
from routes import auth, prices, risk, anomaly

# Create all DB tables
Base.metadata.create_all(bind=engine)

limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title="FinSight API",
    description="Real-Time Stock Risk Intelligence Dashboard",
    version="1.0.0"
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:80", "http://localhost"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(auth.router)
app.include_router(prices.router)
app.include_router(risk.router)
app.include_router(anomaly.router)

@app.get("/")
def root():
    return {"service": "FinSight API", "status": "running", "version": "1.0.0"}

@app.get("/health")
def health():
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}

# ─── WebSocket: live price streaming ────────────────────────────────────────

class ConnectionManager:
    def __init__(self):
        self.active: list[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.active.append(ws)

    def disconnect(self, ws: WebSocket):
        self.active.remove(ws)

    async def broadcast(self, data: dict):
        dead = []
        for ws in self.active:
            try:
                await ws.send_json(data)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.active.remove(ws)

manager = ConnectionManager()

STREAM_TICKERS = ["AAPL", "MSFT", "TSLA", "GOOGL", "NVDA", "JPM"]

async def price_broadcaster():
    """Background task: fetch prices every 10s and broadcast to all WS clients."""
    while True:
        if manager.active:
            payload = []
            for ticker in STREAM_TICKERS:
                try:
                    info  = yf.Ticker(ticker).fast_info
                    price = round(float(info.last_price), 2)
                    prev  = round(float(info.previous_close), 2)
                    chg   = round(((price - prev) / prev) * 100, 2) if prev else 0.0
                    payload.append({
                        "ticker": ticker,
                        "price":  price,
                        "change_pct": chg,
                        "up": chg >= 0
                    })
                except Exception:
                    pass
            if payload:
                await manager.broadcast({
                    "type": "price_update",
                    "data": payload,
                    "timestamp": datetime.utcnow().isoformat()
                })
        await asyncio.sleep(10)

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(price_broadcaster())

@app.websocket("/ws/prices")
async def websocket_prices(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Keep connection alive; actual data comes from broadcaster
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
