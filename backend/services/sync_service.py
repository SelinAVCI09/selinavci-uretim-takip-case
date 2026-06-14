import json
import time
import requests
from datetime import datetime
from sqlalchemy.orm import Session
from database import SessionLocal
import models
import state

def send_to_api_with_backoff(payload, headers, max_retries=3):
    delay = 2
    for attempt in range(max_retries):
        try:
            resp = requests.post(state.EXTERNAL_API_URL, json=payload, headers=headers, timeout=20.0)
            if resp.status_code in [200, 422]:
                return resp
            if resp.status_code == 429:
                time.sleep(60)
                continue
            if attempt < max_retries - 1:
                time.sleep(delay)
                delay *= 2
        except Exception as e:
            if attempt == max_retries - 1:
                raise e
            time.sleep(delay)
            delay *= 2
    return resp

def run_sync_task_batch(groups_to_sync: list):
    state.SYNC_STATE["is_syncing"] = True
    state.SYNC_STATE["total"] = len(groups_to_sync)
    state.SYNC_STATE["processed"] = 0
    state.SYNC_STATE["success"] = 0
    state.SYNC_STATE["failed"] = 0
    
    db = SessionLocal()
    headers = {"X-Production-Key": state.API_KEY, "Content-Type": "application/json"}
    
    try:
        batch_size = 20
        batches = [groups_to_sync[i:i + batch_size] for i in range(0, len(groups_to_sync), batch_size)]
        
        for batch in batches:
            if not state.SYNC_STATE["is_syncing"]: break
            
            try:
                clean_batch = [{k: v for k, v in item.items() if k != "machines"} for item in batch]
                resp = send_to_api_with_backoff(clean_batch, headers=headers)
                
                if resp.status_code == 422:
                    for item, clean_item in zip(batch, clean_batch):
                        resp_single = send_to_api_with_backoff(clean_item, headers=headers)
                        is_success = resp_single.status_code == 200
                        log = models.SyncLog(production_date=item["production_date"], shift=item["shift"], payload=json.dumps(item), status_code=resp_single.status_code, response_data=resp_single.text, is_success=is_success)
                        db.add(log)
                        db.commit()
                        if is_success: state.SYNC_STATE["success"] += 1
                        else: state.SYNC_STATE["failed"] += 1
                        state.SYNC_STATE["processed"] += 1
                        time.sleep(1.0)
                    continue
                
                is_success = resp.status_code == 200
                for item in batch:
                    log = models.SyncLog(production_date=item["production_date"], shift=item["shift"], payload=json.dumps(item), status_code=resp.status_code, response_data=resp.text, is_success=is_success)
                    db.add(log)
                db.commit()
                
                if is_success: state.SYNC_STATE["success"] += len(batch)
                else: state.SYNC_STATE["failed"] += len(batch)
                state.SYNC_STATE["processed"] += len(batch)
                
            except Exception as e:
                for item in batch:
                    log = models.SyncLog(production_date=item["production_date"], shift=item["shift"], payload=json.dumps(item), status_code=0, response_data=str(e), is_success=False)
                    db.add(log)
                db.commit()
                state.SYNC_STATE["failed"] += len(batch)
                state.SYNC_STATE["processed"] += len(batch)
            
            time.sleep(0.5)
    finally:
        state.SYNC_STATE["is_syncing"] = False
        db.close()

def get_sync_preview_data(db: Session):
    total_records = db.query(models.ProductionRecord).count()
    valid_records = db.query(models.ProductionRecord).filter(models.ProductionRecord.is_valid == True).all()
    
    groups = {}
    for r in valid_records:
        if not r.date or r.shift is None: continue
        d_str = r.date.isoformat() if hasattr(r.date, "isoformat") else str(r.date)
        key = (d_str, r.shift)
        if key not in groups: groups[key] = []
        groups[key].append(r)
        
    success_logs = db.query(models.SyncLog).filter(models.SyncLog.is_success == True, models.SyncLog.timestamp >= state.LAST_IMPORT_TIME).order_by(models.SyncLog.timestamp.desc()).all()
    synced_payloads = {}
    for log in success_logs:
        key = (log.production_date, log.shift)
        if key not in synced_payloads:
            try: synced_payloads[key] = json.loads(log.payload) if log.payload else {}
            except: synced_payloads[key] = {}
    
    to_sync, all_payloads, raw_records_count = [], [], 0
    for (d, s), records in groups.items():
        machine_list = list(set(r.workstation_name for r in records if r.workstation_name))
        total_prod = sum(r.total_produced for r in records if r.total_produced is not None)
        valid_oees = [r.oee for r in records if r.oee is not None]
        avg_oee = sum(valid_oees) / len(valid_oees) if valid_oees else 0.0
        
        payload = {
            "machine_count": len(machine_list),
            "total_production_units": total_prod,
            "oe_value": round(avg_oee, 2),
            "shift": s,
            "production_date": d,
            "machines": machine_list
        }
        all_payloads.append(payload)
        
        is_already_synced = False
        if (d, s) in synced_payloads:
            last_synced = synced_payloads[(d, s)]
            if (last_synced.get("oe_value") == payload["oe_value"] and
                last_synced.get("total_production_units") == payload["total_production_units"] and
                last_synced.get("machine_count") == payload["machine_count"]):
                is_already_synced = True
                
        if not is_already_synced:
            to_sync.append(payload)
            raw_records_count += len(records)
        
    return {
        "pending_count": len(to_sync), 
        "pending_payloads": to_sync, 
        "pending_raw_records": raw_records_count, 
        "total_records": total_records, 
        "all_payloads": all_payloads,
        "session_start_time": state.LAST_IMPORT_TIME.isoformat() + "Z"
    }