from typing import Optional, List
from pydantic import BaseModel, Field

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