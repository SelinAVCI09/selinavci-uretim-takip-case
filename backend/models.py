from sqlalchemy import Column, Integer, String, Float, Date, Boolean, Text
from sqlalchemy import DateTime
from datetime import datetime
from database import Base

class ProductionRecord(Base):
    __tablename__ = "production_records"

    record_id = Column(Integer, primary_key=True, index=True)
    date = Column(Date, nullable=True)
    work_order_no = Column(String, index=True, nullable=True)
    work_center_no = Column(String, nullable=True)
    work_center_name = Column(String, nullable=True)
    workstation_name = Column(String, index=True, nullable=True)
    stock_name = Column(String, nullable=True)
    shift = Column(Integer, index=True, nullable=True)
    
    availability = Column(Float, nullable=True)
    performance = Column(Float, nullable=True)
    quality = Column(Float, nullable=True)
    oee = Column(Float, nullable=True)
    
    work_time = Column(Float, nullable=True)
    down_time = Column(Float, nullable=True)
    planned_down_time = Column(Float, nullable=True)
    unplanned_down_time = Column(Float, nullable=True)
    total_produced = Column(Integer, nullable=True)
    scrap_qty = Column(Integer, nullable=True)

    is_valid = Column(Boolean, default=True, index=True)
    record_status = Column(String, default="valid", index=True) # "valid", "warning", "error"
    validation_errors = Column(Text, nullable=True)  # Hataları JSON string olarak tutacağız
    audit_trail = Column(Text, nullable=True)  # Düzenleme geçmişi (JSON formatında)

class SyncLog(Base):
    __tablename__ = "sync_logs"
    id = Column(Integer, primary_key=True, index=True)
    production_date = Column(String, index=True)
    shift = Column(Integer)
    payload = Column(Text)
    status_code = Column(Integer)
    response_data = Column(Text)
    is_success = Column(Boolean, default=False)
    timestamp = Column(DateTime, default=datetime.utcnow)