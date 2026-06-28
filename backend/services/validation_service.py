import pandas as pd
from datetime import datetime
import state

EXPECTED_COLUMNS = [
    "record_id", "date", "work_order_no", "work_center_no", "work_center_name",
    "workstation_name", "stock_name", "shift", "availability", "performance",
    "quality", "oee", "work_time", "down_time", "planned_down_time",
    "unplanned_down_time", "total_produced", "scrap_qty"
]

def validate_row(row):
    errors = []
    
    def is_active(rule):
        val = state.VALIDATION_SETTINGS.get(rule)
        if isinstance(val, dict): return val.get("active", True)
        return bool(val)

    def get_action(rule, default="uyar"):
        val = state.VALIDATION_SETTINGS.get(rule)
        if isinstance(val, dict): return val.get("action", default)
        return default

    wo_no = str(row.get("work_order_no", ""))
    if is_active("missing_wo") and (pd.isna(row.get("work_order_no")) or not wo_no.strip() or wo_no.lower() == "nan"):
        errors.append({"field": "work_order_no", "error_type": "Eksik İş Emri", "message": "İş Emri No boş bırakılamaz.", "reason": "İzlenebilirlik yapılamaz.", "action": get_action("missing_wo", "reddet")})
    elif is_active("format_wo") and not pd.isna(row.get("work_order_no")):
        wo_clean = wo_no.split('.')[0]
        if len(wo_clean) > 0 and (not wo_clean.startswith("302") or len(wo_clean) != 10):
            errors.append({"field": "work_order_no", "error_type": "İş Emri Formatı", "message": f"İş Emri No formatı hatalı: {wo_clean}", "reason": "İş emri '302' ile başlamalı ve 10 hane olmalıdır.", "action": get_action("format_wo", "düzelt")})

    shift = row.get("shift")
    if is_active("invalid_shift") and (pd.isna(shift) or shift not in [1, 2, 3]):
        errors.append({"field": "shift", "error_type": "Vardiya Kontrolü", "message": f"Geçersiz Vardiya: {shift}", "reason": "Vardiya 1, 2 veya 3 olmalıdır.", "action": get_action("invalid_shift", "düzelt")})

    if is_active("missing_ws") and (pd.isna(row.get("workstation_name")) or not str(row.get("workstation_name")).strip()):
        errors.append({"field": "workstation_name", "error_type": "Eksik İş İstasyonu", "message": "İş İstasyonu bilgisi eksik.", "reason": "Performans ölçümü istasyon bazlı yapıldığı için bu alan zorunludur.", "action": get_action("missing_ws", "reddet")})

    if is_active("missing_product") and (pd.isna(row.get("stock_name")) or not str(row.get("stock_name")).strip()):
        errors.append({"field": "stock_name", "error_type": "Eksik Ürün (Stok)", "message": "Stok Adı (Ürün) bilgisi eksik.", "reason": "Tüm alanların eksiksiz doldurulması zorunludur.", "action": get_action("missing_product", "reddet")})

    if is_active("missing_metrics"):
        metrics_to_check = [("availability", "Kullanılabilirlik (A)"), ("performance", "Performans (P)"), ("quality", "Kalite (Q)"), ("oee", "OEE"), ("work_time", "Çalışma Süresi"), ("down_time", "Toplam Duruş"), ("total_produced", "Toplam Üretim"), ("scrap_qty", "Fire")]
        for col_key, col_name in metrics_to_check:
            if pd.isna(row.get(col_key)):
                errors.append({"field": col_key, "error_type": "Boş Metrik Verileri", "message": f"{col_name} verisi eksik.", "reason": "Tüm alanların eksiksiz doldurulması zorunludur.", "action": get_action("missing_metrics", "düzelt")})

    total_prod = row.get("total_produced")
    scrap = row.get("scrap_qty")
    wt = row.get("work_time") or 0.0
    
    if is_active("negative_prod"):
        if pd.isna(total_prod) or total_prod < 1:
            is_long_run_zero = is_active("zero_prod_long_run") and wt > 60 and (pd.isna(total_prod) or total_prod == 0)
            if not is_long_run_zero:
                errors.append({"field": "total_produced", "error_type": "Negatif Üretim / Fire", "message": "Üretilen miktar en az 1 olmalıdır.", "reason": "Hedef sistem 0 veya negatif üretim değerlerini kabul etmez.", "action": get_action("negative_prod", "düzelt")})
        if not pd.isna(scrap) and scrap < 0:
            errors.append({"field": "scrap_qty", "error_type": "Negatif Üretim / Fire", "message": "Fire miktarı negatif olamaz.", "reason": "Hatalı ürün adedi eksi değer alamaz.", "action": get_action("negative_prod", "düzelt")})
        
    if is_active("scrap_gt_prod") and not pd.isna(total_prod) and not pd.isna(scrap) and total_prod >= 0 and scrap >= 0:
        if scrap > total_prod:
            errors.append({"field": "scrap_qty, total_produced", "error_type": "Fire > Toplam Üretim", "message": "Fire miktarı, toplam üretimden büyük.", "reason": "Hatalı üretilen ürün sayısı, üretilen toplam parçadan fazla olamaz.", "action": get_action("scrap_gt_prod", "düzelt")})

    if is_active("out_of_range_pct"):
        for col_key, col_name in [("availability", "Kullanılabilirlik (A)"), ("quality", "Kalite (Q)"), ("oee", "OEE")]:
            val = row.get(col_key)
            if not pd.isna(val) and (val < 0 or val > 100):
                errors.append({"field": col_key, "error_type": "Yüzdelik Aralık", "message": f"{col_name} değeri %0-100 dışında ({val}).", "reason": "Yüzdelik metrikler 0 ile 100 arasında olmalıdır.", "action": get_action("out_of_range_pct", "düzelt")})
                
        perf = row.get("performance")
        if not pd.isna(perf):
            if perf < 0:
                errors.append({"field": "performance", "error_type": "Yüzdelik Aralık", "message": f"Performans negatif olamaz ({perf}).", "reason": "Performans değeri 0'dan küçük olamaz.", "action": get_action("out_of_range_pct", "düzelt")})
            elif is_active("capacity_exceed") and perf > 100:
                errors.append({"field": "performance", "error_type": "Kapasite Aşımı (P > 100)", "message": f"Performans %100'ün üzerinde ({perf}).", "reason": "Teorik hedeflerden daha hızlı çalışılmış olabilir.", "action": get_action("capacity_exceed", "uyar")})
            
    dt = row.get("down_time") or 0.0
    p_dt = row.get("planned_down_time") or 0.0
    up_dt = row.get("unplanned_down_time") or 0.0
    
    if is_active("downtime_mismatch"):
        if not pd.isna(row.get("down_time")):
            if abs(dt - (p_dt + up_dt)) > 0.1:
                errors.append({"field": "down_time", "error_type": "Duruş Süresi Kırılımı", "message": f"Duruş süreleri tutarsız (Planlı: {p_dt} + Plansız: {up_dt} != Toplam: {dt}).", "reason": "Alt duruş kırılımlarının toplamı, genel duruş süresine eşit olmalıdır.", "action": get_action("downtime_mismatch", "uyar")})

    if is_active("downtime_gt_worktime") and dt > wt and wt > 0:
        errors.append({"field": "down_time, work_time", "error_type": "Duruş > Çalışma Süresi", "message": "Toplam Duruş, Çalışma Süresinden büyük.", "reason": "Makine, vardiya süresinden daha uzun süre duruş kaydedemez.", "action": get_action("downtime_gt_worktime", "düzelt")})

    if is_active("prod_zero_worktime") and (total_prod or 0) > 0 and wt <= 0:
        errors.append({"field": "total_produced, work_time", "error_type": "Süresiz Üretim", "message": "Çalışma süresi 0 iken üretim raporlanmış.", "reason": "Makine çalışmadan parça üretemez. Süre kaydı eksik olabilir.", "action": get_action("prod_zero_worktime", "düzelt")})

    if is_active("zero_prod_long_run") and wt > 60 and (pd.isna(total_prod) or total_prod == 0):
        errors.append({"field": "total_produced, work_time", "error_type": "Uzun Çalışma & Sıfır Ürün", "message": "Çalışma süresi 60 dakikadan fazla ancak üretim 0.", "reason": "Makinenin 1 saatten uzun süre çalışıp hiç ürün vermemesi anomali belirtisidir.", "action": get_action("zero_prod_long_run", "uyar")})

    a = row.get("availability")
    if is_active("avail_100_with_downtime") and dt > 0 and a == 100.0:
        errors.append({"field": "availability, down_time", "error_type": "Kullanılabilirlik (A) Hatası", "message": "Duruş varken Kullanılabilirlik %100.", "reason": "Duruş yaşandığında Kullanılabilirlik metriginin (A) %100'den düşük olması gerekir.", "action": get_action("avail_100_with_downtime", "düzelt")})

    if is_active("invalid_date"):
        if pd.isna(row.get("date")):
            errors.append({"field": "date", "error_type": "Tarih Doğrulaması", "message": "Üretim tarihi eksik.", "reason": "Kayıtların zaman çizelgesine eklenebilmesi için tarih zorunludur.", "action": get_action("invalid_date", "düzelt")})
        else:
            try:
                date_val = row.get("date")
                date_obj = pd.to_datetime(date_val).date() if hasattr(date_val, "date") else pd.to_datetime(date_val).date()
                if date_obj > datetime.utcnow().date():
                    errors.append({"field": "date", "error_type": "Tarih Doğrulaması", "message": f"Tarih gelecekte ({date_obj}).", "reason": "Gelecek bir tarihe gerçekleşmiş üretim kaydı girilemez.", "action": get_action("invalid_date", "düzelt")})
            except Exception:
                errors.append({"field": "date", "error_type": "Tarih Doğrulaması", "message": "Geçersiz tarih formatı.", "reason": "Sistem tarihi algılayamadı.", "action": get_action("invalid_date", "düzelt")})

    p = row.get("performance")
    q = row.get("quality")
    oee = row.get("oee")
    if is_active("oee_mismatch") and not pd.isna(a) and not pd.isna(p) and not pd.isna(q) and not pd.isna(oee):
        calc_oee = (a / 100) * (p / 100) * (q / 100) * 100
        if abs(calc_oee - oee) > 1.0: 
            errors.append({"field": "oee", "error_type": "OEE Çapraz Kontrolü", "message": f"OEE Hatalı Hesaplanmış (Raporlanan: {oee}, Beklenen: {round(calc_oee,1)}).", "reason": "OEE değeri her zaman Kullanılabilirlik * Performans * Kalite çarpımına eşit olmalıdır.", "action": get_action("oee_mismatch", "düzelt")})

    return errors