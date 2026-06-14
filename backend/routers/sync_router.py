from fastapi import APIRouter, Depends, BackgroundTasks
from sqlalchemy.orm import Session
import json
import dotenv

from database import get_db
import models
import state
from schemas import SyncPayload, SyncSettingsUpdate
from services.sync_service import send_to_api_with_backoff, run_sync_task_batch, get_sync_preview_data

router = APIRouter(tags=["4. Hedef Sistem Senkronizasyonu"])

@router.post("/api/v1/sync/manual", summary="Tekil Vardiyayı Manuel Gönder")
def manual_sync(payload: SyncPayload, db: Session = Depends(get_db)):
    headers = {"X-Production-Key": state.API_KEY, "Content-Type": "application/json"}
    data_to_send = payload.dict(exclude={"machines"})
    full_data = payload.dict()
    try:
        resp = send_to_api_with_backoff(data_to_send, headers=headers)
        is_success = resp.status_code == 200
        log = models.SyncLog(production_date=full_data["production_date"], shift=full_data["shift"], payload=json.dumps(full_data), status_code=resp.status_code, response_data=resp.text, is_success=is_success)
        db.add(log)
        db.commit()
        return {"success": is_success, "status_code": resp.status_code, "message": resp.text}
    except Exception as e:
        log = models.SyncLog(production_date=full_data["production_date"], shift=full_data["shift"], payload=json.dumps(full_data), status_code=0, response_data=str(e), is_success=False)
        db.add(log)
        db.commit()
        return {"success": False, "status_code": 0, "message": str(e)}

@router.get("/api/v1/sync/preview", summary="Senkronizasyon Önizlemesini (Matris) Getir")
def get_sync_preview(db: Session = Depends(get_db)):
    return get_sync_preview_data(db)

@router.post("/api/v1/sync/start", summary="Toplu Arkaplan Senkronizasyonunu Başlat")
def start_sync(background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    if state.SYNC_STATE["is_syncing"]:
        return {"message": "Senkronizasyon halihazırda arka planda çalışıyor."}
    preview = get_sync_preview_data(db)
    to_sync = preview["pending_payloads"]
    if not to_sync:
        return {"message": "Senkronize edilecek yeni veya başarısız veri bulunamadı."}
    background_tasks.add_task(run_sync_task_batch, to_sync)
    return {"message": f"{len(to_sync)} vardiya özeti gönderim kuyruğuna alındı."}

@router.get("/api/v1/sync/status", summary="Arkaplan İşlem Durumunu Sorgula")
def sync_status():
    return state.SYNC_STATE

@router.get("/api/v1/sync/logs", summary="API Gönderim Geçmişini (Logları) Getir")
def sync_logs(db: Session = Depends(get_db)):
    logs = db.query(models.SyncLog).order_by(models.SyncLog.timestamp.desc()).limit(150).all()
    result = []
    for log in logs:
        parsed_payload = {}
        if log.payload:
            try: parsed_payload = json.loads(log.payload)
            except: pass
        result.append({"id": log.id, "production_date": log.production_date, "shift": log.shift, "status_code": log.status_code, "is_success": log.is_success, "response_data": log.response_data, "timestamp": log.timestamp.isoformat() + "Z" if log.timestamp else None, "payload": parsed_payload})
    return result

@router.delete("/api/v1/sync/logs", summary="API Loglarını Temizle")
def clear_sync_logs(db: Session = Depends(get_db)):
    db.query(models.SyncLog).delete()
    db.commit()
    return {"message": "Tüm loglar temizlendi."}

@router.get("/api/v1/sync/settings", summary="API Senkronizasyon Ayarlarını Getir")
def get_sync_settings():
    return {"api_key": state.API_KEY, "external_api_url": state.EXTERNAL_API_URL}

@router.put("/api/v1/sync/settings", summary="API Senkronizasyon Ayarlarını Güncelle")
def update_sync_settings(settings: SyncSettingsUpdate):
    state.API_KEY = settings.api_key
    state.EXTERNAL_API_URL = settings.external_api_url
    try: dotenv.set_key(state.env_path, "API_KEY", state.API_KEY); dotenv.set_key(state.env_path, "EXTERNAL_API_URL", state.EXTERNAL_API_URL)
    except Exception: pass
    return {"message": "API Ayarları başarıyla güncellendi.", "api_key": state.API_KEY, "external_api_url": state.EXTERNAL_API_URL}