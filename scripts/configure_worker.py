"""Fill deployment-only values into Wrangler config in CI; never commit the result."""
import json
import os
from pathlib import Path

config_path = Path(__file__).resolve().parents[1] / "worker" / "wrangler.jsonc"
config = json.loads(config_path.read_text(encoding="utf-8"))
database_id = os.environ["CF_D1_DATABASE_ID"].strip()
admin_email = os.environ["MALIKZ_ADMIN_EMAIL"].strip().lower()
site_origin = os.environ["MALIKZ_SITE_ORIGIN"].strip().rstrip("/")
if len(database_id) < 20 or "REPLACE" in database_id:
    raise SystemExit("CF_D1_DATABASE_ID is missing or invalid")
if "@" not in admin_email or "REPLACE" in admin_email:
    raise SystemExit("MALIKZ_ADMIN_EMAIL is missing or invalid")
if not site_origin.startswith("https://") or "REPLACE" in site_origin:
    raise SystemExit("MALIKZ_SITE_ORIGIN must be the HTTPS production site origin")
config["d1_databases"][0]["database_id"] = database_id
config["vars"]["ADMIN_EMAIL"] = admin_email
config["vars"]["ALLOWED_ORIGINS"] = site_origin
config_path.write_text(json.dumps(config, indent=2) + "\n", encoding="utf-8")
