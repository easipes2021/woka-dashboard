from fastapi import FastAPI, HTTPException
import json
import math
import os

app = FastAPI(title="WOKA Rating Curve API")

# Ensure metadata file is available
META_FILE = os.path.join(os.path.dirname(os.path.dirname(__file__)), "rating_curve_metadata.json")

if not os.path.exists(META_FILE):
    raise FileNotFoundError("rating_curve_metadata.json not found. Run the rating-curve workflow first.")

# Load rating-curve coefficients
with open(META_FILE) as f:
    meta = json.load(f)

H_BREAK = meta["piecewise_breakpoint"]

A_LOW = meta["low_flow"]["A"]
B_LOW = meta["low_flow"]["B"]

A_HIGH = meta["high_flow"]["A"]
B_HIGH = meta["high_flow"]["B"]


@app.get("/")
def root():
    return {"status": "ok", "message": "WOKA Rating Curve API running"}


@app.get("/flow")
def flow(stage: float):
    """
    Convert gage height (ft) → discharge (CFS) using the piecewise rating curve.
    """
    if stage <= 0:
        raise HTTPException(status_code=400, detail="Stage must be greater than 0.")

    if stage <= H_BREAK:
        q = A_LOW * (stage ** B_LOW)
    else:
        q = A_HIGH * (stage ** B_HIGH)

    return {
        "stage_ft": stage,
        "discharge_cfs": round(q, 2),
        "segment_used": "low" if stage <= H_BREAK else "high"
    }


@app.get("/historic")
def historic():
    """
    Returns the cleaned (H, Q) paired dataset used to build the rating curve.
    Ideal for plotting hydrographs or scatter plots.
    """
    import pandas as pd
    import os

    csv_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "paired_stage_flow.csv")

    if not os.path.exists(csv_path):
        raise HTTPException(status_code=404, detail="Historic dataset not found.")

    df = pd.read_csv(csv_path)
    return df.to_dict(orient="records")









from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # Or restrict to your website domain later
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    return {"status": "healthy"}

import logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("rating-api")

@app.get("/flow")
def flow(stage: float):
    logger.info(f"Flow endpoint called with stage={stage}")
    ...
