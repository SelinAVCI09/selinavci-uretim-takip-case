import json
from datetime import datetime
import pandas as pd
from fastapi import FastAPI, UploadFile, File, Depends, HTTPException
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