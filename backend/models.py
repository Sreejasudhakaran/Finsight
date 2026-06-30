from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base

class User(Base):
    __tablename__ = "users"
    id       = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

class PriceRecord(Base):
    __tablename__ = "price_records"
    id        = Column(Integer, primary_key=True, index=True)
    ticker    = Column(String, index=True, nullable=False)
    price     = Column(Float, nullable=False)
    volume    = Column(Float)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)

class RiskSnapshot(Base):
    __tablename__ = "risk_snapshots"
    id         = Column(Integer, primary_key=True, index=True)
    ticker     = Column(String, index=True, nullable=False)
    var_95     = Column(Float)   # Value-at-Risk at 95% confidence
    volatility = Column(Float)   # Rolling 20-day volatility
    timestamp  = Column(DateTime, default=datetime.utcnow, index=True)

class AnomalyRecord(Base):
    __tablename__ = "anomaly_records"
    id        = Column(Integer, primary_key=True, index=True)
    ticker    = Column(String, index=True, nullable=False)
    price     = Column(Float)
    score     = Column(Float)    # Isolation Forest anomaly score
    flagged   = Column(Integer, default=0)  # 1 = anomaly
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
