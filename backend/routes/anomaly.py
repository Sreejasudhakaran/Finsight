from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sklearn.ensemble import IsolationForest
import yfinance as yf
import numpy as np
import pandas as pd
from datetime import datetime

from database import get_db
from routes.auth import get_current_user
from routes.prices import TICKERS
import models

router = APIRouter(prefix="/anomaly", tags=["anomaly"])

def detect_anomalies(df: pd.DataFrame, contamination: float = 0.05):
    """
    Run Isolation Forest on price + volume features.
    Returns dataframe with anomaly scores and flags.
    """
    df = df.copy()
    df["return"]      = df["Close"].pct_change()
    df["vol_change"]  = df["Volume"].pct_change()
    df["price_range"] = (df["High"] - df["Low"]) / df["Close"]
    df.dropna(inplace=True)

    features = df[["return", "vol_change", "price_range"]].values
    model = IsolationForest(contamination=contamination, random_state=42)
    df["anomaly_score"] = model.fit_predict(features)   # -1 = anomaly, 1 = normal
    df["score_raw"]     = model.decision_function(features)
    df["is_anomaly"]    = df["anomaly_score"] == -1
    return df

@router.get("/scan")
def scan_all(db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Scan all tickers for anomalous price movements."""
    flagged = []
    for ticker in TICKERS:
        try:
            df = yf.download(ticker, period="3mo", auto_adjust=True, progress=False)
            if df.empty or len(df) < 20:
                continue
            result = detect_anomalies(df)
            anomalies = result[result["is_anomaly"]]
            if not anomalies.empty:
                latest = anomalies.iloc[-1]
                record = models.AnomalyRecord(
                    ticker=ticker,
                    price=round(float(latest["Close"]), 2),
                    score=round(float(latest["score_raw"]), 4),
                    flagged=1
                )
                db.add(record)
                flagged.append({
                    "ticker":    ticker,
                    "price":     round(float(latest["Close"]), 2),
                    "return_pct": round(float(latest["return"]) * 100, 2),
                    "score":     round(float(latest["score_raw"]), 4),
                    "date":      latest.name.strftime("%Y-%m-%d") if hasattr(latest.name, 'strftime') else str(latest.name),
                    "severity":  "HIGH" if latest["score_raw"] < -0.1 else "MEDIUM"
                })
        except Exception as e:
            continue

    db.commit()
    return {
        "flagged_count": len(flagged),
        "anomalies": sorted(flagged, key=lambda x: x["score"]),
        "scanned": len(TICKERS),
        "timestamp": datetime.utcnow().isoformat()
    }

@router.get("/ticker/{ticker}")
def ticker_anomaly(ticker: str, user=Depends(get_current_user)):
    """Detailed anomaly scan for a single ticker."""
    if ticker.upper() not in TICKERS:
        raise HTTPException(status_code=404, detail="Ticker not tracked")
    try:
        df = yf.download(ticker, period="6mo", auto_adjust=True, progress=False)
        if df.empty:
            raise HTTPException(status_code=404, detail="No data")
        result = detect_anomalies(df)
        anomalies = result[result["is_anomaly"]].tail(10)
        return {
            "ticker": ticker,
            "total_anomalies": int(result["is_anomaly"].sum()),
            "anomaly_rate_pct": round(float(result["is_anomaly"].mean()) * 100, 2),
            "recent_anomalies": [
                {
                    "date":       row.name.strftime("%Y-%m-%d"),
                    "price":      round(float(row["Close"]), 2),
                    "return_pct": round(float(row["return"]) * 100, 2),
                    "score":      round(float(row["score_raw"]), 4)
                }
                for _, row in anomalies.iterrows()
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
