import os
from datetime import datetime
from dotenv import load_dotenv

env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
load_dotenv(dotenv_path=env_path)


LAST_IMPORT_TIME = datetime.utcnow()

VALIDATION_SETTINGS = {
    "missing_wo": {"active": True, "action": "reddet"},
    "format_wo": {"active": True, "action": "düzelt"},
    "invalid_shift": {"active": True, "action": "düzelt"},
    "missing_ws": {"active": True, "action": "reddet"},
    "missing_product": {"active": True, "action": "reddet"},
    "missing_metrics": {"active": True, "action": "düzelt"},
    "negative_prod": {"active": True, "action": "düzelt"},
    "scrap_gt_prod": {"active": True, "action": "düzelt"},
    "out_of_range_pct": {"active": True, "action": "düzelt"},
    "capacity_exceed": {"active": True, "action": "uyar"},
    "downtime_mismatch": {"active": True, "action": "uyar"},
    "downtime_gt_worktime": {"active": True, "action": "düzelt"},
    "prod_zero_worktime": {"active": True, "action": "düzelt"},
    "zero_prod_long_run": {"active": True, "action": "uyar"},
    "avail_100_with_downtime": {"active": True, "action": "düzelt"},
    "invalid_date": {"active": True, "action": "düzelt"},
    "oee_mismatch": {"active": True, "action": "düzelt"}
}

SYNC_STATE = {
    "is_syncing": False,
    "total": 0,
    "processed": 0,
    "success": 0,
    "failed": 0
}
