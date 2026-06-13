import pytest
from main import validate_row, VALIDATION_SETTINGS

def test_validate_row_success():
    # Tüm kurallara uyan temiz bir üretim kaydı
    row = {
        "work_order_no": "3021234567",
        "shift": 1,
        "workstation_name": "IMM-2700-1",
        "total_produced": 100,
        "scrap_qty": 5,
        "availability": 100,
        "performance": 80,
        "quality": 95,
        "oee": 76.0,
        "work_time": 480,
        "down_time": 0
    }
    errors = validate_row(row)
    assert len(errors) == 0  # Hata dönmemeli

def test_validate_row_missing_workstation():
    # İş istasyonu eksik olan bir kayıt
    row = {
        "work_order_no": "3021234567",
        "shift": 1,
        "workstation_name": None, # EKSİK
        "total_produced": 100,
    }
    errors = validate_row(row)
    assert len(errors) > 0
    assert any(e["field"] == "workstation_name" for e in errors)

def test_validate_row_scrap_greater_than_produced():
    # Fire miktarının Üretimden büyük olması fiziksel olarak imkansızdır
    row = {
        "work_order_no": "3021234567",
        "shift": 2,
        "workstation_name": "IMM-2700-2",
        "total_produced": 50,
        "scrap_qty": 60, # 50 üründen 60'ı hatalı olamaz
        "work_time": 480
    }
    errors = validate_row(row)
    assert len(errors) > 0
    
# Bu dosyayı backend klasöründe terminalden `pytest test_main.py` yazarak çalıştırabilirsiniz.