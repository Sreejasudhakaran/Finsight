from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from slowapi import Limiter
from slowapi.util import get_remote_address
import yfinance as yf
import pandas as pd
from datetime import datetime

from database import get_db
from routes.auth import get_current_user
import models

router = APIRouter(prefix="/prices", tags=["prices"])
limiter = Limiter(key_func=get_remote_address)

TICKERS = [
    "AAPL","MSFT","GOOGL","AMZN","NVDA","TSLA","META",
    "JPM","GS","BAC","V","MA","NFLX","AMD","INTC",
    "ORCL","CRM","IBM","PYPL","DIS"
]

@router.get("/live")
def get_live_prices(db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Fetch live prices for all tracked tickers via yfinance."""
    results = []
    for ticker in TICKERS:
        try:
            data = yf.Ticker(ticker)
            info = data.fast_info
            price  = round(float(info.last_price), 2)
            prev   = round(float(info.previous_close), 2)
            change = round(((price - prev) / prev) * 100, 2) if prev else 0.0

            # Persist to DB
            record = models.PriceRecord(ticker=ticker, price=price)
            db.add(record)

            results.append({
                "ticker": ticker,
                "price": price,
                "previous_close": prev,
                "change_pct": change,
                "timestamp": datetime.utcnow().isoformat()
            })
        except Exception as e:
            results.append({"ticker": ticker, "error": str(e)})

    db.commit()
    return {"prices": results, "count": len(results)}

@router.get("/history/{ticker}")
def get_history(ticker: str, period: str = "1mo", db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Fetch historical OHLCV data for a single ticker."""
    if ticker.upper() not in TICKERS:
        raise HTTPException(status_code=404, detail="Ticker not tracked")
    try:
        df = yf.download(ticker, period=period, auto_adjust=True, progress=False)
        if df.empty:
            raise HTTPException(status_code=404, detail="No data found")
        records = []
        for ts, row in df.iterrows():
            records.append({
                "date": ts.strftime("%Y-%m-%d"),
                "open":  round(float(row["Open"]), 2),
                "high":  round(float(row["High"]), 2),
                "low":   round(float(row["Low"]), 2),
                "close": round(float(row["Close"]), 2),
                "volume": int(row["Volume"])
            })
        return {"ticker": ticker, "period": period, "data": records}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/tickers")
def get_tickers():
    """Return list of tracked tickers — public endpoint."""
    return {"tickers": TICKERS}
