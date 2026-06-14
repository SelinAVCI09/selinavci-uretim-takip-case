from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import json
from datetime import datetime
import pandas as pd

from database import get_db
import models
from schemas import RecordUpdate
from services.validation_service import validate_row

router = APIRouter(tags=["2. Veri Doğrulama (Validation)"])

@router.post("/api/v1/revalidate", summary="Tüm Kayıtları Yeniden Doğrula", description="Mevcut tüm üretim kayıtlarını, güncellenmiş kalite kurallarına göre baştan test eder.")
async def revalidate_all(db: Session = Depends(get_db)):
    records = db.query(models.ProductionRecord).all()
    for record in records:
        row_dict = {c.name: getattr(record, c.name) for c in record.__table__.columns if hasattr(record, c.name)}
        errors = validate_row(row_dict)
        record.is_valid = len(errors) == 0
        if len(errors) == 0: record.record_status = "valid"
        elif any(isinstance(e, dict) and e.get("action") in ["reddet", "düzelt"] for e in errors): record.record_status = "error"
        else: record.record_status = "warning"
        record.validation_errors = json.dumps(errors, ensure_ascii=False) if errors else None
    db.commit()
    return {"message": "Tüm kayıtlar yeniden doğrulandı."}

@router.get("/api/v1/records", summary="Kayıtları Filtrele ve Listele")
async def get_records(is_valid: bool = None, record_status: str = None, db: Session = Depends(get_db)):
    query = db.query(models.ProductionRecord)
    if is_valid is not None: query = query.filter(models.ProductionRecord.is_valid == is_valid)
    if record_status is not None: query = query.filter(models.ProductionRecord.record_status == record_status)
    return query.limit(5000).all()

@router.put("/api/v1/records/{record_id}", summary="Kayıt Güncelle (Düzeltme Yap)")
async def update_record(record_id: int, update_data: RecordUpdate, db: Session = Depends(get_db)):
    record = db.query(models.ProductionRecord).filter(models.ProductionRecord.record_id == record_id).first()
    if not record: raise HTTPException(status_code=404, detail="Kayıt bulunamadı")
        
    update_dict = update_data.dict(exclude_unset=True)
    changes = []
    for key, value in update_dict.items():
        old_val = getattr(record, key)
        if key == "date" and value:
            try: 
                new_date = pd.to_datetime(value).date()
                if old_val != new_date:
                    changes.append({"field": key, "old": str(old_val), "new": str(new_date)})
                    setattr(record, key, new_date)
            except: pass
        else:
            if old_val != value:
                changes.append({"field": key, "old": old_val, "new": value})
                setattr(record, key, value)
                
    if changes:
        history = []
        if record.audit_trail:
            try: history = json.loads(record.audit_trail)
            except: pass
        history.append({"timestamp": datetime.utcnow().isoformat(), "changes": changes})
        record.audit_trail = json.dumps(history, ensure_ascii=False)
        
    row_dict = {c.name: getattr(record, c.name) for c in record.__table__.columns if hasattr(record, c.name)}
    errors = validate_row(row_dict)
    record.is_valid = len(errors) == 0
    
    if len(errors) == 0: record.record_status = "valid"
    elif any(isinstance(e, dict) and e.get("action") in ["reddet", "düzelt"] for e in errors): record.record_status = "error"
    else: record.record_status = "warning"
        
    record.validation_errors = json.dumps(errors, ensure_ascii=False) if errors else None
    db.commit()
    return {"message": "Kayıt güncellendi", "is_valid": record.is_valid, "errors": errors, "record_status": record.record_status, "audit_trail": json.loads(record.audit_trail) if record.audit_trail else []}

@router.delete("/api/v1/records/{record_id}", summary="Tekil Kayıt Sil (Reddet)")
async def delete_single_record(record_id: int, db: Session = Depends(get_db)):
    record = db.query(models.ProductionRecord).filter(models.ProductionRecord.record_id == record_id).first()
    if not record: raise HTTPException(status_code=404, detail="Kayıt bulunamadı")
    db.delete(record)
    db.commit()
    return {"message": "Kayıt silindi"}