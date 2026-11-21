# 📈 FinSight — Real-Time Stock Risk Intelligence Dashboard

A full-stack portfolio risk monitoring platform built with FastAPI, React, PostgreSQL, and Docker.
Computes Value-at-Risk (VaR), rolling volatility, and anomalous price movements across 20+ securities in real time.

---

## Architecture

```
User Browser (React + D3.js)
        ↕ WebSocket + REST
Nginx (reverse proxy :80)
        ↕
FastAPI Backend (:8000)
    ├── /auth      → JWT login & register
    ├── /prices    → yfinance live data
    ├── /risk      → VaR + volatility engine
    ├── /anomaly   → Isolation Forest detection
    └── /ws/prices → WebSocket price stream
        ↕
PostgreSQL (:5432)
    ├── users
    ├── price_records
    ├── risk_snapshots
    └── anomaly_records
```

---

## Features

| Feature | Details |
|---|---|
| Live price streaming | WebSocket push every 10s via yfinance |
| Value-at-Risk (VaR) | Historical simulation at 95% & 99% confidence |
| Rolling volatility | 20-day & 60-day annualised std deviation |
| Anomaly detection | Isolation Forest on price + volume + range features |
| JWT authentication | Secure login, token-based API access |
| Rate limiting | slowapi middleware on all routes |
| PostgreSQL storage | 10,000+ price records, risk snapshots, anomaly logs |
| CI/CD pipeline | GitHub Actions — lint, test, Docker build on every push |
| Docker Compose | 3-service containerised deployment with Nginx |

---

## Quick Start

### Prerequisites
- Docker Desktop installed
- Git

### Run locally in 3 commands

```bash
git clone https://github.com/Sreejasudhakaran/Finsight.git
cd Finsight
docker compose up --build
```

Open [http://localhost](http://localhost) in your browser.

Register an account, then explore the dashboard.

---

## Tech Stack

**Backend:** Python 3.11, FastAPI, uvicorn, SQLAlchemy, psycopg2  
**Data:** yfinance, pandas, numpy, scikit-learn (Isolation Forest)  
**Auth:** python-jose (JWT), passlib (bcrypt), slowapi (rate limiting)  
**Frontend:** React 18, D3.js v7, axios  
**Database:** PostgreSQL 15  
**Infrastructure:** Docker Compose, Nginx, GitHub Actions CI/CD  

---

## API Endpoints

| Method | Endpoint |  Description |
|---|---|---|---|
| POST | `/auth/register` | Create account |
| POST | `/auth/token`  | Login, get JWT |
| GET | `/prices/live`  | Fetch live prices (20 tickers) |
| GET | `/prices/history/{ticker}` |  Historical OHLCV |
| GET | `/prices/tickers` |  List tracked tickers |
| GET | `/risk/portfolio` |  VaR + volatility for all tickers |
| GET | `/risk/ticker/{ticker}`  | Detailed risk metrics |
| GET | `/anomaly/scan` |  Isolation Forest scan — all tickers |
| GET | `/anomaly/ticker/{ticker}` |  Anomaly detail for one ticker |
| WS  | `/ws/prices` |  Live WebSocket price stream |

Interactive docs: [http://localhost:8000/docs](http://localhost:8000/docs)

---

## CI/CD Pipeline

Every `git push` to `main` triggers:

1. **Backend lint** — flake8 checks Python code quality
2. **Backend tests** — pytest runs test suite
3. **Frontend build** — React production build validation
4. **Docker build** — Both images built to catch container errors

---

## Project Structure

```
finsight/
├── backend/
│   ├── main.py           ← FastAPI app + WebSocket broadcaster
│   ├── models.py         ← PostgreSQL schema (SQLAlchemy)
│   ├── database.py       ← DB connection + session management
│   ├── routes/
│   │   ├── auth.py       ← JWT register/login
│   │   ├── prices.py     ← yfinance live + historical data
│   │   ├── risk.py       ← VaR + volatility computation
│   │   └── anomaly.py    ← Isolation Forest detection
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.jsx       ← Auth flow + routing
│   │   ├── App.css       ← Dark fintech theme
│   │   └── components/
│   │       ├── Dashboard.jsx    ← Main dashboard
│   │       ├── RiskChart.jsx    ← D3.js price chart
│   │       └── AnomalyTable.jsx ← Flagged stocks table
│   ├── Dockerfile
│   └── package.json
├── nginx/
│   └── nginx.conf        ← Reverse proxy config
├── .github/
│   └── workflows/
│       └── ci.yml        ← GitHub Actions pipeline
├── docker-compose.yml
└── README.md
```

---

## Built By

**Sreeja Thati** — B.Tech CSE (AI & ML), VNR VJIET, Hyderabad  
[LinkedIn](https://linkedin.com/in/sreeja-thati) · [GitHub](https://github.com/Sreejasudhakaran)
