# models.py
from sqlalchemy import Column, Integer, Float, String, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime

# ✅ Use the SAME Base that database.py uses
from database import Base


# 👤 User Table
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    age = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    sensors = relationship("SensorData", back_populates="user")
    indices = relationship("AshwinIndex", back_populates="user")
    rewards = relationship("Reward", back_populates="user")


# 🧬 Raw Sensor Data Table
class SensorData(Base):
    __tablename__ = "sensor_data"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    timestamp = Column(DateTime, default=datetime.utcnow)

    # Values from ESP32
    heart_rate = Column(Float, nullable=True)
    brainwave_alpha = Column(Float, nullable=True)
    temperature = Column(Float, nullable=True)
    env_noise = Column(Float, nullable=True)
    env_light = Column(Float, nullable=True)

    user = relationship("User", back_populates="sensors")


# 📊 Daily Ashwin Index Summary
class AshwinIndex(Base):
    __tablename__ = "ashwin_index"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    date = Column(DateTime, default=datetime.utcnow)
    index_score = Column(Float)
    trend = Column(String)
    sleep_hours = Column(Float, nullable=True)

    user = relationship("User", back_populates="indices")


# 🏅 Reward System
class Reward(Base):
    __tablename__ = "rewards"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    badge_name = Column(String)
    earned_on = Column(DateTime, default=datetime.utcnow)
    unlocked = Column(Boolean, default=False)

    user = relationship("User", back_populates="rewards")


# 🌡️ Environment Data
class EnvironmentData(Base):
    __tablename__ = "environment_data"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    timestamp = Column(DateTime, default=datetime.utcnow)

    noise_level = Column(Float)
    light_level = Column(Float)
    temperature = Column(Float)
