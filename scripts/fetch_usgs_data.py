import os
import requests
import json
from datetime import datetime, timedelta

SITE_ID = "07195430"
PARAMS = "00060,00065"      # discharge + gage height
OUTPUT_FILE = "data/usgs_07195430.json"

# Build proper date range with timestamps
end_dt = datetime.utcnow()
start_dt = end_dt - timedelta(days=730)

start = start_dt.strftime("%Y-%m-%dT%H:%MZ")
end = end_dt.strftime("%Y-%m-%dT%H:%MZ")

BASE_URL = "https://waterservices.usgs.gov/nwis/iv/"

url = (
    f"{BASE_URL}?format=json"
    f"&sites={SITE_ID}"
    f"&parameterCd={PARAMS}"
    f"&startDT={start}"
    f"&endDT={end}"
)

print("Fetching:", url)

resp = requests.get(url)
resp.raise_for_status()

data = resp.json()

os.makedirs("data", exist_ok=True)
with open(OUTPUT_FILE, "w") as f:
    json.dump(data, f, indent=2)

print(f"✅ Saved {OUTPUT_FILE}")
