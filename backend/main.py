import json
from datetime import datetime
import pandas as pd
from fastapi import FastAPI, UploadFile, File, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from database import engine, SessionLocal, Base
import models

# Veritabanı tablolarını oluştur
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Magna Üretim Takip API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Geliştirme ortamı için tüm originlere izin veriyoruz
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# CSV'de karakter hataları olabileceği için kolon isimlerini direkt index mantığıyla mapliyoruz
EXPECTED_COLUMNS = [
    "record_id", "date", "work_order_no", "work_center_no", "work_center_name",
    "workstation_name", "stock_name", "shift", "availability", "performance",
    "quality", "oee", "work_time", "down_time", "planned_down_time",
    "unplanned_down_time", "total_produced", "scrap_qty"
]

def validate_row(row):
    """
    Her bir satır için Case Study'de istenilen kurallara göre validasyon yapar.
    Hata listesini döner. Hata yoksa boş liste döner.
    """
    errors = []
    
    # 1. Eksik / Boş / Format Veri Kontrolü
    wo_no = str(row.get("work_order_no", ""))
    if pd.isna(row.get("work_order_no")) or not wo_no.strip():
        errors.append("İş Emri No eksik.")
    else:
        # ".0" gibi float'a dönmüş stringleri temizliyoruz (Pandas bazen dönüştürür)
        wo_clean = wo_no.split('.')[0] 
        if not wo_clean.startswith("302") or len(wo_clean) != 10:
            errors.append("İş Emri No formatı hatalı (302 ile başlayan 10 hane olmalı).")

    shift = row.get("shift")
    if pd.isna(shift) or shift not in [1, 2, 3]:
        errors.append("Geçersiz Vardiya değeri (1, 2 veya 3 olmalı).")

    # 2. Üretim Miktarı ve Fire İlişkisi
    total_prod = row.get("total_produced")
    scrap = row.get("scrap_qty")
    
    if pd.isna(total_prod) or total_prod < 0:
        errors.append("Üretilen Miktar eksik veya sıfırdan küçük olamaz.")
    if not pd.isna(scrap) and scrap < 0:
        errors.append("Hatalı Üretilen Miktar negatif olamaz.")
        
    if not pd.isna(total_prod) and not pd.isna(scrap):
        if scrap > total_prod:
            errors.append("Mantıksal Hata: Hatalı üretilen miktar, toplam üretimden büyük olamaz.")

    # 3. Yüzde Aralık Kontrolleri (0 - 100)
    for col_key, col_name in [("availability", "Kullanılabilirlik (A)"), 
                              ("quality", "Kalite (Q)"), 
                              ("oee", "OEE")]:
        val = row.get(col_key)
        if not pd.isna(val) and (val < 0 or val > 100):
            errors.append(f"{col_name} değeri 0-100 aralığında olmalıdır.")
            
    # 4. Sürelerin Tutarlılığı (Duruş = Planlı + Plansız)
    dt = row.get("down_time") or 0.0
    p_dt = row.get("planned_down_time") or 0.0
    up_dt = row.get("unplanned_down_time") or 0.0
    
    if not pd.isna(row.get("down_time")):
        # Float noktası karşılaştırması için küçük bir tolerans (0.01) bırakıyoruz
        if abs(dt - (p_dt + up_dt)) > 0.01:
            errors.append("Süre Tutarsızlığı: Toplam Duruş, Planlı ve Plansız duruşların toplamına eşit değil.")
            
    # 5. Tarih Kontrolü
    if not pd.isna(row.get("date")):
        try:
            date_obj = pd.to_datetime(row["date"]).date()
            if date_obj > datetime.utcnow().date():
                errors.append("Üretim tarihi bugünden ileri bir tarih (gelecek) olamaz.")
        except Exception:
            errors.append("Geçersiz tarih formatı.")

    return errors

@app.post("/api/v1/upload-csv")
async def upload_csv(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Lütfen sadece .csv formatında dosya yükleyin.")

    try:
        # Pandas ile CSV okuma. Önce utf-8 dener, karakter hatası alırsa Türkçe format dener.
        try:
            df = pd.read_csv(file.file, encoding='utf-8')
        except UnicodeDecodeError:
            file.file.seek(0) # Dosya imlecini başa sar
            df = pd.read_csv(file.file, encoding='windows-1254')
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"CSV dosyası okunamadı: {str(e)}")

    if len(df.columns) != 18:
        raise HTTPException(status_code=400, detail="CSV formatı hatalı. Dosyanın 18 kolon içerdiğinden emin olun.")

    df.columns = EXPECTED_COLUMNS
    # Veritabanına kolay eklemek için NaN değerleri None'a çeviriyoruz
    df = df.where(pd.notnull(df), None)

    # Duplicate (Çift) Kayıtları engellemek için mevcut ID'leri alalım
    existing_ids = {r[0] for r in db.query(models.ProductionRecord.record_id).all()}

    stats = {"total_rows": 0, "imported": 0, "duplicates": 0, "valid": 0, "suspicious": 0, "error_breakdown": {}}
    records_to_insert = []

    for idx, row in df.iterrows():
        stats["total_rows"] += 1
        record_dict = row.to_dict()
        
        if record_dict["record_id"] in existing_ids:
            stats["duplicates"] += 1
            continue

        # Satır validasyonu
        errors = validate_row(record_dict)
        
        for err in errors:
            stats["error_breakdown"][err] = stats["error_breakdown"].get(err, 0) + 1
            
        if row.get("date"):
            record_dict["date"] = pd.to_datetime(row["date"]).date()
            
        record_dict["is_valid"] = len(errors) == 0
        record_dict["validation_errors"] = json.dumps(errors, ensure_ascii=False) if errors else None
        
        records_to_insert.append(models.ProductionRecord(**record_dict))
        stats["valid" if record_dict["is_valid"] else "suspicious"] += 1
        stats["imported"] += 1

    db.add_all(records_to_insert)
    db.commit()

    return {"message": "CSV yükleme tamamlandı", "summary": stats}

@app.get("/api/v1/records")
async def get_records(is_valid: bool = None, db: Session = Depends(get_db)):
    """
    Veritabanındaki kayıtları getirir. is_valid parametresi ile filtrelenebilir.
    """
    query = db.query(models.ProductionRecord)
    if is_valid is not None:
        query = query.filter(models.ProductionRecord.is_valid == is_valid)
    return query.limit(5000).all() # Frontend'de rahat filtreleme için limiti artırdık

@app.delete("/api/v1/records")
async def clear_records(db: Session = Depends(get_db)):
    """
    Veritabanındaki tüm kayıtları siler (UI'dan dosya kaldırıldığında temizlik için).
    """
    db.query(models.ProductionRecord).delete()
    db.commit()
    return {"message": "Tüm kayıtlar başarıyla silindi."}

@app.get("/api/v1/stats")
async def get_stats(db: Session = Depends(get_db)):
    """Veritabanındaki güncel kayıt istatistiklerini döner."""
    total = db.query(models.ProductionRecord).count()
    valid = db.query(models.ProductionRecord).filter(models.ProductionRecord.is_valid == True).count()
    suspicious = db.query(models.ProductionRecord).filter(models.ProductionRecord.is_valid == False).count()
    return {"total": total, "valid": valid, "suspicious": suspicious}

@app.get("/api/v1/dashboard-data")
async def get_dashboard_data(
    start_date: str = Query(None), 
    end_date: str = Query(None), 
    workstation: str = Query(None), 
    db: Session = Depends(get_db)
):
    global_total = db.query(models.ProductionRecord).count()
    query = db.query(models.ProductionRecord)
    if start_date:
        query = query.filter(models.ProductionRecord.date >= start_date)
    if end_date:
        query = query.filter(models.ProductionRecord.date <= end_date)
    if workstation:
        query = query.filter(models.ProductionRecord.workstation_name == workstation)
        
    records = query.all()
    valid_records = [r for r in records if r.is_valid]
    suspicious_records = [r for r in records if not r.is_valid]
    
    valid_oee_records = [r.oee for r in valid_records if r.oee is not None]
    avg_oee = sum(valid_oee_records) / len(valid_oee_records) if valid_oee_records else 0
    
    total_prod = sum([r.total_produced for r in records if r.total_produced is not None])
    total_scrap = sum([r.scrap_qty for r in records if r.scrap_qty is not None])
    total_down = sum([r.down_time for r in records if r.down_time is not None])

    last_record = sorted(valid_records, key=lambda x: (x.date.isoformat() if x.date else "", x.shift or 0), reverse=True) if valid_records else []
    last_shift_badge = None
    if last_record:
        lr = last_record[0]
        last_shift_badge = {
            "date": lr.date.isoformat() if lr.date else None,
            "shift": lr.shift,
            "oee": lr.oee,
            "total_produced": lr.total_produced,
            "workstation": lr.workstation_name
        }

    daily_oee = {}
    for r in valid_records:
        if r.date and r.oee is not None:
            d_str = r.date.isoformat()
            if d_str not in daily_oee:
                daily_oee[d_str] = []
            daily_oee[d_str].append(r.oee)
            
    trend_data = [{"date": k, "avg_oee": round(sum(v)/len(v), 2)} for k, v in sorted(daily_oee.items())]
    
    shift_perf = {}
    for r in valid_records:
        if r.shift is not None:
            if r.shift not in shift_perf:
                shift_perf[r.shift] = {"a": [], "p": [], "q": [], "oee": []}
            if r.availability is not None: shift_perf[r.shift]["a"].append(r.availability)
            if r.performance is not None: shift_perf[r.shift]["p"].append(r.performance)
            if r.quality is not None: shift_perf[r.shift]["q"].append(r.quality)
            if r.oee is not None: shift_perf[r.shift]["oee"].append(r.oee)
            
    shift_data = []
    for s, data in sorted(shift_perf.items()):
        shift_data.append({
            "shift": f"Vardiya {s}",
            "a": round(sum(data["a"])/len(data["a"]), 2) if data["a"] else 0,
            "p": round(sum(data["p"])/len(data["p"]), 2) if data["p"] else 0,
            "q": round(sum(data["q"])/len(data["q"]), 2) if data["q"] else 0,
            "oee": round(sum(data["oee"])/len(data["oee"]), 2) if data["oee"] else 0
        })
        
    ws_oee = {}
    for r in valid_records:
        if r.workstation_name and r.oee is not None:
            if r.workstation_name not in ws_oee:
                ws_oee[r.workstation_name] = []
            ws_oee[r.workstation_name].append(r.oee)
            
    ws_data = [{"workstation": k, "avg_oee": round(sum(v)/len(v), 2)} for k, v in ws_oee.items()]
    ws_data = sorted(ws_data, key=lambda x: x["avg_oee"], reverse=True)
    
    planned_dt = sum([r.planned_down_time for r in records if r.planned_down_time is not None])
    unplanned_dt = sum([r.unplanned_down_time for r in records if r.unplanned_down_time is not None])
    downtime_data = [
        {"name": "Planlı Duruş", "value": round(planned_dt, 2), "color": "#3b82f6"},
        {"name": "Plansız Duruş", "value": round(unplanned_dt, 2), "color": "#ef4444"}
    ]
    
    a_vals = [r.availability for r in valid_records if r.availability is not None]
    p_vals = [r.performance for r in valid_records if r.performance is not None]
    q_vals = [r.quality for r in valid_records if r.quality is not None]
    
    avg_a = sum(a_vals)/len(a_vals) if a_vals else 0
    avg_p = sum(p_vals)/len(p_vals) if p_vals else 0
    avg_q = sum(q_vals)/len(q_vals) if q_vals else 0
    
    availability_loss = 100 - avg_a
    performance_loss = avg_a * (1 - avg_p/100) if avg_a and avg_p else 0
    quality_loss = avg_a * (avg_p/100) * (1 - avg_q/100) if avg_a and avg_p and avg_q else 0
    
    waterfall_data = [
        {"name": "İdeal OEE", "start": 0, "val": 100, "fill": "#10b981"},
        {"name": "A Kaybı", "start": max(0, 100 - availability_loss), "val": round(availability_loss, 2), "fill": "#ef4444"},
        {"name": "P Kaybı", "start": max(0, 100 - availability_loss - performance_loss), "val": round(performance_loss, 2), "fill": "#f97316"},
        {"name": "Q Kaybı", "start": max(0, avg_oee), "val": round(quality_loss, 2), "fill": "#eab308"},
        {"name": "Gerçekleşen", "start": 0, "val": round(avg_oee, 2), "fill": "#3b82f6"}
    ]
    
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
                    anomaly_counts[e] = anomaly_counts.get(e, 0) + 1
            except:
                pass
    anomaly_data = [{"error": k, "count": v} for k, v in anomaly_counts.items()]
    
    target_prod = total_prod + total_scrap + (total_prod * (100 - avg_oee) / 100 if avg_oee else 0)
    
    return {
        "kpis": {
            "avg_oee": round(avg_oee, 2),
            "total_produced": total_prod,
            "total_scrap": total_scrap,
            "total_downtime": round(total_down, 2)
        },
        "last_shift": last_shift_badge,
        "trend": trend_data,
        "shift_performance": shift_data,
        "workstation_oee": ws_data,
        "downtime": downtime_data,
        "waterfall": waterfall_data,
        "scrap_distribution": scrap_distribution,
        "anomalies": anomaly_data,
        "suspicious_count": len(suspicious_records),
        "total_records": len(records),
        "global_total_records": global_total,
        "target_actual": {
            "target": round(target_prod),
            "actual": total_prod
        },
        "table_data": [
            {
                "id": r.record_id,
                "date": r.date.isoformat() if r.date else None,
                "shift": r.shift,
                "workstation": r.workstation_name,
                "work_time": r.work_time,
                "down_time": r.down_time,
                "total_produced": r.total_produced,
                "scrap_qty": r.scrap_qty,
                "a": r.availability,
                "p": r.performance,
                "q": r.quality,
                "oee": r.oee,
                "is_valid": r.is_valid
            } for r in records[:50]
        ],
        "workstations": list(set([r.workstation_name for r in records if r.workstation_name]))
    }