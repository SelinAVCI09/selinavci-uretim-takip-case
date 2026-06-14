from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
import json

from database import get_db
import models

router = APIRouter(tags=["3. Raporlar ve Gösterge Paneli"])

@router.get("/api/v1/stats", summary="Genel İstatistikleri Getir", description="Veritabanındaki kayıtların geçerli, uyarı ve hata durumlarına göre dağılım istatistiklerini döner.")
async def get_stats(db: Session = Depends(get_db)):
    total = db.query(models.ProductionRecord).count()
    valid = db.query(models.ProductionRecord).filter(models.ProductionRecord.is_valid == True).count()
    warning = db.query(models.ProductionRecord).filter(models.ProductionRecord.record_status == "warning").count()
    error = db.query(models.ProductionRecord).filter(models.ProductionRecord.record_status == "error").count()
    
    if valid == 0 and warning == 0 and error == 0:
        valid = db.query(models.ProductionRecord).filter(models.ProductionRecord.is_valid == True).count()
        error = db.query(models.ProductionRecord).filter(models.ProductionRecord.is_valid == False).count()
        
    suspicious_records = db.query(models.ProductionRecord).filter(models.ProductionRecord.is_valid == False).all()
    fix, reject = 0, 0
    for r in suspicious_records:
        if r.validation_errors:
            try:
                errors = json.loads(r.validation_errors)
                has_reject = any(isinstance(e, dict) and e.get("action") == "reddet" for e in errors)
                has_fix = any(isinstance(e, dict) and e.get("action") == "düzelt" for e in errors)
                if has_reject: reject += 1
                elif has_fix: fix += 1
            except: pass
                
    return {"total": total, "valid": valid, "warning": warning, "error": error, "fix": fix, "reject": reject}

@router.get("/api/v1/dashboard-data", summary="Dashboard Analitiklerini Getir")
async def get_dashboard_data(start_date: str = Query(None), end_date: str = Query(None), workstation: str = Query(None), db: Session = Depends(get_db)):
    global_total = db.query(models.ProductionRecord).count()
    query = db.query(models.ProductionRecord)
    if start_date: query = query.filter(models.ProductionRecord.date >= start_date)
    if end_date: query = query.filter(models.ProductionRecord.date <= end_date)
    if workstation: query = query.filter(models.ProductionRecord.workstation_name == workstation)
        
    records = query.all()
    valid_records = [r for r in records if r.is_valid]
    suspicious_records = [r for r in records if not r.is_valid]
    warning_records = [r for r in suspicious_records if getattr(r, "record_status", "") == "warning"]
    error_records = [r for r in suspicious_records if getattr(r, "record_status", "") not in ["valid", "warning"]]

    valid_oee_records = [r.oee for r in valid_records if r.oee is not None]
    avg_oee = sum(valid_oee_records) / len(valid_oee_records) if valid_oee_records else 0
    total_prod = sum([r.total_produced for r in records if r.total_produced is not None])
    total_scrap = sum([r.scrap_qty for r in records if r.scrap_qty is not None])
    total_down = sum([r.down_time for r in records if r.down_time is not None])

    last_record = sorted(valid_records, key=lambda x: (x.date.isoformat() if x.date else "", x.shift or 0), reverse=True) if valid_records else []
    last_shift_badge = {"date": "", "shift": "", "oee": 0, "total_produced": 0, "workstation": "Veri Yok"}
    if last_record:
        lr = last_record[0]
        last_shift_badge = {"date": lr.date.isoformat() if lr.date else "", "shift": lr.shift or "", "oee": lr.oee or 0, "total_produced": lr.total_produced or 0, "workstation": lr.workstation_name or "Bilinmiyor"}

    daily_oee = {}
    for r in valid_records:
        if r.date and r.oee is not None:
            d_str = r.date.isoformat()
            if d_str not in daily_oee: daily_oee[d_str] = []
            daily_oee[d_str].append(r.oee)
    trend_data = [{"date": k, "avg_oee": round(sum(v)/len(v), 2)} for k, v in sorted(daily_oee.items())]
    
    shift_perf = {}
    for r in valid_records:
        if r.shift is not None:
            if r.shift not in shift_perf: shift_perf[r.shift] = {"a": [], "p": [], "q": [], "oee": []}
            if r.availability is not None: shift_perf[r.shift]["a"].append(r.availability)
            if r.performance is not None: shift_perf[r.shift]["p"].append(r.performance)
            if r.quality is not None: shift_perf[r.shift]["q"].append(r.quality)
            if r.oee is not None: shift_perf[r.shift]["oee"].append(r.oee)
    shift_data = [{"shift": f"Vardiya {s}", "a": round(sum(data["a"])/len(data["a"]), 2) if data["a"] else 0, "p": round(sum(data["p"])/len(data["p"]), 2) if data["p"] else 0, "q": round(sum(data["q"])/len(data["q"]), 2) if data["q"] else 0, "oee": round(sum(data["oee"])/len(data["oee"]), 2) if data["oee"] else 0} for s, data in sorted(shift_perf.items())]
        
    ws_oee = {}
    for r in valid_records:
        if r.workstation_name and r.oee is not None:
            if r.workstation_name not in ws_oee: ws_oee[r.workstation_name] = []
            ws_oee[r.workstation_name].append(r.oee)
    ws_data = sorted([{"workstation": k, "avg_oee": round(sum(v)/len(v), 2)} for k, v in ws_oee.items()], key=lambda x: x["avg_oee"], reverse=True)
    
    planned_dt = sum([r.planned_down_time for r in records if r.planned_down_time is not None])
    unplanned_dt = sum([r.unplanned_down_time for r in records if r.unplanned_down_time is not None])
    downtime_data = [{"name": "Planlı Duruş", "value": round(planned_dt, 2), "color": "#3b82f6"}, {"name": "Plansız Duruş", "value": round(unplanned_dt, 2), "color": "#ef4444"}]
    
    a_vals, p_vals, q_vals = [r.availability for r in valid_records if r.availability is not None], [r.performance for r in valid_records if r.performance is not None], [r.quality for r in valid_records if r.quality is not None]
    avg_a, avg_p, avg_q = sum(a_vals)/len(a_vals) if a_vals else 0, sum(p_vals)/len(p_vals) if p_vals else 0, sum(q_vals)/len(q_vals) if q_vals else 0
    availability_loss = 100 - avg_a
    performance_loss = avg_a * (1 - avg_p/100) if avg_a and avg_p else 0
    quality_loss = avg_a * (avg_p/100) * (1 - avg_q/100) if avg_a and avg_p and avg_q else 0
    waterfall_data = [{"name": "İdeal OEE", "start": 0, "val": 100, "fill": "#10b981"}, {"name": "A Kaybı", "start": max(0, 100 - availability_loss), "val": round(availability_loss, 2), "fill": "#ef4444"}, {"name": "P Kaybı", "start": max(0, 100 - availability_loss - performance_loss), "val": round(performance_loss, 2), "fill": "#f97316"}, {"name": "Q Kaybı", "start": max(0, avg_oee), "val": round(quality_loss, 2), "fill": "#eab308"}, {"name": "Gerçekleşen", "start": 0, "val": round(avg_oee, 2), "fill": "#3b82f6"}]
    
    scrap_ws = {}
    for r in records:
        if r.scrap_qty is not None and r.scrap_qty > 0:
            ws_name = r.workstation_name if r.workstation_name else "Belirtilmemiş"
            scrap_ws[ws_name] = scrap_ws.get(ws_name, 0) + r.scrap_qty
    scrap_distribution = [{"name": k, "value": v} for k, v in sorted(scrap_ws.items(), key=lambda x: x[1], reverse=True)]
    
    anomaly_counts = {}
    for r in suspicious_records:
        if r.validation_errors:
            try:
                errors = json.loads(r.validation_errors)
                for e in errors:
                    err_msg = e["message"] if isinstance(e, dict) else str(e)
                    anomaly_counts[err_msg] = anomaly_counts.get(err_msg, 0) + 1
            except: pass
    anomaly_data = [{"error": k, "count": v} for k, v in anomaly_counts.items()]
    target_prod = total_prod + total_scrap + (total_prod * (100 - avg_oee) / 100 if avg_oee else 0)
    
    return {"kpis": {"avg_oee": round(avg_oee, 2), "total_produced": total_prod, "total_scrap": total_scrap, "total_downtime": round(total_down, 2)}, "last_shift": last_shift_badge, "trend": trend_data, "shift_performance": shift_data, "workstation_oee": ws_data, "downtime": downtime_data, "waterfall": waterfall_data, "scrap_distribution": scrap_distribution, "anomalies": anomaly_data, "suspicious_count": len(suspicious_records), "warning_count": len(warning_records), "error_count": len(error_records), "total_records": len(records), "global_total_records": global_total, "target_actual": {"target": round(target_prod), "actual": total_prod}, "table_data": [{"id": r.record_id, "date": r.date.isoformat() if r.date else "", "shift": r.shift or 0, "workstation": r.workstation_name or "Bilinmiyor", "work_time": r.work_time or 0, "down_time": r.down_time or 0, "total_produced": r.total_produced or 0, "scrap_qty": r.scrap_qty or 0, "a": r.availability or 0, "p": r.performance or 0, "q": r.quality or 0, "oee": r.oee or 0, "is_valid": r.is_valid, "record_status": getattr(r, "record_status", "valid")} for r in records[:50]], "workstations": list(set([r.workstation_name for r in records if r.workstation_name]))}