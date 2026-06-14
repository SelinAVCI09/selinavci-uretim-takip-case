from datetime import datetime
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import engine, Base, SessionLocal
import models
import state

# Veritabanı tablolarını oluştur
Base.metadata.create_all(bind=engine)

from routers import import_router, validation_router, dashboard_router, sync_router

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

@app.on_event("startup")
def clear_old_csv_records():
    state.LAST_IMPORT_TIME = datetime.utcnow()
    db = SessionLocal()
    try:
        db.query(models.ProductionRecord).delete()
        db.commit()
    finally:
        db.close()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(import_router.router)
app.include_router(validation_router.router)
app.include_router(dashboard_router.router)
app.include_router(sync_router.router)