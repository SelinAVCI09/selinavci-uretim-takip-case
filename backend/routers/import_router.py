from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from sqlalchemy.orm import Session
import pandas as pd
import json
from datetime import datetime

from database import get_db
import models
import state
from services.validation_service import EXPECTED_COLUMNS, validate_row

router = APIRouter(tags=["1. Veri İçe Aktarma ve Ayarlar"])

@router.post("/api/v1/upload-csv", summary="CSV Üretim Raporu Yükle", description="MES sisteminden alınan .csv formatındaki üretim raporunu yükler, okur ve kalite testinden geçirerek veritabanına kaydeder.")
async def upload_csv(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Lütfen sadece .csv formatında dosya yükleyin.")

    try:
        try:
            df = pd.read_csv(file.file, encoding='utf-8')
        except UnicodeDecodeError:
            file.file.seek(0)
            df = pd.read_csv(file.file, encoding='windows-1254')
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"CSV dosyası okunamadı: {str(e)}")

    if len(df.columns) != 18:
        raise HTTPException(status_code=400, detail="CSV formatı hatalı. Dosyanın 18 kolon içerdiğinden emin olun.")

    df.columns = EXPECTED_COLUMNS
    df = df.where(pd.notnull(df), None)

    state.LAST_IMPORT_TIME = datetime.utcnow()
    db.query(models.ProductionRecord).delete()
    db.commit()

    existing_ids = set()
    stats = {"total_rows": 0, "imported": 0, "duplicates": 0, "valid": 0, "warning": 0, "error": 0, "fix": 0, "reject": 0, "error_breakdown": {}}
    records_to_insert = []

    dict_records = df.to_dict('records')
    
    for record_dict in dict_records:
        stats["total_rows"] += 1
        if record_dict["record_id"] in existing_ids:
            stats["duplicates"] += 1
            continue
        existing_ids.add(record_dict["record_id"])

        errors = validate_row(record_dict)
        for err in errors:
            err_msg = err["message"] if isinstance(err, dict) else str(err)
            stats["error_breakdown"][err_msg] = stats["error_breakdown"].get(err_msg, 0) + 1
            
        if record_dict.get("date"): record_dict["date"] = pd.to_datetime(record_dict["date"]).date()
            
        is_valid = len(errors) == 0
        record_dict["is_valid"] = is_valid
        
        if is_valid:
            record_dict["record_status"] = "valid"
            stats["valid"] += 1
        elif any(isinstance(e, dict) and e.get("action") in ["reddet", "düzelt"] for e in errors):
            record_dict["record_status"] = "error"
            stats["error"] += 1
        else:
            record_dict["record_status"] = "warning"
            stats["warning"] += 1
            
        if not is_valid:
            has_reject = any(isinstance(e, dict) and e.get("action") == "reddet" for e in errors)
            has_fix = any(isinstance(e, dict) and e.get("action") == "düzelt" for e in errors)
            if has_reject: stats["reject"] += 1
            elif has_fix: stats["fix"] += 1
            
        record_dict["validation_errors"] = json.dumps(errors, ensure_ascii=False) if errors else None
        records_to_insert.append(models.ProductionRecord(**record_dict))
        stats["imported"] += 1

    db.add_all(records_to_insert)
    db.commit()
    return {"message": "CSV yükleme tamamlandı", "summary": stats}

@router.get("/api/v1/validation-settings", summary="Validasyon Kurallarını Getir")
async def get_validation_settings():
    return state.VALIDATION_SETTINGS

@router.put("/api/v1/validation-settings", summary="Validasyon Kurallarını Güncelle")
async def update_validation_settings(settings: dict):
    for k, v in settings.items():
        if k in state.VALIDATION_SETTINGS:
            if isinstance(v, bool):
                old_action = state.VALIDATION_SETTINGS[k]["action"] if isinstance(state.VALIDATION_SETTINGS[k], dict) else "uyar"
                state.VALIDATION_SETTINGS[k] = {"active": v, "action": old_action}
            else:
                state.VALIDATION_SETTINGS[k] = v
    return state.VALIDATION_SETTINGS

@router.delete("/api/v1/records", summary="Tüm Veritabanını Temizle")
async def clear_records(db: Session = Depends(get_db)):
    state.LAST_IMPORT_TIME = datetime.utcnow()
    db.query(models.ProductionRecord).delete()
    db.commit()
    return {"message": "Tüm kayıtlar başarıyla silindi."}