import json
from datetime import datetime
import pandas as pd
from typing import Optional
from pydantic import BaseModel, Field
from fastapi import FastAPI, UploadFile, File, Depends, HTTPException, Query, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text
import requests
import os
import time
from dotenv import load_dotenv

from database import engine, SessionLocal, Base
import models

# .env dosyası ana dizinde olduğu için tam yolunu belirtiyoruz
env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
load_dotenv(dotenv_path=env_path)

API_KEY = os.getenv("API_KEY", "cand-selin-avci-80ch1b7u")
EXTERNAL_API_URL = os.getenv("EXTERNAL_API_URL", "http://89.252.189.91:8983/api/v1/submit")

# Senkronizasyon (Hedef Sistem) Logları
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

# Veritabanı tablolarını oluştur
Base.metadata.create_all(bind=engine)

tags_metadata = [
    {"name": "1. Veri İçe Aktarma ve Ayarlar", "description": "CSV verilerinin yüklenmesi ve sistem kalite kurallarının yönetimi."},
    {"name": "2. Veri Doğrulama (Validation)", "description": "Şüpheli kayıtların incelenmesi, güncellenmesi, silinmesi ve yeniden doğrulanması işlemleri."},
    {"name": "3. Raporlar ve Gösterge Paneli", "description": "Dashboard için OEE, fire ve duruş analizi istatistiklerinin çekilmesi."},
    {"name": "4. Hedef Sistem Senkronizasyonu", "description": "Temiz kayıtların Magna hedef REST API'sine gönderimi, Idempotency ve log takibi."}
]

app = FastAPI(
    title="Magna Üretim Takip REST API",
    description="Bu API; üretim raporlarını alır, kalite kurallarına göre doğrular ve başarılı olanları Magna hedef sistemine aktarır.",
    version="1.0.0",
    openapi_tags=tags_metadata
)

# Yeni CSV Yüklemelerini ve Sunucu Başlangıçlarını ayırmak için Oturum Zaman Damgası
LAST_IMPORT_TIME = datetime.utcnow()

@app.on_event("startup")
def clear_old_csv_records():
    """
    Backend baştan başlatıldığında önceki oturumdan kalan CSV kayıtlarını temizler.
    Ancak dış sisteme atılan API loglarını (SyncLog) geçmişi görmek adına kalıcı tutar.
    """
    global LAST_IMPORT_TIME
    LAST_IMPORT_TIME = datetime.utcnow()
    db = SessionLocal()
    try:
        db.query(models.ProductionRecord).delete()
        db.commit()
    finally:
        db.close()

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

class RecordUpdate(BaseModel):
    date: Optional[str] = None
    work_order_no: Optional[str] = None
    work_center_no: Optional[str] = None
    work_center_name: Optional[str] = None
    workstation_name: Optional[str] = None
    stock_name: Optional[str] = None
    shift: Optional[int] = None
    availability: Optional[float] = None
    performance: Optional[float] = None
    quality: Optional[float] = None
    oee: Optional[float] = None
    work_time: Optional[float] = None
    down_time: Optional[float] = None
    planned_down_time: Optional[float] = None
    unplanned_down_time: Optional[float] = None
    total_produced: Optional[int] = None
    scrap_qty: Optional[int] = None

    class Config:
        schema_extra = {
            "example": {
                "work_order_no": "3021234567",
                "shift": 1,
                "workstation_name": "IMM-2700-1",
                "total_produced": 4500,
                "scrap_qty": 20,
                "oee": 87.3,
                "work_time": 480
            }
        }

class SyncPayload(BaseModel):
    machine_count: int = Field(..., description="Vardiyada aktif makine sayısı", example=12)
    total_production_units: int = Field(..., description="Toplam üretim adedi", example=4500)
    oe_value: float = Field(..., description="Ekipman verimliliği (yüzde 0-100)", example=87.3)
    shift: int = Field(..., description="Vardiya (1=Sabah, 2=Öğle, 3=Gece)", example=1)
    production_date: str = Field(..., description="Üretim tarihi (YYYY-MM-DD)", example="2026-05-07")
    machines: list = Field(default=[], description="UI gösterimi için paket içindeki makineler listesi")

class SyncSettingsUpdate(BaseModel):
    api_key: str = Field(..., description="Magna API Key")
    external_api_url: str = Field(..., description="Hedef URL Endpoint'i")

# CSV'de karakter hataları olabileceği için kolon isimlerini direkt index mantığıyla mapliyoruz
EXPECTED_COLUMNS = [
    "record_id", "date", "work_order_no", "work_center_no", "work_center_name",
    "workstation_name", "stock_name", "shift", "availability", "performance",
    "quality", "oee", "work_time", "down_time", "planned_down_time",
    "unplanned_down_time", "total_produced", "scrap_qty"
]

# Validasyon Kuralları Ayarları (Aktif/Pasif Durumları)
VALIDATION_SETTINGS = {
    "missing_wo": True,
    "format_wo": True,
    "invalid_shift": True,
    "missing_ws": True,
    "negative_prod": True,
    "scrap_gt_prod": True,
    "out_of_range_pct": True,
    "capacity_exceed": True,
    "downtime_mismatch": True,
    "downtime_gt_worktime": True,
    "prod_zero_worktime": True,
    "avail_100_with_downtime": True,
    "invalid_date": True,
    "oee_mismatch": True
}

def validate_row(row):
    """
    Her bir satır için Case Study'de istenilen kurallara göre validasyon yapar.
    Aktif olan ayarlara (VALIDATION_SETTINGS) göre hata listesini döner.
    """
    errors = []
    
    # 1. Eksik / Boş / Format Veri Kontrolü (Zorunlu Alanlar)
    wo_no = str(row.get("work_order_no", ""))
    if VALIDATION_SETTINGS["missing_wo"] and (pd.isna(row.get("work_order_no")) or not wo_no.strip() or wo_no.lower() == "nan"):
        errors.append({"field": "work_order_no", "error_type": "Eksik Veri", "message": "İş Emri No boş bırakılamaz.", "reason": "İzlenebilirlik yapılamaz.", "action": "reddet"})
    elif VALIDATION_SETTINGS["format_wo"] and not pd.isna(row.get("work_order_no")):
        wo_clean = wo_no.split('.')[0]
        if len(wo_clean) > 0 and (not wo_clean.startswith("302") or len(wo_clean) != 10):
            errors.append({"field": "work_order_no", "error_type": "Format Hatası", "message": f"İş Emri No formatı hatalı: {wo_clean}", "reason": "İş emri '302' ile başlamalı ve 10 hane olmalıdır.", "action": "düzelt"})

    shift = row.get("shift")
    if VALIDATION_SETTINGS["invalid_shift"] and (pd.isna(shift) or shift not in [1, 2, 3]):
        errors.append({"field": "shift", "error_type": "Kritik Değer Hatası", "message": f"Geçersiz Vardiya: {shift}", "reason": "Vardiya 1, 2 veya 3 olmalıdır.", "action": "düzelt"})

    if VALIDATION_SETTINGS["missing_ws"] and (pd.isna(row.get("workstation_name")) or not str(row.get("workstation_name")).strip()):
        errors.append({"field": "workstation_name", "error_type": "Eksik Veri", "message": "İş İstasyonu bilgisi eksik.", "reason": "Performans ölçümü istasyon bazlı yapıldığı için bu alan zorunludur.", "action": "reddet"})

    # 2. Üretim Miktarı ve Fire İlişkisi
    total_prod = row.get("total_produced")
    scrap = row.get("scrap_qty")
    
    if VALIDATION_SETTINGS["negative_prod"]:
        # Magna API kuralı: Toplam üretim adedi 1 - 1.000.000 arası olmalıdır
        if pd.isna(total_prod) or total_prod < 1:
            errors.append({"field": "total_produced", "error_type": "Geçersiz Miktar", "message": "Üretilen miktar en az 1 olmalıdır.", "reason": "Hedef sistem (Magna API) 0 veya negatif üretim değerlerini kabul etmez.", "action": "düzelt"})
        if not pd.isna(scrap) and scrap < 0:
            errors.append({"field": "scrap_qty", "error_type": "Mantıksal Hata", "message": "Fire miktarı negatif olamaz.", "reason": "Hatalı ürün adedi eksi değer alamaz.", "action": "düzelt"})
        
    if VALIDATION_SETTINGS["scrap_gt_prod"] and not pd.isna(total_prod) and not pd.isna(scrap) and total_prod >= 0 and scrap >= 0:
        if scrap > total_prod:
            errors.append({"field": "scrap_qty, total_produced", "error_type": "Tutarsızlık", "message": "Fire miktarı, toplam üretimden büyük.", "reason": "Hatalı üretilen ürün sayısı, üretilen toplam parçadan fazla olamaz.", "action": "düzelt"})

    # 3. Yüzde Aralık Kontrolleri (0 - 100)
    if VALIDATION_SETTINGS["out_of_range_pct"]:
        for col_key, col_name in [("availability", "Kullanılabilirlik (A)"), ("quality", "Kalite (Q)"), ("oee", "OEE")]:
            val = row.get(col_key)
            if not pd.isna(val) and (val < 0 or val > 100):
                errors.append({"field": col_key, "error_type": "Aralık Hatası", "message": f"{col_name} değeri %0-100 dışında ({val}).", "reason": "Yüzdelik metrikler 0 ile 100 arasında olmalıdır.", "action": "düzelt"})
                
        perf = row.get("performance")
        if not pd.isna(perf):
            if perf < 0:
                errors.append({"field": "performance", "error_type": "Aralık Hatası", "message": f"Performans negatif olamaz ({perf}).", "reason": "Performans değeri 0'dan küçük olamaz.", "action": "düzelt"})
            elif VALIDATION_SETTINGS["capacity_exceed"] and perf > 100:
                errors.append({"field": "performance", "error_type": "Kapasite Aşımı Uyarısı", "message": f"Performans %100'ün üzerinde ({perf}).", "reason": "Teorik hedeflerden daha hızlı çalışılmış olabilir.", "action": "uyar"})
            
    # 4. Sürelerin Tutarlılığı (Duruş = Planlı + Plansız)
    dt = row.get("down_time") or 0.0
    p_dt = row.get("planned_down_time") or 0.0
    up_dt = row.get("unplanned_down_time") or 0.0
    wt = row.get("work_time") or 0.0
    
    if VALIDATION_SETTINGS["downtime_mismatch"]:
        if not pd.isna(row.get("down_time")):
            if abs(dt - (p_dt + up_dt)) > 0.1:
                errors.append({"field": "down_time", "error_type": "Tutarsızlık", "message": f"Duruş süreleri tutarsız (Planlı: {p_dt} + Plansız: {up_dt} != Toplam: {dt}).", "reason": "Alt duruş kırılımlarının toplamı, genel duruş süresine eşit olmalıdır.", "action": "düzelt"})

    if VALIDATION_SETTINGS["downtime_gt_worktime"] and dt > wt and wt > 0:
        errors.append({"field": "down_time, work_time", "error_type": "Mantıksal Hata", "message": "Toplam Duruş, Çalışma Süresinden büyük.", "reason": "Makine, vardiya süresinden daha uzun süre duruş kaydedemez.", "action": "düzelt"})

    # 5. Domain & Fiziksel Kurallar
    if VALIDATION_SETTINGS["prod_zero_worktime"] and (total_prod or 0) > 0 and wt <= 0:
        errors.append({"field": "total_produced, work_time", "error_type": "Fiziksel İmkansızlık", "message": "Çalışma süresi 0 iken üretim raporlanmış.", "reason": "Makine çalışmadan parça üretemez. Süre kaydı eksik olabilir.", "action": "düzelt"})

    a = row.get("availability")
    if VALIDATION_SETTINGS["avail_100_with_downtime"] and dt > 0 and a == 100.0:
        errors.append({"field": "availability, down_time", "error_type": "Mantıksal Hata", "message": "Duruş varken Kullanılabilirlik %100.", "reason": "Duruş yaşandığında Kullanılabilirlik metriginin (A) %100'den düşük olması gerekir.", "action": "düzelt"})

    # 6. Tarih Kontrolü
    if VALIDATION_SETTINGS["invalid_date"]:
        if pd.isna(row.get("date")):
            errors.append({"field": "date", "error_type": "Eksik Veri", "message": "Üretim tarihi eksik.", "reason": "Kayıtların zaman çizelgesine eklenebilmesi için tarih zorunludur.", "action": "reddet"})
        else:
            try:
                date_val = row.get("date")
                date_obj = pd.to_datetime(date_val).date() if hasattr(date_val, "date") else pd.to_datetime(date_val).date()
                if date_obj > datetime.utcnow().date():
                    errors.append({"field": "date", "error_type": "Mantıksal Hata", "message": f"Tarih gelecekte ({date_obj}).", "reason": "Gelecek bir tarihe gerçekleşmiş üretim kaydı girilemez.", "action": "düzelt"})
            except Exception:
                errors.append({"field": "date", "error_type": "Format Hatası", "message": "Geçersiz tarih formatı.", "reason": "Sistem tarihi algılayamadı.", "action": "reddet"})

    # 7. Ek OEE ve Kapasite Kontrolleri
    p = row.get("performance")
    q = row.get("quality")
    oee = row.get("oee")
    if VALIDATION_SETTINGS["oee_mismatch"] and not pd.isna(a) and not pd.isna(p) and not pd.isna(q) and not pd.isna(oee):
        calc_oee = (a / 100) * (p / 100) * (q / 100) * 100
        if abs(calc_oee - oee) > 1.0: 
            errors.append({"field": "oee", "error_type": "Matematiksel Tutarsızlık", "message": f"OEE Hatalı Hesaplanmış (Raporlanan: {oee}, Beklenen: {round(calc_oee,1)}).", "reason": "OEE değeri her zaman Kullanılabilirlik * Performans * Kalite çarpımına eşit olmalıdır.", "action": "düzelt"})

    return errors

# Exponential Backoff / Circuit Breaker Algoritması
def send_to_api_with_backoff(payload, headers, max_retries=3):
    delay = 2 # Başlangıç bekleme süresi (saniye)
    for attempt in range(max_retries):
        try:
            resp = requests.post(EXTERNAL_API_URL, json=payload, headers=headers, timeout=20.0)
            # Başarılı veya Validasyon (422) hatası ise doğrudan dön (tekrar denemeye gerek yok)
            if resp.status_code in [200, 422]:
                return resp
            # 429 Rate Limit veya 5xx Server Error ise katlanarak bekle
            if resp.status_code == 429:
                time.sleep(60) # API Kuralı: 429 alınca tam 1 dakika bekle
                continue
                
            if attempt < max_retries - 1:
                time.sleep(delay)
                delay *= 2
        except Exception as e:
            if attempt == max_retries - 1:
                # Son deneme de başarısız olursa hatayı fırlat
                raise e
            time.sleep(delay)
            delay *= 2
    return resp

@app.post("/api/v1/upload-csv", tags=["1. Veri İçe Aktarma ve Ayarlar"], summary="CSV Üretim Raporu Yükle", description="MES sisteminden alınan .csv formatındaki üretim raporunu yükler, okur ve kalite testinden geçirerek veritabanına kaydeder.")
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

    # YENİ CSV YÜKLENDİĞİNDE ESKİ KAYITLARI TEMİZLE VE OTURUMU SIFIRLA
    global LAST_IMPORT_TIME
    LAST_IMPORT_TIME = datetime.utcnow()
    db.query(models.ProductionRecord).delete()
    db.commit()

    # Yüklenen CSV'nin kendi içindeki çift kayıtları yakalamak için boş küme
    existing_ids = set()

    stats = {"total_rows": 0, "imported": 0, "duplicates": 0, "valid": 0, "warning": 0, "error": 0, "error_breakdown": {}}
    records_to_insert = []

    # Performans İyileştirmesi: 100K+ satırlık verilerde df.iterrows() çok yavaştır.
    # to_dict('records') ile veriler bellekte çok daha hızlı işlenir.
    dict_records = df.to_dict('records')
    
    for record_dict in dict_records:
        stats["total_rows"] += 1
        
        if record_dict["record_id"] in existing_ids:
            stats["duplicates"] += 1
            continue
        existing_ids.add(record_dict["record_id"])

        # Satır validasyonu
        errors = validate_row(record_dict)
        
        for err in errors:
            err_msg = err["message"] if isinstance(err, dict) else str(err)
            stats["error_breakdown"][err_msg] = stats["error_breakdown"].get(err_msg, 0) + 1
            
        if record_dict.get("date"):
            record_dict["date"] = pd.to_datetime(record_dict["date"]).date()
            
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
            
        record_dict["validation_errors"] = json.dumps(errors, ensure_ascii=False) if errors else None
        
        records_to_insert.append(models.ProductionRecord(**record_dict))
        stats["imported"] += 1

    db.add_all(records_to_insert)
    db.commit()

    return {"message": "CSV yükleme tamamlandı", "summary": stats}

@app.get("/api/v1/validation-settings", tags=["1. Veri İçe Aktarma ve Ayarlar"], summary="Validasyon Kurallarını Getir", description="Sistemin verileri denetlerken kullandığı aktif/pasif kalite kurallarını listeler.")
async def get_validation_settings():
    return VALIDATION_SETTINGS

@app.put("/api/v1/validation-settings", tags=["1. Veri İçe Aktarma ve Ayarlar"], summary="Validasyon Kurallarını Güncelle", description="Kullanıcının arayüzden seçtiği kalite kurallarını sisteme kaydeder.")
async def update_validation_settings(settings: dict):
    global VALIDATION_SETTINGS
    for k, v in settings.items():
        if k in VALIDATION_SETTINGS:
            VALIDATION_SETTINGS[k] = v
    return VALIDATION_SETTINGS

@app.post("/api/v1/revalidate", tags=["2. Veri Doğrulama (Validation)"], summary="Tüm Kayıtları Yeniden Doğrula", description="Mevcut tüm üretim kayıtlarını, güncellenmiş kalite kurallarına göre baştan test eder.")
async def revalidate_all(db: Session = Depends(get_db)):
    """Tüm kayıtları güncel doğrulama ayarlarına göre baştan kontrol eder."""
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

@app.get("/api/v1/records", tags=["2. Veri Doğrulama (Validation)"], summary="Kayıtları Filtrele ve Listele", description="Veritabanındaki kayıtları durumlarına (geçerli, hatalı, uyarı) göre filtreleyip listeler.")
async def get_records(is_valid: bool = None, record_status: str = None, db: Session = Depends(get_db)):
    """
    Veritabanındaki kayıtları getirir. is_valid veya record_status parametresi ile filtrelenebilir.
    """
    query = db.query(models.ProductionRecord)
    if is_valid is not None:
        query = query.filter(models.ProductionRecord.is_valid == is_valid)
    if record_status is not None:
        query = query.filter(models.ProductionRecord.record_status == record_status)
    return query.limit(5000).all() # Frontend'de rahat filtreleme için limiti artırdık

@app.delete("/api/v1/records", tags=["1. Veri İçe Aktarma ve Ayarlar"], summary="Tüm Veritabanını Temizle", description="Test amaçlı veya yeni dosya yüklemesi öncesinde tüm CSV kayıtlarını veritabanından kalıcı olarak siler.")
async def clear_records(db: Session = Depends(get_db)):
    """
    Veritabanındaki tüm kayıtları siler (UI'dan dosya kaldırıldığında temizlik için).
    """
    global LAST_IMPORT_TIME
    LAST_IMPORT_TIME = datetime.utcnow()
    db.query(models.ProductionRecord).delete()
    db.commit()
    return {"message": "Tüm kayıtlar başarıyla silindi."}

@app.put("/api/v1/records/{record_id}", tags=["2. Veri Doğrulama (Validation)"], summary="Kayıt Güncelle (Düzeltme Yap)", description="Hatalı bir üretim kaydını kullanıcının girdiği yeni verilerle günceller, değişikliği geçmişe yazar (Audit Trail) ve tekrar doğrular.")
async def update_record(record_id: int, update_data: RecordUpdate, db: Session = Depends(get_db)):
    record = db.query(models.ProductionRecord).filter(models.ProductionRecord.record_id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Kayıt bulunamadı")
        
    update_dict = update_data.dict(exclude_unset=True)
    
    # Değişiklikleri tespit edip loglayalım (Audit Trail)
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
                
    # Audit Trail Güncellemesi
    if changes:
        history = []
        if record.audit_trail:
            try: history = json.loads(record.audit_trail)
            except: pass
            
        history.append({
            "timestamp": datetime.utcnow().isoformat(),
            "changes": changes
        })
        record.audit_trail = json.dumps(history, ensure_ascii=False)
        
    # Yeniden Validasyon Çalıştır
    row_dict = {c.name: getattr(record, c.name) for c in record.__table__.columns if hasattr(record, c.name)}
    errors = validate_row(row_dict)
    record.is_valid = len(errors) == 0
    
    if len(errors) == 0:
        record.record_status = "valid"
    elif any(isinstance(e, dict) and e.get("action") in ["reddet", "düzelt"] for e in errors):
        record.record_status = "error"
    else:
        record.record_status = "warning"
        
    record.validation_errors = json.dumps(errors, ensure_ascii=False) if errors else None
    
    db.commit()
    return {
        "message": "Kayıt güncellendi", 
        "is_valid": record.is_valid, 
        "errors": errors,
        "audit_trail": json.loads(record.audit_trail) if record.audit_trail else []
    }

@app.delete("/api/v1/records/{record_id}", tags=["2. Veri Doğrulama (Validation)"], summary="Tekil Kayıt Sil (Reddet)", description="Kalite standartlarına uymayan ve düzeltilemeyecek durumdaki şüpheli bir kaydı tamamen çöpe atar.")
async def delete_single_record(record_id: int, db: Session = Depends(get_db)):
    record = db.query(models.ProductionRecord).filter(models.ProductionRecord.record_id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Kayıt bulunamadı")
        
    db.delete(record)
    db.commit()
    return {"message": "Kayıt silindi"}

@app.get("/api/v1/stats", tags=["3. Raporlar ve Gösterge Paneli"], summary="Genel İstatistikleri Getir", description="Veritabanındaki kayıtların geçerli, uyarı ve hata durumlarına göre dağılım istatistiklerini döner.")
async def get_stats(db: Session = Depends(get_db)):
    """Veritabanındaki güncel kayıt istatistiklerini döner."""
    total = db.query(models.ProductionRecord).count()
    valid = db.query(models.ProductionRecord).filter(models.ProductionRecord.is_valid == True).count()
    warning = db.query(models.ProductionRecord).filter(models.ProductionRecord.record_status == "warning").count()
    error = db.query(models.ProductionRecord).filter(models.ProductionRecord.record_status == "error").count()
    
    # Geriye dönük uyumluluk için (eski veritabanı yapısı kaldıysa)
    if valid == 0 and warning == 0 and error == 0:
        valid = db.query(models.ProductionRecord).filter(models.ProductionRecord.is_valid == True).count()
        error = db.query(models.ProductionRecord).filter(models.ProductionRecord.is_valid == False).count()
        
    return {"total": total, "valid": valid, "warning": warning, "error": error}

@app.get("/api/v1/dashboard-data", tags=["3. Raporlar ve Gösterge Paneli"], summary="Dashboard Analitiklerini Getir", description="OEE trendleri, duruş nedenleri, fire analizleri ve KPI kartları için gereken tüm gelişmiş ve birleştirilmiş grafikleri üretir.")
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
    
    warning_records = [r for r in suspicious_records if getattr(r, "record_status", "") == "warning"]
    error_records = [r for r in suspicious_records if getattr(r, "record_status", "") not in ["valid", "warning"]]

    valid_oee_records = [r.oee for r in valid_records if r.oee is not None]
    avg_oee = sum(valid_oee_records) / len(valid_oee_records) if valid_oee_records else 0
    
    total_prod = sum([r.total_produced for r in records if r.total_produced is not None])
    total_scrap = sum([r.scrap_qty for r in records if r.scrap_qty is not None])
    total_down = sum([r.down_time for r in records if r.down_time is not None])

    last_record = sorted(valid_records, key=lambda x: (x.date.isoformat() if x.date else "", x.shift or 0), reverse=True) if valid_records else []
    
    # Veritabanı boşken frontend'in 'null' hatasıyla çökmesini engellemek için varsayılan güvenli obje
    last_shift_badge = {
        "date": "",
        "shift": "",
        "oee": 0,
        "total_produced": 0,
        "workstation": "Veri Yok"
    }
    
    if last_record:
        lr = last_record[0]
        last_shift_badge = {
            "date": lr.date.isoformat() if lr.date else "",
            "shift": lr.shift or "",
            "oee": lr.oee or 0,
            "total_produced": lr.total_produced or 0,
            "workstation": lr.workstation_name or "Bilinmiyor"
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
                    err_msg = e["message"] if isinstance(e, dict) else str(e)
                    anomaly_counts[err_msg] = anomaly_counts.get(err_msg, 0) + 1
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
        "warning_count": len(warning_records),
        "error_count": len(error_records),
        "total_records": len(records),
        "global_total_records": global_total,
        "target_actual": {
            "target": round(target_prod),
            "actual": total_prod
        },
        "table_data": [
            {
                "id": r.record_id,
                "date": r.date.isoformat() if r.date else "",
                "shift": r.shift or 0,
                "workstation": r.workstation_name or "Bilinmiyor",
                "work_time": r.work_time or 0,
                "down_time": r.down_time or 0,
                "total_produced": r.total_produced or 0,
                "scrap_qty": r.scrap_qty or 0,
                "a": r.availability or 0,
                "p": r.performance or 0,
                "q": r.quality or 0,
                "oee": r.oee or 0,
                "is_valid": r.is_valid,
                "record_status": getattr(r, "record_status", "valid")
            } for r in records[:50]
        ],
        "workstations": list(set([r.workstation_name for r in records if r.workstation_name]))
    }

# --- HEDEF SİSTEM SENKRONİZASYON (REST API) İŞLEMLERİ ---

@app.post("/api/v1/sync/manual", tags=["4. Hedef Sistem Senkronizasyonu"], summary="Tekil Vardiyayı Manuel Gönder", description="Kullanıcının matris üzerinden seçtiği spesifik bir tarih-vardiya paketini Magna API'sine anında gönderir ve Fallback uygular.")
def manual_sync(payload: SyncPayload, db: Session = Depends(get_db)):
    """Kullanıcının tek bir vardiya hücresini (Manuel) anında göndermesini sağlar."""
    headers = {"X-Production-Key": API_KEY, "Content-Type": "application/json"}
    data_to_send = payload.dict(exclude={"machines"}) # Dış API'nin hata vermemesi için machines gizleniyor
    full_data = payload.dict() # Ancak veri tabanında göstermek için tutuluyor
    try:
        resp = send_to_api_with_backoff(data_to_send, headers=headers)
        is_success = resp.status_code == 200
        log = SyncLog(
            production_date=full_data["production_date"],
            shift=full_data["shift"],
            payload=json.dumps(full_data),
            status_code=resp.status_code,
            response_data=resp.text,
            is_success=is_success
        )
        db.add(log)
        db.commit()
        return {"success": is_success, "status_code": resp.status_code, "message": resp.text}
    except Exception as e:
        log = SyncLog(
            production_date=full_data["production_date"],
            shift=full_data["shift"],
            payload=json.dumps(full_data),
            status_code=0,
            response_data=str(e),
            is_success=False
        )
        db.add(log)
        db.commit()
        return {"success": False, "status_code": 0, "message": str(e)}

SYNC_STATE = {
    "is_syncing": False,
    "total": 0,
    "processed": 0,
    "success": 0,
    "failed": 0
}

def run_sync_task_batch(groups_to_sync: list):
    global SYNC_STATE
    SYNC_STATE["is_syncing"] = True
    SYNC_STATE["total"] = len(groups_to_sync)
    SYNC_STATE["processed"] = 0
    SYNC_STATE["success"] = 0
    SYNC_STATE["failed"] = 0
    
    db = SessionLocal()
    headers = {"X-Production-Key": API_KEY, "Content-Type": "application/json"}
    
    try:
        # Tercih edilen Batch işlemi için listeyi gruplara (chunk) bölüyoruz. 
        # İstek 10 KB'ı aşmasın diye 20'li paketler halinde gönderiyoruz.
        batch_size = 20
        batches = [groups_to_sync[i:i + batch_size] for i in range(0, len(groups_to_sync), batch_size)]
        
        for batch in batches:
            if not SYNC_STATE["is_syncing"]: break
            
            try:
                clean_batch = [{k: v for k, v in item.items() if k != "machines"} for item in batch]
                resp = send_to_api_with_backoff(clean_batch, headers=headers)
                
                # EĞER HEDEF SİSTEM BATCH (DİZİ) KABUL ETMEYİP 422 DÖNERSE -> SINGLE OBJECT FALLBACK (Çok güçlü koruma)
                if resp.status_code == 422:
                    for item, clean_item in zip(batch, clean_batch):
                        resp_single = send_to_api_with_backoff(clean_item, headers=headers)
                        is_success = resp_single.status_code == 200
                        log = SyncLog(production_date=item["production_date"], shift=item["shift"], payload=json.dumps(item), status_code=resp_single.status_code, response_data=resp_single.text, is_success=is_success)
                        db.add(log)
                        db.commit()
                        if is_success: SYNC_STATE["success"] += 1
                        else: SYNC_STATE["failed"] += 1
                        SYNC_STATE["processed"] += 1
                        
                        time.sleep(1.0) # Kuyruk Yapısı (Pacing): Tek tek gönderirken rate limit yememek için 1sn bekle
                    continue # Bu batch bitti, diğerine geç
                
                is_success = resp.status_code == 200
                for item in batch:
                    log = SyncLog(production_date=item["production_date"], shift=item["shift"], payload=json.dumps(item), status_code=resp.status_code, response_data=resp.text, is_success=is_success)
                    db.add(log)
                db.commit()
                
                if is_success: SYNC_STATE["success"] += len(batch)
                else: SYNC_STATE["failed"] += len(batch)
                SYNC_STATE["processed"] += len(batch)
                
            except Exception as e:
                # Tamamen ulaşılamaz durumlarda
                for item in batch:
                    log = SyncLog(production_date=item["production_date"], shift=item["shift"], payload=json.dumps(item), status_code=0, response_data=str(e), is_success=False)
                    db.add(log)
                db.commit()
                SYNC_STATE["failed"] += len(batch)
                SYNC_STATE["processed"] += len(batch)
            
            time.sleep(0.5) # Spam önleyici hafif bekleme
    finally:
        SYNC_STATE["is_syncing"] = False
        db.close()

@app.get("/api/v1/sync/preview", tags=["4. Hedef Sistem Senkronizasyonu"], summary="Senkronizasyon Önizlemesini (Matris) Getir", description="Temiz kayıtları Tarih ve Vardiya bazında gruplayarak, gönderime hazır veya daha önce başarısız olmuş paketlerin listesini döner.")
def get_sync_preview(db: Session = Depends(get_db)):
    total_records = db.query(models.ProductionRecord).count()
    valid_records = db.query(models.ProductionRecord).filter(models.ProductionRecord.is_valid == True).all()
    
    # 1. Kayıtları Gün ve Vardiyaya göre grupla
    groups = {}
    for r in valid_records:
        if not r.date or r.shift is None: continue
        d_str = r.date.isoformat() if hasattr(r.date, "isoformat") else str(r.date)
        key = (d_str, r.shift)
        if key not in groups: groups[key] = []
        groups[key].append(r)
        
    # 2. SADECE BU OTURUM İÇİNDE (Son CSV yüklemesinden sonra) Başarılı senkronize olmuş logları al!
    success_logs = db.query(SyncLog).filter(
        SyncLog.is_success == True,
        SyncLog.timestamp >= LAST_IMPORT_TIME
    ).order_by(SyncLog.timestamp.desc()).all()
    
    synced_payloads = {}
    for log in success_logs:
        key = (log.production_date, log.shift)
        if key not in synced_payloads:
            try:
                synced_payloads[key] = json.loads(log.payload) if log.payload else {}
            except:
                synced_payloads[key] = {}
    
    to_sync = []
    all_payloads = []
    raw_records_count = 0
    for (d, s), records in groups.items():
        machine_list = list(set(r.workstation_name for r in records if r.workstation_name))
        total_prod = sum(r.total_produced for r in records if r.total_produced is not None)
        valid_oees = [r.oee for r in records if r.oee is not None]
        avg_oee = sum(valid_oees) / len(valid_oees) if valid_oees else 0.0
        
        # Hedef sistemin JSON yapısı
        payload = {
            "machine_count": len(machine_list),
            "total_production_units": total_prod,
            "oe_value": round(avg_oee, 2),
            "shift": s,
            "production_date": d,
            "machines": machine_list
        }
        all_payloads.append(payload)
        
        # Eğer bu veri daha önce başarılı gönderilmişse ama RAKAMLAR DEĞİŞMİŞSE tekrar kuyruğa al!
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
        "session_start_time": LAST_IMPORT_TIME.isoformat() + "Z"
    }

@app.post("/api/v1/sync/start", tags=["4. Hedef Sistem Senkronizasyonu"], summary="Toplu Arkaplan Senkronizasyonunu Başlat", description="Kuyrukta bekleyen tüm paketleri arka planda (Background Task) asenkron olarak hedef API'ye aktarmaya başlar.")
def start_sync(background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    global SYNC_STATE
    if SYNC_STATE["is_syncing"]:
        return {"message": "Senkronizasyon halihazırda arka planda çalışıyor."}
        
    preview = get_sync_preview(db)
    to_sync = preview["pending_payloads"]
    
    if not to_sync:
        return {"message": "Senkronize edilecek yeni veya başarısız veri bulunamadı."}
        
    # Async gönderimi kuyruğa al (Kullanıcı arayüzde beklemez)
    background_tasks.add_task(run_sync_task_batch, to_sync)
    return {"message": f"{len(to_sync)} vardiya özeti gönderim kuyruğuna alındı."}

@app.get("/api/v1/sync/status", tags=["4. Hedef Sistem Senkronizasyonu"], summary="Arkaplan İşlem Durumunu Sorgula", description="Şu an devam eden arkaplan senkronizasyonunun ilerleme (progress) yüzdesini ve başarı/hata durumunu döner.")
def sync_status():
    return SYNC_STATE

@app.get("/api/v1/sync/logs", tags=["4. Hedef Sistem Senkronizasyonu"], summary="API Gönderim Geçmişini (Logları) Getir", description="Hedef sistemle kurulan tüm başarılı/başarısız ağ iletişimlerini, dönen HTTP cevaplarını ve durum detaylarını listeler.")
def sync_logs(db: Session = Depends(get_db)):
    # Arayüzdeki tabloya basmak için geçmiş işlemleri getir
    logs = db.query(SyncLog).order_by(SyncLog.timestamp.desc()).limit(150).all()
    
    result = []
    for log in logs:
        parsed_payload = {}
        if log.payload:
            try:
                parsed_payload = json.loads(log.payload)
            except:
                pass
                
        result.append({
            "id": log.id,
            "production_date": log.production_date,
            "shift": log.shift,
            "status_code": log.status_code,
            "is_success": log.is_success,
            "response_data": log.response_data,
            "timestamp": log.timestamp.isoformat() + "Z" if log.timestamp else None,
            "payload": parsed_payload
        })
    return result

@app.delete("/api/v1/sync/logs", tags=["4. Hedef Sistem Senkronizasyonu"], summary="API Loglarını Temizle", description="Geçmiş tüm API gönderim loglarını (SyncLog) veritabanından siler.")
def clear_sync_logs(db: Session = Depends(get_db)):
    """Test ve sıfırlama amaçlı olarak tüm gönderim geçmişini temizler."""
    db.query(SyncLog).delete()
    db.commit()
    return {"message": "Tüm loglar temizlendi."}

@app.get("/api/v1/sync/settings", tags=["4. Hedef Sistem Senkronizasyonu"], summary="API Senkronizasyon Ayarlarını Getir", description="Hedef API adresi ve API Key bilgilerini döner.")
def get_sync_settings():
    return {
        "api_key": API_KEY,
        "external_api_url": EXTERNAL_API_URL
    }

@app.put("/api/v1/sync/settings", tags=["4. Hedef Sistem Senkronizasyonu"], summary="API Senkronizasyon Ayarlarını Güncelle", description="Hedef API adresi ve API Key bilgilerini günceller ve .env dosyasına kaydeder.")
def update_sync_settings(settings: SyncSettingsUpdate):
    global API_KEY, EXTERNAL_API_URL
    API_KEY = settings.api_key
    EXTERNAL_API_URL = settings.external_api_url
    
    try:
        import dotenv
        dotenv.set_key(env_path, "API_KEY", API_KEY)
        dotenv.set_key(env_path, "EXTERNAL_API_URL", EXTERNAL_API_URL)
    except Exception:
        pass # dotenv dosyası yoksa bellekte tutar
        
    return {"message": "API Ayarları başarıyla güncellendi.", "api_key": API_KEY, "external_api_url": EXTERNAL_API_URL}