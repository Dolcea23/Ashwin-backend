from fastapi import FastAPI
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from statistics import mean

app = FastAPI(title="Ashwin Wellness Backend")

# -----------------------------
# DATABASES
# -----------------------------
database = []          # physiological readings
env_database = []      # environment readings


# -----------------------------
# MODELS
# -----------------------------
class SensorData(BaseModel):
    user_id: int
    sensor_type: str
    value: float
    timestamp: Optional[datetime] = datetime.utcnow()


class EnvironmentData(BaseModel):
    temperature: float
    humidity: float
    timestamp: Optional[datetime] = datetime.utcnow()


# -----------------------------
# ROUTES
# -----------------------------
@app.get("/")
def root():
    return {"message": "Ashwin Wellness Backend is running 🚀"}


@app.post("/sensor")
def add_sensor_data(data: SensorData):
    database.append(data.dict())
    return {"status": "success", "total_records": len(database)}


@app.post("/environment")
def add_env_data(data: EnvironmentData):
    env_database.append(data.dict())
    return {"status": "success", "total_records": len(env_database)}


@app.get("/summary")
def get_summary():
    if not database:
        return {"message": "No data yet."}
    avg_value = mean(d["value"] for d in database)
    return {"avg_sensor_value": avg_value, "records": len(database)}

