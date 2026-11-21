from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import yfinance as yf
import numpy as np
import pandas as pd
from datetime import datetime

from database import get_db
from routes.auth import get_current_user
from routes.prices import TICKERS
import models

router = APIRouter(prefix="/risk", tags=["risk"])

def compute_var(returns: pd.Series, confidence: float = 0.95) -> float:
    """
    Historical simulation VaR.
    Returns the loss at the given confidence level (negative = loss).
    """
    if returns.empty or len(returns) < 5:
        return 0.0
    return float(np.percentile(returns.dropna(), (1 - confidence) * 100))

def compute_volatility(returns: pd.Series, window: int = 20) -> float:
    """Rolling volatility — annualised std of daily returns."""
    if returns.empty or len(returns) < window:
        return float(returns.std() * np.sqrt(252))
    return float(returns.rolling(window).std().iloc[-1] * np.sqrt(252))

@router.get("/portfolio")
def portfolio_risk(db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Compute VaR and volatility for all tracked tickers."""
    results = []
    for ticker in TICKERS:
        try:
            df = yf.download(ticker, period="3mo", auto_adjust=True, progress=False)
            if df.empty:
                continue
            if isinstance(df.columns, pd.MultiIndex):
                df.columns = df.columns.get_level_values(0)
            returns = df["Close"].pct_change().dropna()
            var_95     = round(compute_var(returns, 0.95) * 100, 4)   # as %
            volatility = round(compute_volatility(returns), 4)          # annualised

            # Persist snapshot
            snap = models.RiskSnapshot(ticker=ticker, var_95=var_95, volatility=volatility)
            db.add(snap)

            results.append({
                "ticker":     ticker,
                "var_95_pct": var_95,        # e.g. -2.3 means 2.3% max daily loss at 95%
                "volatility_annualised": volatility,
                "risk_level": "HIGH" if volatility > 0.4 else "MEDIUM" if volatility > 0.2 else "LOW",
                "timestamp":  datetime.utcnow().isoformat()
            })
        except Exception as e:
            results.append({"ticker": ticker, "error": str(e)})

    db.commit()
    return {"risk_metrics": results, "count": len(results)}

@router.get("/ticker/{ticker}")
def ticker_risk(ticker: str, db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Detailed risk metrics for a single ticker."""
    if ticker.upper() not in TICKERS:
        raise HTTPException(status_code=404, detail="Ticker not tracked")
    try:
        df = yf.download(ticker, period="6mo", auto_adjust=True, progress=False)
        if df.empty:
            raise HTTPException(status_code=404, detail="No data")
        if isinstance(df.columns, pd.MultiIndex):
            df.columns = df.columns.get_level_values(0)
        returns = df["Close"].pct_change().dropna()
        return {
            "ticker": ticker,
            "var_95":  round(compute_var(returns, 0.95) * 100, 4),
            "var_99":  round(compute_var(returns, 0.99) * 100, 4),
            "volatility_20d": round(float(returns.rolling(20).std().iloc[-1] * np.sqrt(252)), 4),
            "volatility_60d": round(float(returns.rolling(60).std().iloc[-1] * np.sqrt(252)), 4),
            "mean_return":    round(float(returns.mean()) * 100, 4),
            "max_drawdown":   round(float((df["Close"] / df["Close"].cummax() - 1).min()) * 100, 4),
            "sharpe_ratio":   round(float(returns.mean() / returns.std() * np.sqrt(252)), 4),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
