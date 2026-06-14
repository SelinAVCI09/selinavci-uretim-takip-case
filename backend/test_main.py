import pytest
import pandas as pd
from main import validate_row

def test_missing_work_order():
    """İş emri boş olduğunda 'Reddet' hatası fırlatmalı"""
    row = {"work_order_no": None, "shift": 1, "workstation_name": "IMM-1"}
    errors = validate_row(row)
    assert any(e["field"] == "work_order_no" for e in errors)

def test_negative_production():
    """Negatif üretim miktarı 'Geçersiz Miktar' hatası fırlatmalı"""
    row = {
        "work_order_no": "3021234567", "shift": 1, 
        "workstation_name": "IMM-1", "stock_name": "Part-A",
        "total_produced": -10, "work_time": 400
    }
    errors = validate_row(row)
    assert any(e["error_type"] == "Geçersiz Miktar" for e in errors)

def test_oee_math_mismatch():
    """OEE hesabı A*P*Q/10000 formülüne uymadığında hata fırlatmalı"""
    row = {
        "work_order_no": "3021234567", "shift": 1, "workstation_name": "IMM-1",
        "stock_name": "Part-A", "availability": 100, "performance": 100, 
        "quality": 100, "oee": 95.0, "total_produced": 100, "work_time": 400
    }
    errors = validate_row(row)
    assert any(e["error_type"] == "Matematiksel Tutarsızlık" for e in errors)