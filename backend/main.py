@app.get("/ping")
def ping():
    return {"status": "alive"}
from __future__ import annotations

# -*- coding: utf-8 -*-

# -------------------------------------------------
# Ashwin Wellness Backend - v12 "Harmony + Ashwin Index v1.0"
# -------------------------------------------------
# main.py = WIRING ONLY (app + middleware + routers + shared constants)
# Keep heavy logic inside routes/ and services/
# -------------------------------------------------

# ---------- AUTO BACKUP HOOK ----------
try:
    import auto_backup
    auto_backup.perform_backup()
except Exception as e:
    print("⚠️ Backup module missing or failed:", e)

# ---------- Standard Library ----------
import os
import sqlite3
import threading
import shutil
import csv
import io
import json
import time
from datetime import datetime, timedelta
from statistics import mean, pstdev
from typing import Optional, List, Dict, Any, Tuple
from zoneinfo import ZoneInfo
from collections import Counter

import os

MAX_BOARD_ROWS = 10000

# ---------- FastAPI / Pydantic ----------
from fastapi import FastAPI, Request, Query, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import (
    JSONResponse,
    HTMLResponse,
    StreamingResponse,
    Response,
    RedirectResponse,
    FileResponse,
)
from pydantic import BaseModel
from fastapi.templating import Jinja2Templates

# ---------- PDF Export (used later in /research/export/{uid}.pdf) ----------
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter

# ✅ Your router (make sure this file exists: routes/core.py)

# =============================
# RADAR / LIVE STRIP JS CONSTANTS
# =============================

LIVE_STRIP_JS = r"""
(function () {
  if (window.__ASHWIN_LIVESTRIP_STARTED__) return;
  window.__ASHWIN_LIVESTRIP_STARTED__ = true;
  const ENABLE_LIVE_STRIP = true;
if (!ENABLE_LIVE_STRIP) return;


  const USER_ID = new URLSearchParams(window.location.search).get("user") || "1";
  const LIMIT = 140;

  function draw(canvas, points) {
    if (!canvas || points.length < 2) return;
    const ctx = canvas.getContext("2d");
    const w = canvas.width, h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    const vals = points.map(p => Number(p.harmony || 0));
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const span = Math.max(1, max - min);

    ctx.strokeStyle = "#8fe3ff";
    ctx.lineWidth = 2;
    ctx.beginPath();

    vals.forEach((v, i) => {
      const x = (i / (vals.length - 1)) * w;
      const y = h - ((v - min) / span) * (h - 10) - 5;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });

    ctx.stroke();
  }

  async function tick() {
    try {
      const r = await fetch(
      `/api/recent?user=${USER_ID}&limit=${LIMIT}&_=${Date.now()}`,
      { cache: "no-store" }
    );
      const j = await r.json();
    
    // --- LIVE PROOF (shows last point timestamp on the page) ---
    const lastT = j?.points?.slice(-1)?.[0]?.t || "--";
    let el = document.getElementById("boardLastPoint");
    if (!el) {
      el = document.createElement("div");
      el.id = "boardLastPoint";
      el.style.cssText = "position:fixed;bottom:12px;right:12px;background:#111;color:#fff;padding:8px 10px;border-radius:10px;font:12px/1.2 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Arial;opacity:.85;z-index:9999";
      document.body.appendChild(el);
    }
    el.textContent = "Last point: " + lastT;
    console.log("BOARD LAST POINT:", lastT);
console.log(
      "BOARD LAST POINT:",
      j?.points?.slice(-1)?.[0]?.t
    );
      draw(document.getElementById("liveStrip"), j.points || []);
    } catch (_) {}
  }

  function start() {
    const c = document.getElementById("liveStrip");
    if (!c) return;
    c.width = Math.max(600, c.clientWidth);
    c.height = 160;
    tick();
    setInterval(tick, 4000);
  }

  document.readyState === "loading"
    ? document.addEventListener("DOMContentLoaded", start)
    : start();
})();
"""

RADAR_SCRIPT_JS = r"""
(function(){
  // prevent double init
  if (window.__ASHWIN_RADAR_STARTED__) return;
  window.__ASHWIN_RADAR_STARTED__ = true;

  function q(id){ return document.getElementById(id); }

  function patternsUrl(uid, limit, frame_step){
    const p = new URLSearchParams(window.location.search);
    const s = p.get("start");
    const e = p.get("end");
    if (s && e){
      return `/patterns/${uid}?limit=${limit}&frame_step=${frame_step}&start=${encodeURIComponent(s)}&end=${encodeURIComponent(e)}&_t=${Date.now()}`;
    }
    const r = p.get("range") || "session";
    return `/patterns/${uid}?limit=${limit}&frame_step=${frame_step}&range=${encodeURIComponent(r)}&_t=${Date.now()}`;
  }

  // ---- date controls: preload + apply/clear ----
  function setUrlParams(obj){
    const p = new URLSearchParams(window.location.search);
    Object.entries(obj).forEach(([k,v])=>{
      if (v === null || v === undefined || v === "") p.delete(k);
      else p.set(k, v);
    });
    // if date filtering, range becomes irrelevant
    if (p.get("start") && p.get("end")) p.delete("range");
    window.location.search = p.toString();
  }

  function initDateControls(){
    const sEl = q("startDate");
    const eEl = q("endDate");
    const apply = q("applyDates");
    const clear = q("clearDates");

    const p = new URLSearchParams(window.location.search);
    if (sEl) sEl.value = p.get("start") || "";
    if (eEl) eEl.value = p.get("end") || "";

    if (apply){
      apply.addEventListener("click", (ev)=>{
        ev.preventDefault();
        const s = sEl ? sEl.value : "";
        const e = eEl ? eEl.value : "";
        if (!s || !e) return alert("Pick BOTH Start and End dates.");
        setUrlParams({ start: s, end: e });
      });
    }

    if (clear){
      clear.addEventListener("click", (ev)=>{
        ev.preventDefault();
        setUrlParams({ start: null, end: null });
      });
    }
  }

  function drawBase(ctx,w,h){
    ctx.clearRect(0,0,w,h);
    ctx.fillStyle="#0b0f14"; ctx.fillRect(0,0,w,h);
    ctx.strokeStyle="rgba(255,255,255,0.08)";
    ctx.lineWidth=2;
    const cx=w/2, cy=h/2, r=Math.min(w,h)*0.45;
    for(let i=1;i<=4;i++){ ctx.beginPath(); ctx.arc(cx,cy,r*i/4,0,Math.PI*2); ctx.stroke(); }
    for(let a=0;a<360;a+=30){
      const rad=a*Math.PI/180;
      ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(cx+r*Math.cos(rad), cy+r*Math.sin(rad)); ctx.stroke();
    }
  }

  function zoneToAngle(zone){
    const map={Z1:300,Z2:0,Z3:60,Z4:120,Z5:180,Z6:240};
    return ((map[zone] ?? 0) * Math.PI/180);
  }

  function radarColor(h) {
    const v = Math.max(0, Math.min(100, Number(h || 0)));
    if (v >= 80) return "#ff2d2d";   // red
    if (v >= 60) return "#ff9f0a";   // orange
    if (v >= 40) return "#ffd60a";   // yellow
    if (v >= 20) return "#34c759";   // green
    return "#0b7a2a";                // dark green
  }

  function render(points){
    const canvas=q("radarCanvas"); if(!canvas) return;
    const ctx=canvas.getContext("2d");
    const w=canvas.width, h=canvas.height;

    drawBase(ctx,w,h);

    const cx=w/2, cy=h/2, r=Math.min(w,h)*0.40;

    if(!points || !points.length){
      ctx.fillStyle="rgba(255,255,255,0.75)";
      ctx.font="16px system-ui";
      ctx.textAlign="center";
      ctx.fillText("No radar data in this window", cx, cy);
      return;
    }

    const counts={};
    points.forEach(p=>{
      const z=p.zone_id || p.zone || "Z?";
      counts[z]=(counts[z]||0)+1;
    });
    const top=Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,6);

    const recent = points.slice(-160);
    recent.forEach((p, i) => {
      const z = (p.zone_id || p.zone || "Z3");
      const ang = zoneToAngle(z);

      const harmony = Number(p.harmony ?? 20);
      const intensity = Math.max(5, Math.min(100, harmony));

      const rr = r * (0.15 + 0.85 * (intensity / 100));
      const jitter = ((i % 7) - 3) * 0.03;
      const a = ang + jitter;

      const x = cx + rr * Math.cos(a);
      const y = cy + rr * Math.sin(a);

      ctx.fillStyle = radarColor(harmony);
      ctx.beginPath();
      ctx.arc(x, y, 2, 0, Math.PI * 2);
      ctx.fill();
    });

    const meta=q("radarMeta");
    if(meta){
      meta.textContent = `Dominant zone: ${top[0]?.[0] || "—"} • samples: ${points.length}`;
    }
  } // CLOSE render(points)

  async function refreshUserTags(uid){
    try{
      const res = await fetch(`/tags/${uid}?range=all&limit=10`);
      if(!res.ok) return;
      const data = await res.json();

      const box = q("userTagList");
      if(!box) return;

      const tags = Array.isArray(data.tags) ? data.tags : [];
      if(!tags.length){
        box.innerHTML = "<div style='opacity:.75'>No tags yet.</div>";
        return;
      }

      box.innerHTML = tags.map(t => `
        <div style="padding:.5rem .6rem;border:1px solid rgba(255,255,255,.08);border-radius:.6rem;margin:.45rem 0;">
          <div style="display:flex;justify-content:space-between;gap:.75rem;">
            <strong>${t.tag_type}</strong>
            <span style="opacity:.75;font-size:.85rem;">${t.start_ts || ""}</span>
          </div>
          <div style="opacity:.85;margin-top:.2rem;">
            ${t.note ? t.note : ""} ${t.severity ? `<span style="opacity:.75">• sev ${t.severity}</span>` : ""}
          </div>
        </div>
      `).join("");

    }catch(e){
      // fail quietly
    }
  }

  async function pollTagFeed(uid){
    try{
      // pull events from patterns endpoint (it already has pattern events)
      const res = await fetch(patternsUrl(uid, 600, 5));
      if(!res.ok) return;

      const data = await res.json();
      const feed = q("tagFeed");
      if(!feed) return;

      const ev = Array.isArray(data.events) ? data.events : [];
      if(!ev.length){
        feed.innerHTML = "<div style='opacity:.75'>No recent tags yet.</div>";
        return;
      }

      // newest-first display
      const last = ev.slice(-40).reverse();

      feed.innerHTML = last.map(e => {
        const t = e.t || e.ts || "";
        const pid = e.pattern_id || e.id || "TAG";
        const label = e.label || e.name || "";
        const z = e.zone_id || e.zone || "";
        const confNum = (typeof e.confidence === "number") ? e.confidence
                      : (typeof e.conf === "number") ? e.conf : null;
        const conf = (confNum !== null) ? ` • ${(confNum*100).toFixed(0)}%` : "";

        return `
          <div style="padding:.5rem .6rem;border:1px solid rgba(255,255,255,.08);border-radius:.6rem;margin:.45rem 0;">
            <div style="display:flex;justify-content:space-between;gap:.75rem;">
              <strong>${pid}</strong>
              <span style="opacity:.75;font-size:.85rem;">${t}</span>
            </div>
            <div style="opacity:.85;margin-top:.2rem;">
              ${label ? label : ""} ${z ? `<span style="opacity:.75">(${z})</span>` : ""}${conf}
            </div>
          </div>`;
      }).join("");

    }catch(e){
      // fail quietly
    }
  }

  async function postTagNow(uid){
    const typeEl = q("tagType");
    const sevEl = q("tagSeverity");
    const noteEl = q("tagNote");

    const tag_type = typeEl ? typeEl.value : "flare";
    const severity = (sevEl && sevEl.value) ? Number(sevEl.value) : null;
    const note = noteEl ? noteEl.value : "";

    const payload = {
      user_id: Number(uid),
      tag_type,
      start_ts: new Date().toISOString(),
      note: note || null,
      severity: (severity && !Number.isNaN(severity)) ? severity : null
    };

    await fetch("/tags", {
      method:"POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify(payload)
    });

    if(noteEl) noteEl.value = "";
    if(sevEl) sevEl.value = "";

    await pollTagFeed(uid);
    await refreshUserTags(uid);
  }

  async function load(){
    const panel=q("radarPanel");
    const uid = (panel && panel.dataset && panel.dataset.user) ? panel.dataset.user : "1";

    // bind Tag Now button (uid is valid here)
    const btn = q("btnTagNow");
    if (btn){
      btn.onclick = () => postTagNow(uid);
    }

    // start feeds immediately
    pollTagFeed(uid);
    setInterval(() => pollTagFeed(uid), 4000);

    refreshUserTags(uid);
    setInterval(() => refreshUserTags(uid), 6000);

    try{
      const res = await fetch(patternsUrl(uid, 2000, 5));
      if(!res.ok) throw new Error("HTTP " + res.status);

      const data = await res.json();

      // --- Top Patterns (real counts from backend) ---
      const pc = data.pattern_counts || {};
      const topP = Object.entries(pc)
        .sort((a,b)=> (b[1]||0) - (a[1]||0))
        .slice(0, 8);

      const list = q("radarPatterns");
      if (list) {
        list.innerHTML = topP.length
          ? topP.map(([pid, c]) =>
              `<div class="d-flex justify-content-between"><span>${pid}</span><span class="text-muted">${c}</span></div>`
            ).join("")
          : "<div style='opacity:.7;'>No patterns in this window yet.</div>";
      }

      render(data.points || []);
    }catch(e){
      console.warn("Radar load failed:", e);
      render([]);
      const meta=q("radarMeta");
      if(meta) meta.textContent = "Radar: failed to load data";
    }
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", ()=>{ initDateControls(); load(); });
  } else {
    initDateControls();
    load();
  }
})();
"""
POLL_JS = r"""
(function(){
  function qs(){ return new URLSearchParams(window.location.search); }
  function uid(){
  const u = qs().get("user");
  if (u && u.trim() !== "") return u;
  const sel = document.getElementById("userSelect");
  if (sel && sel.value) return sel.value;
  return "1";
}
  function rangeKey(){ return qs().get("range") || "session"; }
  function start(){ return qs().get("start"); }
  function end(){ return qs().get("end"); }

  function buildUrl(){
    const u = uid();
    const s = start();
    const e = end();
    if (s && e){
      return `/api/board_snapshot?user=${encodeURIComponent(u)}&start=${encodeURIComponent(s)}&end=${encodeURIComponent(e)}&_t=${Date.now()}`;
    }
    const r = rangeKey();
    return `/api/board_snapshot?user=${encodeURIComponent(u)}&range=${encodeURIComponent(r)}&_t=${Date.now()}`;
  }

  function setText(id, val){
    const el = document.getElementById(id);
    if(!el) return;
    el.textContent = (val === null || val === undefined) ? "—" : String(val);
  }

  async function tick(){
    try{
      const res = await fetch(buildUrl());
      if(!res.ok) return;
      const data = await res.json();
      if(!data || !data.has_data) return;

      // last reading
      if (data.last_ts_et) setText("lastReading", data.last_ts_et);

      // KPIs
      const k = data.kpis || {};
      setText("kpiAvgHarmony", k.avg_harmony);
      setText("kpiImprovement", k.improvement);
      setText("kpiStability", k.stability);
      setText("kpiHri", k.hri);

      // Drift KPI (card must exist in HTML)
      setText("kpiDrift", k.avg_drift);

      // badges (if present)
      setText("badgeAvgHarmony", k.avg_harmony);
      setText("badgeImprovement", (k.improvement !== null && k.improvement !== undefined) ? `${k.improvement}%` : "—");
      setText("badgeStability", (k.stability !== null && k.stability !== undefined) ? `${k.stability}%` : "—");

      // raw table
      const tbody = document.getElementById("rawRowsBody");
      if(tbody && data.tables && data.tables.raw_rows_html){
        tbody.innerHTML = data.tables.raw_rows_html;
      }

    }catch(e){
      // fail quietly
    }
  }

  function bindDates(){
    const p = qs();
    const s0 = p.get("start") || "";
    const e0 = p.get("end") || "";

    const sEl = document.getElementById("startDate");
    const eEl = document.getElementById("endDate");
    const apply = document.getElementById("applyDates");
    const clear = document.getElementById("clearDates");

    if(sEl) sEl.value = s0;
    if(eEl) eEl.value = e0;

    function setUrl(obj){
      const sp = new URLSearchParams(window.location.search);
      Object.entries(obj).forEach(([k,v])=>{
        if(v===null) sp.delete(k); else sp.set(k,v);
      });
      if(obj.start && obj.end) sp.delete("range");
      window.location.search = sp.toString();
    }

    if(apply){
      apply.addEventListener("click", ()=>{
        const s = sEl ? sEl.value : "";
        const e = eEl ? eEl.value : "";
        if(!s || !e) return alert("Pick both Start and End dates.");
        setUrl({start:s, end:e});
      });
    }
    if(clear){
      clear.addEventListener("click", ()=>{
        setUrl({start:null, end:null});
      });
    }
  }

  function startLoop(){
    bindDates();
    tick();
    setInterval(tick, 4000);
  }

  document.readyState === "loading"
    ? document.addEventListener("DOMContentLoaded", startLoop)
    : startLoop();
})();
"""

BUMP_JS = r"""
<script>
(function () {
  function bump() {
    [
      window.summaryHarmonyChartObj,
      window.harmonyTrendChartObj,
      window.proofCompareChartObj,
      window.proofHarmonyChartObj,
      window.brainFieldChartObj,
      window.cardiacFieldChartObj,
      window.thermalFieldChartObj,
      window.envFieldChartObj
    ].forEach(function(ch) {
      try {
        if (ch) {
          ch.resize();
          ch.update("none");
        }
      } catch(e) {}
    });
  }

  setTimeout(bump, 250);

  document.addEventListener("shown.bs.tab", function () {
    setTimeout(bump, 50);
  });
})();
</script>
"""



# ---------- Partner / Licensing Boundary ----------
PARTNER_KEY = os.getenv("ASHWIN_PARTNER_KEY", "")

def require_partner_key(x_ashwin_key: Optional[str]):
    # Dev mode: allow if env var not set
    if not PARTNER_KEY:
        return
    if x_ashwin_key != PARTNER_KEY:
        raise HTTPException(status_code=401, detail="Partner key required.")


# ---------- Database helper (shared) ----------
import os
import psycopg2

DATABASE_URL = os.getenv("DATABASE_URL")

def get_conn():
    return psycopg2.connect(DATABASE_URL)


# ---------- FastAPI App ----------
app = FastAPI(title="Ashwin Wellness Backend - v12")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/debug/db")
def debug_db():
    return {
        "database_url": os.getenv("DATABASE_URL")
    }

# -----------------------------
# DEBUG DATABASE ENDPOINTS
# -----------------------------

@app.get("/readings")
def debug_readings():
    conn = get_conn()
    c = conn.cursor()
    c.execute("SELECT * FROM readings ORDER BY id DESC LIMIT 50")
    rows = c.fetchall()
    conn.close()
    return rows

@app.get("/sessions")
def debug_sessions():
    conn = get_conn()
    c = conn.cursor()
    c.execute("SELECT * FROM sessions ORDER BY id DESC LIMIT 50")
    rows = c.fetchall()
    conn.close()
    return rows
# Templates (only needed if you actually use TemplateResponse)
templates = Jinja2Templates(directory="templates")

# Simple test page (optional)
@app.get("/hello", response_class=HTMLResponse)
def hello(request: Request):
    return templates.TemplateResponse("hello.html", {"request": request})

# Health endpoint
@app.get("/health")
def health():
    return {"ok": True}

# ✅ Mount your routes (do this ONCE, after app is created)



# IMPORTANT:
# - Do NOT start the daily engine thread inside FastAPI when using uvicorn --reload
#   or multiple workers (gunicorn/uvicorn workers). It will run multiple times.
# - Keep compute_daily_index() and call it from an endpoint (on-demand) + optionally
#   run run_daily_index_engine() as a SEPARATE process.
#
# If you still insist on running it inside the API for now, I included a "safe-ish"
# start option at the bottom (disabled by default).

# DISABLED duplicate app init: app = FastAPI(title="Ashwin Wellness Backend - v12")

# -----------------------------
# ROOT + DASHBOARD ROUTES
# -----------------------------
@app.get("/")
def root():
    return RedirectResponse(url="/board?user=1&range=24h")

@app.get("/dashboard")
def dashboard(user: int = Query(1, ge=1)):
    return RedirectResponse(url=f"/report/{user}")


def _day_window_et(day_yyyy_mm_dd: str):
    """Returns [start_et, end_et) for the given ET day string."""
    d = datetime.strptime(day_yyyy_mm_dd, "%Y-%m-%d").date()
    start_et = datetime(d.year, d.month, d.day, 0, 0, 0, tzinfo=ET)
    end_et = start_et + timedelta(days=1)
    return start_et, end_et


def _to_utc_naive(dt_et: datetime) -> datetime:
    """Convert ET-aware datetime to naive UTC (common DB pattern)."""
    if dt_et.tzinfo is None:
        raise ValueError("_to_utc_naive expected timezone-aware datetime")
    return dt_et.astimezone(UTC).replace(tzinfo=None)


# -------------------------------------------------
# DAILY INDEX ENGINE (SQLite-only; no ORM)
# -------------------------------------------------

def compute_daily_index_sqlite(uid: int, day_yyyy_mm_dd: str):
    conn = get_conn()
    c = conn.cursor()
    c.execute("""
        SELECT user_id, day, index_value, level, color,
               brain_score, heart_score, temp_score, env_score,
               recovery_score, harmony_score, confidence, created_at
        FROM ashwin_daily
        WHERE user_id=? AND day=?
    """, (uid, day_yyyy_mm_dd))
    row = c.fetchone()
    conn.close()

    if row:
        return {
            "user_id": row[0],
            "day": row[1],
            "index_value": row[2],
            "level": row[3],
            "color": row[4],
            "brain_score": row[5],
            "heart_score": row[6],
            "temp_score": row[7],
            "env_score": row[8],
            "recovery_score": row[9],
            "harmony_score": row[10],
            "confidence": row[11],
            "created_at": row[12],
        }

    # continue to compute if not cached...


def run_daily_index_engine():
    """
    Runs forever.
    Computes daily ONCE per day after 2:00 AM ET for ALL users.
    SQLite-only.
    """
    last_run_day = None

    while True:
        now_et = datetime.now(ET)
        day_str = now_et.date().strftime("%Y-%m-%d")

        if now_et.hour >= 2 and last_run_day != day_str:
            yesterday_str = (now_et.date() - timedelta(days=1)).strftime("%Y-%m-%d")

            conn = get_conn()
            c = conn.cursor()
            c.execute("SELECT id FROM users")
            user_ids = [row[0] for row in c.fetchall()]
            conn.close()

            for uid in user_ids:
                try:
                    compute_daily_index_sqlite(uid, yesterday_str)
                except Exception:
                    pass

            last_run_day = day_str

        time.sleep(30)


# IMPORTANT: keep this False unless you run single worker, no --reload
ENABLE_DAILY_ENGINE_THREAD = False
if ENABLE_DAILY_ENGINE_THREAD:
    threading.Thread(target=run_daily_index_engine, daemon=True).start()


# ---------- Timezones ----------
ET = ZoneInfo("America/New_York")
UTC = ZoneInfo("UTC")

def to_et(dt: datetime):
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=UTC)
    return dt.astimezone(ET)

def fmt_et(dt: datetime):
    return to_et(dt).strftime("%m/%d/%Y %I:%M %p")

def parse_iso_to_et(ts: str):
    try:
        return fmt_et(datetime.fromisoformat(ts))
    except:
        return ts

# ---------- Database ----------
def init_db():
    conn = get_conn()
    c = conn.cursor()

    c.execute("""
        CREATE TABLE IF NOT EXISTS users(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            pin TEXT,
            display_name TEXT,
            created_at TEXT
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS sessions(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            label TEXT,
            start_time TEXT,
            end_time TEXT
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS readings(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            session_id INTEGER,
            eeg REAL,
            ecg REAL,
            temperature REAL,
            light REAL,
            noise REAL,
            timestamp TEXT
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS life_events(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            event_type TEXT,
            confidence REAL,
            note TEXT,
            created_at TEXT
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS profiles(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            data TEXT,
            created_at TEXT
        )
    """)
    c.execute("""
        CREATE TABLE IF NOT EXISTS ashwin_daily(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            day TEXT NOT NULL,                 -- YYYY-MM-DD (ET)
            index_value REAL NOT NULL,
            level TEXT,
            color TEXT,
            brain_score REAL,
            heart_score REAL,
            temp_score REAL,
            env_score REAL,
            recovery_score REAL,
            harmony_score REAL,
            confidence REAL,
            created_at TEXT,
            UNIQUE(user_id, day)
        )
    """)
        # --- user_tags: user-labeled events for correlation (non-diagnostic) ---
    c.execute("""
        CREATE TABLE IF NOT EXISTS user_tags (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          tag_type TEXT NOT NULL,         -- e.g. migraine, neck_pain, meds, stress, flare
          start_ts TEXT NOT NULL,         -- ISO string
          end_ts TEXT,                    -- optional ISO
          note TEXT,
          severity INTEGER,               -- optional 1..10
          created_at TEXT NOT NULL
        )
        """)
    c.execute("""
        CREATE TABLE IF NOT EXISTS pattern_review_queue (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          sig TEXT NOT NULL,                 -- signature key (hashable string)
          window_start TEXT NOT NULL,
          window_end TEXT NOT NULL,
          event_count INTEGER NOT NULL DEFAULT 0,
          pattern_counts_json TEXT,          -- JSON string of counts
          suggested_label TEXT,
          status TEXT NOT NULL DEFAULT 'new', -- new|reviewed|dismissed|promoted
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
        """)

        # helpful index for time queries
    c.execute("CREATE INDEX IF NOT EXISTS idx_user_tags_user_time ON user_tags(user_id, start_ts)")

    conn.commit()
    conn.close()

init_db()

# ---------- Models ----------
class UserSignup(BaseModel):
    name: str
    pin: str
    full_name: Optional[str] = None

class UserLogin(BaseModel):
    name: str
    pin: str

class SensorReadingIn(BaseModel):
    device_id: str
    user_id: Optional[int] = None
    session_id: Optional[int] = None
    eeg: Optional[float] = None
    ecg: Optional[float] = None
    temperature: Optional[float] = None
    light: Optional[float] = None
    noise: Optional[float] = None
    timestamp: Optional[str] = None


class StartSession(BaseModel):
    user_id: int
    label: Optional[str] = "sleep"

class BaselineProfile(BaseModel):
    user_id: int
    createdAt: Optional[str] = None
    version: Optional[str] = None
    class Config:
        extra = "allow"


# ---------- Utils ----------
def safe(v, d=0.0):
    return v if v is not None else d

def calc_harmony(eeg, ecg, temp):
    """
    Improved Harmony calculation
    Stable + normalized + better contactless behavior
    """

    eeg = safe(eeg)
    ecg = safe(ecg)
    temp = safe(temp, 98.6)

    # normalize small biosignal amplitudes
    eeg = abs(eeg)
    ecg = abs(ecg)

    if eeg < 5:
        eeg *= 80

    if ecg < 5:
        ecg *= 80

    # cap extreme spikes
    eeg = min(eeg, 100)
    ecg = min(ecg, 100)

    # thermal stability
    temp_dev = abs(temp - 98.6)
    thermal_score = max(0, 100 - (temp_dev * 8))

    # signal balance (important for contactless sensing)
    balance = 1 - abs(eeg - ecg) / max(eeg + ecg, 1)

    balance_score = balance * 100

    harmony = (
        eeg * 0.35 +
        ecg * 0.35 +
        thermal_score * 0.20 +
        balance_score * 0.10
    )

    return round(max(0, min(100, harmony)), 2)

# ---------- Advanced Algorithm - Ashwin Index v1.0 ----------
def _normalize_series(values, fallback=50.0):
    if not values:
        return []
    vmin, vmax = min(values), max(values)
    if abs(vmax - vmin) < 1e-6:
        return [fallback] * len(values)
    return [((v - vmin) / (vmax - vmin)) * 100 for v in values]


def compute_ashwin_index_v1(rows):
    """
    Brain + Heart + Temperature + Environment + Recovery + Harmony
    Full Ashwin Index v1.0 (0-100)
    """

    if not rows:
        return {
            "index": 50, "level": "No Data", "color": "#9E9E9E",
            "brain_calm_score": 50, "heart_rhythm_score": 50,
            "temp_stability_score": 50, "environment_score": 50,
            "recovery_score": 0, "harmony_score": 50,
            "confidence": 0
        }

    eeg_vals, ecg_vals, temp_vals, light_vals, noise_vals, harmonies = [], [], [], [], [], []

    for (eeg, ecg, temp, light, noise, _) in rows:
        eeg_vals.append(eeg or 0.0)
        ecg_vals.append(ecg or 0.0)
        temp_vals.append(temp or 0.0)
        light_vals.append(light or 0.0)
        noise_vals.append(noise or 0.0)
        harmonies.append(calc_harmony(eeg, ecg, temp))

    # 1. Brain Calmness
    eeg_norm = _normalize_series(eeg_vals)
    brain_calm_score = round(mean([100 - v for v in eeg_norm]), 2)

    # 2. Heart Rhythm Stability
    ecg_norm = _normalize_series(ecg_vals)
    variability = pstdev(ecg_norm) if len(ecg_norm) > 1 else 20
    heart_rhythm_score = round(max(0, 100 - min(variability * 3, 100)), 2)

    # 3. Temperature Stability
    ideal = 98.6
    avg_dev = mean([abs(t - ideal) for t in temp_vals])
    temp_stability_score = round(max(0, 100 - min(avg_dev * 10, 100)), 2)

    # 4. Environmental Score
    light_norm = _normalize_series(light_vals)
    noise_norm = _normalize_series(noise_vals)

    def _smooth(s):
        if len(s) < 2:
            return 50
        vol = pstdev(s)
        return max(0, 100 - min(vol * 3, 100))

    environment_score = round((_smooth(light_norm) + _smooth(noise_norm)) / 2, 2)

    # 5. Recovery Score (based on Harmony trend)
    mid = len(harmonies) // 2 or 1
    before = harmonies[:mid]
    after = harmonies[mid:]

    avg_before = mean(before)
    avg_after = mean(after)
    improvement_pct = ((avg_after - avg_before) / avg_before * 100) if avg_before else 0
    try:
        s_before, s_after = pstdev(before), pstdev(after)
        stability_pct = ((s_before - s_after) / s_before * 100) if s_before > 0 else 0
    except:
        stability_pct = 0

    recovery_score = round(max(0, min(improvement_pct * 0.6 + stability_pct * 0.4, 100)), 2)

    # 6. Harmony Score
    harmony_score = round(mean(harmonies), 2)

    # 7. Composite
    weights = {
        "brain": 0.25, "heart": 0.20, "temp": 0.15,
        "env": 0.10, "recovery": 0.15, "harmony": 0.15
    }

    comp = {
        "brain": brain_calm_score,
        "heart": heart_rhythm_score,
        "temp": temp_stability_score,
        "env": environment_score,
        "recovery": recovery_score,
        "harmony": harmony_score,
    }

    total = sum(weights[k] * comp[k] for k in weights)
    index = round(min(100, max(0, total)), 2)

    if index >= 85:
        level, color = "Balanced", "#4CAF50"
    elif index >= 70:
        level, color = "Stable", "#2196F3"
    elif index >= 55:
        level, color = "Fatigued", "#FFC107"
    else:
        level, color = "Low", "#F44336"

    confidence = min(1.0, len(rows) / 60)

    return {
        "index": index,
        "level": level,
        "color": color,
        "brain_calm_score": brain_calm_score,
        "heart_rhythm_score": heart_rhythm_score,
        "temp_stability_score": temp_stability_score,
        "environment_score": environment_score,
        "recovery_score": recovery_score,
        "harmony_score": harmony_score,
        "confidence": round(confidence, 2)
    }
# -------------------------------------------------
# ---------- SESSION HELPERS ----------
# -------------------------------------------------

def start_autosession(uid: int, label: str = "Auto Session"):
    conn = get_conn()
    c = conn.cursor()
    ts = datetime.utcnow().isoformat()
    c.execute(
        "INSERT INTO sessions(user_id, label, start_time) VALUES (?,?,?)",
        (uid, label, ts),
    )
    conn.commit()
    sid = c.lastrowid
    conn.close()
    return {"session_id": sid, "start_time": ts}


def get_active_session(uid: int):
    conn = get_conn()
    c = conn.cursor()
    c.execute(
        """
        SELECT id, start_time
        FROM sessions
        WHERE user_id=? AND end_time IS NULL
        ORDER BY id DESC LIMIT 1
        """,
        (uid,),
    )
    row = c.fetchone()
    conn.close()

    if not row:
        return None

    sid, start_ts = row
    try:
        start = datetime.fromisoformat(start_ts)
    except:
        return sid

    # Auto-close after 30 minutes inactivity
    if datetime.utcnow() - start > timedelta(minutes=30):
        end_session(sid)
        return None

    return sid


def end_session(sid: int):
    conn = get_conn()
    c = conn.cursor()
    ts = datetime.utcnow().isoformat()
    c.execute("UPDATE sessions SET end_time=? WHERE id=?", (ts, sid))
    conn.commit()
    conn.close()
# --------------------------------------------
# SLEEP SESSION MANAGEMENT
# --------------------------------------------
sleep_sessions = {}  # temp in-memory cache

@app.post("/sleep/start/{user_id}")
def start_sleep_session(user_id: int):
    now = datetime.utcnow().isoformat()

    # auto-start normal session if needed
    sid = get_active_session(user_id)
    if not sid:
        sid = start_autosession(user_id)["session_id"]

    sleep_sessions[user_id] = {
        "session_id": sid,
        "start": now,
    }

    return {
        "status": "sleep_started",
        "session_id": sid,
        "start_time": now
    }


@app.post("/sleep/end/{user_id}")
def end_sleep_session(user_id: int):
    now = datetime.utcnow().isoformat()

    if user_id not in sleep_sessions:
        return {"error": "no_active_sleep_session"}

    start_time = sleep_sessions[user_id]["start"]
    sid = sleep_sessions[user_id]["session_id"]

    del sleep_sessions[user_id]

    return {
        "status": "sleep_ended",
        "session_id": sid,
        "start_time": start_time,
        "end_time": now
    }

# -------------------------------------------------
# ---------- EVENTS ----------
# -------------------------------------------------

def detect_unresponsive(d: SensorReadingIn):
    """Flag extended flat activity (wellness context only)."""
    if (d.eeg in [None, 0]) and (d.ecg in [None, 0]) and safe(d.noise) < 10 and safe(d.light) < 10:
        return {
            "event_type": "potential_unresponsive",
            "confidence": 0.78,
            "note": "Low field activity (non-medical wellness alert).",
        }
    return None


# -------------------------------------------------
# ---------- USERS ----------
# -------------------------------------------------

@app.post("/users/signup")
def signup(p: UserSignup):
    conn = get_conn()
    c = conn.cursor()

    c.execute("SELECT id FROM users WHERE name=?", (p.name,))
    if c.fetchone():
        conn.close()
        return JSONResponse({"error": "User already exists"}, status_code=400)

    now = datetime.utcnow().isoformat()
    disp = p.full_name or p.name

    c.execute(
        "INSERT INTO users(name,pin,display_name,created_at) VALUES (?,?,?,?)",
        (p.name, p.pin, disp, now),
    )

    conn.commit()
    uid = c.lastrowid
    conn.close()

    session = start_autosession(uid, "Auto Session (Signup)")

    return {
        "id": uid,
        "name": disp,
        "session_id": session["session_id"],
        "session_start": session["start_time"],
    }


@app.post("/users/login")
def login(p: UserLogin):
    conn = get_conn()
    c = conn.cursor()

    c.execute(
        "SELECT id, display_name FROM users WHERE name=? AND pin=?",
        (p.name, p.pin),
    )

    row = c.fetchone()
    conn.close()

    if not row:
        return JSONResponse({"error": "Invalid login"}, status_code=401)

    uid, disp = row
    session = start_autosession(uid, "Auto Session (Login)")

    return {
        "id": uid,
        "name": disp,
        "session_id": session["session_id"],
        "session_start": session["start_time"],
    }


@app.get("/users")
def list_users():
    conn = get_conn()
    c = conn.cursor()

    c.execute(
        "SELECT id,name,display_name,created_at FROM users ORDER BY id ASC"
    )

    rows = c.fetchall()
    conn.close()

    out = []

    for uid, name, disp, ts in rows:
        out.append(
            {
                "id": uid,
                "login_name": name,
                "display_name": disp,
                "created_at_raw": ts,
                "created_at_et": parse_iso_to_et(ts),
            }
        )

    return out


# -------------------------------------------------
# ---------- DEVICE REGISTRATION ----------
# -------------------------------------------------

# -------------------------------------------------
# DEVICE REGISTRATION
# -------------------------------------------------

@app.post("/device/register")
def register_device(device_id: str, user_id: int):

    conn = get_conn()
    c = conn.cursor()

    c.execute("""
        INSERT INTO devices (device_id, user_id)
        VALUES (?, ?)
        ON CONFLICT(device_id)
        DO UPDATE SET user_id = excluded.user_id
    """, (device_id, user_id))

    conn.commit()
    conn.close()

    return {"status": "device linked"}
# -------------------------------------------------
# ---------- SENSOR INGEST ----------
# -------------------------------------------------

from datetime import datetime, timezone
@app.post("/ingest/raw")
def ingest_raw(d: SensorReadingIn):

    conn = get_conn()
    c = conn.cursor()

    sid = None

    # ----------------------------
    # 0) Resolve user from device
    # ----------------------------
    c.execute(
        "SELECT user_id FROM devices WHERE device_id = ?",
        (d.device_id,)
    )
    row = c.fetchone()

    if not row:
        conn.close()
        return {"error": "device not registered"}

    user_id = int(row[0])

    # ----------------------------
    # 1) Choose session id
    # ----------------------------

    if getattr(d, "session_id", None):
        try:
            c.execute("""
                SELECT id
                FROM sessions
                WHERE id=? AND user_id=? AND end_time IS NULL
                LIMIT 1
            """, (int(d.session_id), user_id))
            row = c.fetchone()
            if row:
                sid = int(row[0])
        except:
            sid = None

    # (b) latest active session
    if not sid:
        c.execute("""
            SELECT id
            FROM sessions
            WHERE user_id=? AND end_time IS NULL
            ORDER BY id DESC
            LIMIT 1
        """, (user_id,))
        row = c.fetchone()

        if row:
            sid = int(row[0])

    # (c) start autosession
    if not sid:
        now = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")

        c.execute("""
            INSERT INTO sessions(user_id, label, start_time)
            VALUES (?, 'autosession', ?)
        """, (user_id, now))

        sid = c.lastrowid

    # ----------------------------
    # 2) Timestamp normalization
    # ----------------------------

    ts = getattr(d, "timestamp", None)

    if not ts:
        ts = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")

    else:
        try:
            cleaned = ts.replace("Z", "+00:00")
            dt = datetime.fromisoformat(cleaned)

            if dt.tzinfo is not None:
                dt = dt.astimezone(timezone.utc).replace(tzinfo=None)

            ts = dt.strftime("%Y-%m-%d %H:%M:%S")

        except:
            ts = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")

    # ----------------------------
    # 3) Filter idle frames
    # ----------------------------

    eeg_val = d.eeg if d.eeg is not None else 0.0
    ecg_val = d.ecg if d.ecg is not None else 0.0

    if abs(eeg_val) < 0.05 and abs(ecg_val) < 0.05:
        conn.close()
        return {"status": "ignored_idle_frame"}

    # ----------------------------
    # 4) Insert reading
    # ----------------------------

    c.execute("""
        INSERT INTO readings(
            user_id,
            session_id,
            eeg,
            ecg,
            temperature,
            light,
            noise,
            timestamp
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        user_id,
        sid,
        d.eeg,
        d.ecg,
        d.temperature,
        d.light,
        d.noise,
        ts
    ))

    # ----------------------------
    # 5) Event detection
    # ----------------------------

    ev = detect_unresponsive(d)

    if ev:
        c.execute("""
            INSERT INTO life_events(
                user_id,
                event_type,
                confidence,
                note,
                created_at
            )
            VALUES (?, ?, ?, ?, ?)
        """, (
            user_id,
            ev["event_type"],
            ev["confidence"],
            ev["note"],
            ts
        ))

    conn.commit()
    conn.close()

    return {
        "status": "ok",
        "session_id": sid,
        "timestamp": ts
    }

# -------------------------------------------------
# ---------- BASIC REPORT (JSON API) ----------
# -------------------------------------------------
@app.get("/report/{uid}")
def report(uid: int):
    conn = get_conn()
    c = conn.cursor()
    c.execute(
        """
        SELECT id,session_id,eeg,ecg,temperature,light,noise,timestamp
        FROM readings
        WHERE user_id=?
        ORDER BY id DESC LIMIT 40
        """,
        (uid,),
    )
    rows = c.fetchall()
    conn.close()

    out = []
    for r in rows:
        harmony = calc_harmony(r[2], r[3], r[4])
        out.append(
            {
                "id": r[0],
                "session_id": r[1],
                "eeg": r[2],
                "ecg": r[3],
                "temperature": r[4],
                "light": r[5],
                "noise": r[6],
                "timestamp_raw": r[7],
                "timestamp_et": parse_iso_to_et(r[7]),
                "harmony": harmony,
            }
        )
    return {"latest": out}


# -------------------------------------------------
# ---------- BASIC REPORT (AUTO UID) (JSON API) ----------
# -------------------------------------------------
@app.get("/report")
def report_auto():
    conn = get_conn()
    c = conn.cursor()

    row = c.execute("SELECT user_id FROM readings ORDER BY id DESC LIMIT 1").fetchone()
    conn.close()

    uid = int(row[0]) if row else 1
    return report(uid)


# -------------------------------------------------
# ---------- VISUAL REPORT (HTML) ----------
# -------------------------------------------------
@app.get("/report_html/{uid}")
def report_html(uid: int, range_q: str = "all"):
    ...
    # everywhere inside: replace `range` -> `range_q`

    return RedirectResponse(url=f"/board?user={uid}&range={range_q}")



@app.get("/report_html")
def report_html_auto(range_q: str = "all"):
    ...
    # match /report auto behavior
    conn = get_conn()
    c = conn.cursor()
    row = c.execute("SELECT user_id FROM readings ORDER BY id DESC LIMIT 1").fetchone()
    conn.close()

    uid = int(row[0]) if row else 1
    return RedirectResponse(url=f"/board?user={uid}&range={range_q}")


# -------------------------------------------------
# ---------- BASELINE ----------
# -------------------------------------------------

@app.post("/baseline")
def save_baseline(p: BaselineProfile):
    conn = get_conn()
    c = conn.cursor()
    now = datetime.utcnow().isoformat()

    data = p.dict()
    uid = data.pop("user_id")

    c.execute(
        "INSERT INTO profiles(user_id,data,created_at) VALUES (?,?,?)",
        (uid, json.dumps(data), now),
    )
    conn.commit()
    conn.close()
    return {"status": "ok", "user_id": uid, "saved_at": now}


# -------------------------------------------------
# ---------- ENVIRONMENT SNAPSHOT ----------
# -------------------------------------------------

@app.get("/envsync/report/{uid}")
def envsync(uid: int):
    cutoff = to_sqlite_dt(datetime.utcnow() - timedelta(hours=24))

    conn = get_conn()
    c = conn.cursor()
    c.execute(
        """
        SELECT temperature,light,noise
        FROM readings
        WHERE user_id=? AND datetime(timestamp) >= datetime(?)
        ORDER BY timestamp DESC
LIMIT 200
        """,
        (uid, cutoff),
    )
    rows = c.fetchall()
    conn.close()

    if not rows:
        return {
            "avg_temp": None,
            "avg_light": None,
            "avg_noise": None,
            "insights": [],
        }

    temps = [r[0] for r in rows if r[0] is not None]
    lights = [r[1] for r in rows if r[1] is not None]
    noises = [r[2] for r in rows if r[2] is not None]

    avg_temp = round(mean(temps), 2) if temps else None
    avg_light = round(mean(lights), 2) if lights else None
    avg_noise = round(mean(noises), 2) if noises else None

    insights = []
    if avg_temp:
        if avg_temp > 100:
            insights.append("Room is warm - consider cooling for deeper rest.")
        elif avg_temp < 97:
            insights.append("Room is cool - warmth may help the body settle.")

    if avg_noise and avg_noise > 55:
        insights.append("Noise is high - may affect relaxation.")
    if avg_light and avg_light > 40:
        insights.append("Light levels are elevated - darker room recommended.")

    return {
        "avg_temp": avg_temp,
        "avg_light": avg_light,
        "avg_noise": avg_noise,
        "insights": insights,
    }


# -------------------------------------------------
# ---------- PREDICT SUMMARY (Home Tab) ----------
# -------------------------------------------------

@app.get("/predict/summary/{uid}")
def predict_summary(uid: int):
    conn = get_conn()
    c = conn.cursor()
    c.execute(
        """
        SELECT eeg,ecg,temperature,timestamp
        FROM readings
        WHERE user_id=?
        ORDER BY id ASC
        """,
        (uid,),
    )
    rows = c.fetchall()
    conn.close()

    if not rows:
        return {
            "message": "No data yet.",
            "trend": "unknown",
            "confidence": 0.0,
        }

    harmonies = [calc_harmony(r[0], r[1], r[2]) for r in rows]

    if len(harmonies) < 4:
        return {
            "message": f"Early baseline forming. Current Harmony: {round(mean(harmonies),2)}",
            "trend": "baseline",
            "confidence": 0.3,
        }

    mid = len(harmonies) // 2
    before = harmonies[:mid]
    after = harmonies[mid:]

    if mean(after) > mean(before) + 5:
        msg, trend = "Harmony trending upward.", "up"
    elif mean(after) < mean(before) - 5:
        msg, trend = "Harmony trending downward.", "down"
    else:
        msg, trend = "Harmony stable.", "flat"

    return {
        "message": msg,
        "trend": trend,
        "confidence": round(min(0.9, len(harmonies) / 60), 2),
    }
# -------------------------------------------------
# INSIGHTS ENDPOINT - Daily / Weekly (SQLite)
# -------------------------------------------------
@app.get("/insights/{uid}")
def insights(uid: int, days: int = 7):
    days = max(1, min(30, int(days)))
    today_et = datetime.now(ET).date()

    sessions = []
    for i in range(days - 1, -1, -1):
        day = (today_et - timedelta(days=i)).isoformat()  # YYYY-MM-DD
        rec = compute_daily_index_sqlite(uid, day)
        if rec:
            sessions.append({
                "date": day,
                "index": rec["index_value"],
                "level": rec["level"],
                "color": rec["color"],
                "brain_calm_score": rec["brain_score"],
                "heart_rhythm_score": rec["heart_score"],
                "temp_stability_score": rec["temp_score"],
                "environment_score": rec["env_score"],
                "recovery_score": rec["recovery_score"],
                "harmony_score": rec["harmony_score"],
                "confidence": rec["confidence"],
            })

    # keep compatibility if you still want quick numbers
    daily = sessions[-1]["index"] if sessions else None
    weekly = round(sum(s["index"] for s in sessions[-7:]) / len(sessions[-7:]), 2) if sessions else None
    monthly = round(sum(s["index"] for s in sessions[-30:]) / len(sessions[-30:]), 2) if sessions else None

    return {
        "user_id": uid,
        "daily": daily,
        "weekly": weekly,
        "monthly": monthly,
        "sessions": sessions
    }

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          
# -------------------------------------------------
# ---------- NEW: ASHWIN INDEX v1.0 ENDPOINT ----------
# -------------------------------------------------
# =========================================================
# ADD-ON BLOCK #2 - PASTE NEAR YOUR OTHER ROUTES
# (e.g., next to /ashwin/index/{uid} or similar user endpoints)
# =========================================================

@app.get("/drift/{uid}")
def drift(uid: int):
    conn = get_conn()
    c = conn.cursor()
    c.execute(
        """
        SELECT eeg, ecg, temperature, light, noise, timestamp
        FROM readings
        WHERE user_id = ?
        ORDER BY id ASC
        """,
        (uid,),
    )
    rows = c.fetchall()
    conn.close()

    times = [parse_iso_to_et(r[5]) for r in rows]  # uses your existing parse_iso_to_et()
    drift_vals = compute_drift_series(rows)
    coh_vals = compute_coherence_series(rows)
    res_vals = compute_resonance_series(rows)

    return {
        "times": times,
        "drift": drift_vals,
        "coherence": coh_vals,
        "resonance": res_vals,
    }

@app.get("/ashwin/index/{uid}")
def get_ashwin_index(uid: int):
    """
    Returns full Ashwin Index v1.0 - patent-level algorithm.
    """
    conn = get_conn()
    c = conn.cursor()
    c.execute(
        """
        SELECT eeg,ecg,temperature,light,noise,timestamp
        FROM readings
        WHERE user_id=?
        ORDER BY id ASC
        """,
        (uid,),
    )
    rows = c.fetchall()
    conn.close()

    result = compute_ashwin_index_v1(rows)
    return result
# -------------------------------------------------
# ---------- DASHBOARD HELPERS & BOARD ----------
# -------------------------------------------------
# =========================================================
# ADD-ON BLOCK #1 - PASTE UNDER:
#   # ---------- DASHBOARD HELPERS & BOARD ----------
# =========================================================

def downsample_and_smooth(times, harmonies, eeg_vals, ecg_vals, step=5, window=20):
    """
    Downsample arrays by `step` and apply simple moving average smoothing (window size `window`).
    Returns: (times_ds, harmonies_sm, eeg_sm, ecg_sm)
    """
    if not times:
        return [], [], [], []
  
    # --- downsample ---
    times_ds = times[::max(1, step)]
    h_ds = harmonies[::max(1, step)]
    eeg_ds = eeg_vals[::max(1, step)]
    ecg_ds = ecg_vals[::max(1, step)]

    def _sma(xs, w):
        if not xs:
            return []
        w = max(1, int(w))
        out = []
        for i in range(len(xs)):
            start = max(0, i - w + 1)
            window_x = xs[start:i+1]
            out.append(round(sum(window_x) / len(window_x), 2))
        return out

    return (
        times_ds,
        _sma(h_ds, window),
        _sma(eeg_ds, window),
        _sma(ecg_ds, window),
    )


def clamp(v, lo=0.0, hi=100.0):
    try:
        v = float(v)
    except:
        return lo
    return max(lo, min(hi, v))

def rolling_std(xs, w=8):
    # simple rolling stdev (population)
    if not xs:
        return []
    out = []
    for i in range(len(xs)):
        start = max(0, i - w + 1)
        window = xs[start:i+1]
        if len(window) < 2:
            out.append(0.0)
        else:
            out.append(pstdev(window))  # uses your existing: from statistics import pstdev
    return out

def compute_drift_series(rows):
    """
    Drift (0-100) = instability away from harmony over time.
    rows: [(eeg, ecg, temperature, light, noise, timestamp), ...]
    """
    if not rows:
        return []

    harmonies = [calc_harmony(r[0], r[1], r[2]) for r in rows]  # uses your existing calc_harmony
    step = [0.0]
    for i in range(1, len(harmonies)):
        step.append(abs(harmonies[i] - harmonies[i - 1]))

    vol = rolling_std(harmonies, w=10)
    raw = [vol[i] * 6 + step[i] * 2 for i in range(len(harmonies))]

    if not raw:
        return []
    rmin, rmax = min(raw), max(raw)
    if abs(rmax - rmin) < 1e-9:
        return [10.0] * len(raw)

    drift = [((v - rmin) / (rmax - rmin)) * 100 for v in raw]
    return [round(clamp(d), 2) for d in drift]


def compute_coherence_series(rows):
    """
    Coherence proxy (0-100): balance/alignment between eeg-like and ecg-like channels.
    (Not a medical coherence metric; just your internal alignment proxy.)
    """
    out = []
    for r in rows:
        eeg = safe(r[0])          # uses your existing safe()
        ecg = safe(r[1])
        denom = max(1e-6, (eeg + ecg))
        balance = 1.0 - (abs(eeg - ecg) / denom)  # 1 = balanced, 0 = dominated
        out.append(round(clamp(balance * 100), 2))
    return out

def compute_resonance_series(rows):
    """
    Resonance proxy (0-100): stable 'envelope strength' over time.
    """
    envelope = []
    for r in rows:
        eeg = safe(r[0])
        ecg = safe(r[1])
        temp = safe(r[2], 98.6)
        envelope.append((eeg * 0.5 + ecg * 0.5) * (1.0 - min(0.15, abs(98.6 - temp) / 100)))

    vol = rolling_std(envelope, w=10)
    raw = []
    for i in range(len(envelope)):
        strength = envelope[i]
        stability = max(1e-6, (1.0 / (1.0 + vol[i])))
        raw.append(strength * stability)

    rmin, rmax = min(raw), max(raw)
    if abs(rmax - rmin) < 1e-9:
        return [50.0] * len(raw)

    res = [((v - rmin) / (rmax - rmin)) * 100 for v in raw]
    return [round(clamp(x), 2) for x in res]

# ✅ ADD THIS (RIGHT HERE)
def zone_label(zid: str) -> str:
    return ZONE_DICT.get(zid, zid)

def infer_zone(eeg, ecg, temp, light, noise):
    eeg = safe(eeg)
    ecg = safe(ecg)
    temp = safe(temp, 98.6)
    light = safe(light)
    noise = safe(noise)

    if eeg > ecg * 1.15:
        zid, conf = "Z1", 0.62
    elif ecg > eeg * 1.15:
        zid, conf = "Z2", 0.62
    elif abs(98.6 - temp) > 1.2:
        zid, conf = "Z3", 0.55
    elif noise > 40 and noise > light:
        zid, conf = "Z5", 0.50
    else:
        zid, conf = "Z6", 0.45

    return zid, zone_label(zid), conf
# ---------- ZONES DICTIONARY (shared) ----------
ZONES = {
    "Z1": "Z1 - High Variability / Unstable Coupling",
    "Z2": "Z2 - Cardiac-Dominant / Mixed Coupling",
    "Z3": "Z3 - Thermal / Regulation Coupling",
    "Z4": "Z4 - Low Band / Body-Driven Dominance",
    "Z5": "Z5 - Environmental Coupling",
    "Z6": "Z6 - Broad / Low-Variance Dominance",
}

# Backward compatible alias (if older code uses this name)
ZONE_DICT = ZONES

# -----------------------------
# PATTERN LIBRARY - V1 (20 ATOMIC)
# Non-medical taxonomy: observable behavior tags
# -----------------------------
PATTERN_LIBRARY = {
  # Drift / Stability vs Instability
  "N1": {"label": "Minor Drift Oscillation", "desc": "Small deviation with rapid recovery.", "category": "drift", "type": "atomic"},
  "N2": {"label": "Progressive Drift Ramp", "desc": "Gradual increase in instability over multiple windows.", "category": "drift", "type": "atomic"},
  "A3": {"label": "Acute Drift Spike", "desc": "Sudden high-amplitude instability event.", "category": "drift", "type": "atomic"},
  "A4": {"label": "Sustained Instability Spike", "desc": "High drift with delayed recovery.", "category": "drift", "type": "atomic"},

  # Coherence / Alignment
  "C1": {"label": "Micro-Coherence Dip", "desc": "Brief alignment loss with quick restoration.", "category": "coherence", "type": "atomic"},
  "C2": {"label": "Coherence Drop", "desc": "Sustained loss of synchronization.", "category": "coherence", "type": "atomic"},
  "C3": {"label": "Fragmented Coherence", "desc": "Repeated dips without full recovery.", "category": "coherence", "type": "atomic"},
  "C4": {"label": "Coherence Collapse", "desc": "Near-total loss of alignment.", "category": "coherence", "type": "atomic"},

  # Resonance / Envelope
  "R1": {"label": "Resonance Plateau", "desc": "Stable dominant rhythm with low variance.", "category": "resonance", "type": "atomic"},
  "R2": {"label": "Resonance Drift", "desc": "Gradual weakening of dominant rhythm.", "category": "resonance", "type": "atomic"},
  "R3": {"label": "Resonance Break", "desc": "Sudden loss of dominant rhythm.", "category": "resonance", "type": "atomic"},
  "R4": {"label": "Resonance Lock", "desc": "Strong stable envelope across windows.", "category": "resonance", "type": "atomic"},

  # Burst / Variability
  "BB1": {"label": "Single Microburst", "desc": "One isolated high-variability spike.", "category": "burst", "type": "atomic"},
  "BB2": {"label": "Burst Pair", "desc": "Two bursts within a short interval.", "category": "burst", "type": "atomic"},
  "BB3": {"label": "Burst Train", "desc": "Multiple bursts in succession.", "category": "burst", "type": "atomic"},
  "BB4": {"label": "Repeating Microburst Cluster", "desc": "Rapid repeating variability spikes.", "category": "burst", "type": "atomic"},

  # Thermal / Environmental Coupling
  "T1": {"label": "Thermal Drift", "desc": "Gradual thermal deviation correlated with instability.", "category": "thermal", "type": "atomic"},
  "T2": {"label": "Thermal Instability Spike", "desc": "Sharp thermal deviation with volatility.", "category": "thermal", "type": "atomic"},
  "T3": {"label": "Thermal-Flow Shift", "desc": "Temperature change coinciding with recovery/collapse.", "category": "thermal", "type": "atomic"},

  # Recovery / Harmonization
  "H1": {"label": "Partial Recovery", "desc": "Drift decreases but coherence remains low.", "category": "recovery", "type": "atomic"},
  "H2": {"label": "Harmonization Recovery", "desc": "Drift normalizes and coherence improves.", "category": "recovery", "type": "atomic"},
}
# -----------------------------
# DERIVED PATTERNS - V1 (10 STARTERS)
# Built from atomic combos/sequences (still non-medical)
# -----------------------------
DERIVED_PATTERNS = {
  "D1": {"label": "Sustained Drift + Slow Return", "desc": "N2 followed by R3/H1 patterning.", "category": "derived", "type": "derived", "requires": ["N2","R3"], "window_min": 60},
  "D2": {"label": "Drift + Coherence Collapse", "desc": "High drift with coherence collapse signature.", "category": "derived", "type": "derived", "requires": ["A4","C4"], "window_min": 10},
  "D3": {"label": "Repeating Microbursts", "desc": "BB4 recurrence within a short span.", "category": "derived", "type": "derived", "requires": ["BB4"], "window_min": 30},
  "D4": {"label": "Envelope Weakening Under Load", "desc": "N2 with resonance drift/break.", "category": "derived", "type": "derived", "requires": ["N2","R2"], "window_min": 30},
  "D5": {"label": "Fragmented Alignment Loop", "desc": "C3 recurrence with bursts.", "category": "derived", "type": "derived", "requires": ["C3","BB1"], "window_min": 30},
  "D6": {"label": "Thermal Coupled Instability", "desc": "Instability coincides with thermal deviation.", "category": "derived", "type": "derived", "requires": ["T2","A3"], "window_min": 20},
  "D7": {"label": "Resonance Lock + Recovery", "desc": "R4 with H2 proximity.", "category": "derived", "type": "derived", "requires": ["R4","H2"], "window_min": 30},
  "D8": {"label": "Unstable But Aligned", "desc": "High drift but coherence not collapsed (edge state).", "category": "derived", "type": "derived", "requires": ["A3","C1"], "window_min": 10},
  "D9": {"label": "Depletion Cascade", "desc": "Coherence drop + resonance drift/break.", "category": "derived", "type": "derived", "requires": ["C2","R2"], "window_min": 45},
  "D10":{"label": "Recovery Attempt Fails", "desc": "H1 repeats without H2 follow-through.", "category": "derived", "type": "derived", "requires": ["H1"], "window_min": 90},
}

def pattern_meta(pid: str) -> dict:
    if pid in PATTERN_LIBRARY:
        return PATTERN_LIBRARY[pid]
    if pid in DERIVED_PATTERNS:
        return DERIVED_PATTERNS[pid]
    return {"label": pid, "desc": "", "category": "unknown", "type": "unknown"}
# -----------------------------
# PROFILE HYPOTHESIS REGISTRY (RESEARCH-ONLY)
# -----------------------------
PROFILE_HYPOTHESIS_REGISTRY = {
  "registry_version": "1.0",
  "disclaimer": "Research-only hypothesis registry. Correlational. Not diagnostic. Not intended for medical use.",
  "profiles": [
    {
      "profile_id": "PH-MIG-001",
      "label_public": "Profile PH-MIG-001",
      "label_internal": "Migraine-Associated Pattern Profile (Hypothesis)",
      "visibility": "research_only",
      "status": "hypothesis",
      "associated_condition": "migraine",
      "cluster_rule": {"patterns": ["A4","BB4","C2"], "window_minutes": [30,120], "min_hits": 2},
      "requires_user_tags": ["migraine_episode"],
      "notes": "Activate only after enough tagged events; keep off consumer UI."
    },
    {
      "profile_id": "PH-ALS-001",
      "label_public": "Profile PH-ALS-001",
      "label_internal": "ALS-Associated Exploratory Profile (Hypothesis)",
      "visibility": "research_only",
      "status": "hypothesis",
      "associated_condition": "als",
      "cluster_rule": {"patterns": ["R2","C4","N2"], "window_minutes": [60,720], "min_hits": 2},
      "requires_user_tags": ["weakness_episode","cramp_episode"],
      "notes": "Exploratory. Requires serious validation. Never consumer-facing."
    }
  ]
}
def _fetch_recent_rows_for_user(uid: int, limit: int = 2000):
    """
    Returns rows ordered ASC by time:
    [(eeg, ecg, temperature, light, noise, timestamp), ...]
    """
    conn = get_conn()
    c = conn.cursor()
    c.execute(
        """
        SELECT eeg, ecg, temperature, light, noise, timestamp
        FROM readings
        WHERE user_id = ?
        ORDER BY id DESC
        LIMIT ?
        """,
        (uid, limit),
    )
    rows = c.fetchall()
    conn.close()
    rows.reverse()
    return rows
def _et_day_string(dt: datetime | None = None) -> str:
    dt = dt or datetime.now(ET)
    return dt.date().isoformat()  # YYYY-MM-DD

def _fetch_rows_for_user_day(uid: int, day_yyyy_mm_dd: str):

    start = f"{day_yyyy_mm_dd}T00:00:00"
    end = f"{day_yyyy_mm_dd}T23:59:59"

    conn = get_conn()
    c = conn.cursor()

    c.execute(
    """
    SELECT eeg, ecg, temperature, light, noise, timestamp
    FROM readings
    WHERE user_id = ?
    AND timestamp >= ?
    AND timestamp <= ?
    ORDER BY timestamp ASC
    """,
    (uid, start, end),
    )

    rows = c.fetchall()
    conn.close()
    return rows

def compute_daily_index_sqlite(uid: int, day_yyyy_mm_dd: str):
    # 1) cache check
    conn = get_conn()
    c = conn.cursor()
    c.execute("SELECT * FROM ashwin_daily WHERE user_id=? AND day=?", (uid, day_yyyy_mm_dd))
    cached = c.fetchone()
    conn.close()
    if cached:
        return dict(cached)

    # 2) compute from readings
    rows = _fetch_rows_for_user_day(uid, day_yyyy_mm_dd)
    if not rows:
        return None

    r = compute_ashwin_index_v1(rows)

    rec = {
        "user_id": uid,
        "day": day_yyyy_mm_dd,
        "index_value": float(r["index"]),
        "level": r.get("level", ""),
        "color": r.get("color", ""),
        "brain_score": float(r.get("brain_calm_score", 0)),
        "heart_score": float(r.get("heart_rhythm_score", 0)),
        "temp_score": float(r.get("temp_stability_score", 0)),
        "env_score": float(r.get("environment_score", 0)),
        "recovery_score": float(r.get("recovery_score", 0)),
        "harmony_score": float(r.get("harmony_score", 0)),
        "confidence": float(r.get("confidence", 0)),
        "created_at": datetime.utcnow().isoformat(),
    }

    conn = get_conn()
    c = conn.cursor()
    c.execute(
        """
        INSERT OR REPLACE INTO ashwin_daily(
            user_id, day, index_value, level, color,
            brain_score, heart_score, temp_score, env_score,
            recovery_score, harmony_score, confidence, created_at
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
        """,
        (
            rec["user_id"], rec["day"], rec["index_value"], rec["level"], rec["color"],
            rec["brain_score"], rec["heart_score"], rec["temp_score"], rec["env_score"],
            rec["recovery_score"], rec["harmony_score"], rec["confidence"], rec["created_at"],
        ),
    )
    conn.commit()
    conn.close()
    return rec


def evaluate_profile_hypotheses_from_events(events: list[dict]) -> list[dict]:
    """
    Research-only: evaluate simple cluster_rule counts from the event stream.
    events: list of {pattern_id or id, ...}
    Returns list of profile hit summaries (NOT diagnostic).
    """
    ids = [e.get("pattern_id") or e.get("id") for e in events]
    ids = [x for x in ids if x]

    results = []
    for prof in PROFILE_HYPOTHESIS_REGISTRY.get("profiles", []):
        rule = prof.get("cluster_rule", {})
        pats = set(rule.get("patterns", []))
        min_hits = int(rule.get("min_hits", 1))

        hit_count = sum(1 for x in ids if x in pats)

        results.append({
            "profile_id": prof.get("profile_id"),
            "label_public": prof.get("label_public"),
            "visibility": prof.get("visibility", "research_only"),
            "status": prof.get("status", "hypothesis"),
            "associated_condition": prof.get("associated_condition"),
            "hit_count": hit_count,
            "min_hits": min_hits,
            "patterns": list(pats),
            "window_minutes": rule.get("window_minutes", []),
            "requires_user_tags": prof.get("requires_user_tags", []),
            "notes": prof.get("notes", ""),
            "disclaimer": PROFILE_HYPOTHESIS_REGISTRY.get("disclaimer", ""),
            "hit": hit_count >= min_hits,
        })
    return results

def aggregate_zone_pattern_profile(points: list[dict], events: list[dict]) -> dict:
    # zone -> pattern counts
    zone_pattern_counts: dict[str, dict[str, int]] = {}
    for e in events:
        zid = e.get("zone_id") or e.get("zone") or "Z?"
        pid = e.get("pattern_id") or e.get("id") or "UNK"
        zone_pattern_counts.setdefault(zid, {})
        zone_pattern_counts[zid][pid] = zone_pattern_counts[zid].get(pid, 0) + 1

    # profile -> hit + contributing patterns + zone distribution
    hypotheses = evaluate_profile_hypotheses_from_events(events)
    profile_zone_counts: dict[str, dict[str, int]] = {}

    # For each profile, count how often its rule patterns appeared per zone
    for prof in PROFILE_HYPOTHESIS_REGISTRY.get("profiles", []):
        prof_id = prof.get("profile_id")
        rule_pats = set((prof.get("cluster_rule") or {}).get("patterns", []))

        profile_zone_counts[prof_id] = {}
        for e in events:
            pid = e.get("pattern_id") or e.get("id")
            if pid in rule_pats:
                zid = e.get("zone_id") or e.get("zone") or "Z?"
                profile_zone_counts[prof_id][zid] = profile_zone_counts[prof_id].get(zid, 0) + 1

    return {
        "zone_pattern_counts": zone_pattern_counts,
        "hypotheses": hypotheses,
        "profile_zone_counts": profile_zone_counts,
    }
def weather_radar_frames(points: list[dict], events: list[dict], frame_step: int = 5):
    """
    Builds lightweight frames for a radar UI.
    Every frame corresponds to one point (or every N points via frame_step).
    Output frames contain:
      - time
      - per-zone intensity (0-100)
      - per-zone top patterns (1-3)
    """
    # index events by timestamp for quick lookup
    ev_by_t: dict[str, list[dict]] = {}
    for e in events:
        t = str(e.get("t"))
        ev_by_t.setdefault(t, []).append(e)

    frames = []
    for idx in range(0, len(points), max(1, frame_step)):
        p = points[idx]
        t = str(p["t"])
        zid = p.get("zone_id", "Z?")
        drift = float(p.get("drift", 0))
        coh = float(p.get("coherence", 0))
        res = float(p.get("resonance", 0))
        harm = float(p.get("harmony", 0))

        # A simple intensity composite you can tune later:
        # Higher drift = more “storm”; lower coherence/resonance = more “storm”
        intensity = round(
            min(100.0, max(0.0, (drift * 0.55) + ((100 - coh) * 0.25) + ((100 - res) * 0.20))),
            2
        )

        zone_payload = {
            "zone_id": zid,
            "zone_label": p.get("zone_label", zid),
            "zone_conf": p.get("zone_conf", 0.0),
            "intensity": intensity,
            "harmony": harm,
            "drift": drift,
            "coherence": coh,
            "resonance": res,
            "top_patterns": []
        }

        # attach up to 3 top patterns at this timestamp
        evs = ev_by_t.get(t, [])
        if evs:
            # already sorted earlier; if not, just take first few
            zone_payload["top_patterns"] = [
                {
                    "pattern_id": e.get("pattern_id") or e.get("id"),
                    "label": e.get("label", ""),
                    "desc": e.get("desc", "")
                }
                for e in evs[:3]
            ]

        frames.append({
            "t": t,
            "zones": [zone_payload],  # v1: current dominant zone only; later: all zones per frame
        })

    return frames

# -------------------------------------------------
# ---------- PATTERN + ZONE EVENT TAGGING ----------
# -------------------------------------------------

def detect_atomic_patterns_for_point(
    drift: float,
    coherence: float,
    resonance: float,
    prev_drift: float | None = None,
    prev_resonance: float | None = None,
):
    """
    Returns list of pattern IDs for this point (atomic/derived heuristic).
    Non-medical. This is a signal behavior tagger.
    """
    hits: list[str] = []

    # -----------------------
    # Atomic: Drift patterns
    # -----------------------
    if drift >= 85:
        hits.append("A4")   # sustained instability class (heuristic)
    elif drift >= 70:
        hits.append("A3")   # acute spike class (heuristic)
    elif drift >= 55:
        hits.append("N2")   # ramp-ish / building load proxy
    elif drift >= 25:
        hits.append("N1")   # minor oscillation proxy

    # ---------------------------
    # Atomic: Coherence patterns
    # ---------------------------
    if coherence <= 25:
        hits.append("C4")
    elif coherence <= 40:
        hits.append("C2")
    elif coherence <= 60:
        hits.append("C1")

    # --------------------------
    # Atomic: Resonance patterns
    # --------------------------
    if resonance <= 25:
        hits.append("R3")
    elif resonance <= 45:
        hits.append("R2")
    elif resonance >= 80:
        hits.append("R4")
    else:
        hits.append("R1")

    # -----------------------------------------
    # Atomic/Burst proxies (quick heuristics)
    # -----------------------------------------
    # Burst proxy: sharp drift change
    if prev_drift is not None and abs(drift - prev_drift) >= 18:
        hits.append("BB1")

    # Resonance break proxy: sharp resonance drop
    if prev_resonance is not None and (prev_resonance - resonance) >= 22:
        hits.append("R3")

    # -----------------------------------------
    # Derived tags (lightweight v1 heuristics)
    # NOTE: These are "sentence" tags from atomic hits
    # -----------------------------------------
    if "N2" in hits and ("R2" in hits or "R3" in hits):
        hits.append("D4")  # Envelope weakening under load (proxy)

    if "A4" in hits and "C4" in hits:
        hits.append("D2")  # Drift + coherence collapse

    if "C2" in hits and "R2" in hits:
        hits.append("D9")  # Depletion cascade

    # This one requires C3, but your current atomic logic doesn't emit C3 yet.
    # Keep it anyway for future expansion - it will simply not trigger until C3 exists.
    if "BB1" in hits and "C3" in hits:
        hits.append("D5")  # Fragmented alignment loop

    # -----------------------------------------
    # De-dupe while keeping order
    # DO NOT require presence in PATTERN_LIBRARY
    # -----------------------------------------
    out: list[str] = []
    for p in hits:
        if p not in out:
            out.append(p)

    return out

def build_live_points_and_events(rows):
    """
    rows = [(eeg, ecg, temp, light, noise, ts), ...]
    Returns:
      points: list of {t, harmony, drift, coherence, resonance, zone_id, zone_label, zone_conf}
      events: list of {t, pattern_id, label, desc, zone_id, zone_label, zone_conf}
    """
    if not rows:
        return [], []

    # series
    drift_s = compute_drift_series(rows)
    coh_s   = compute_coherence_series(rows)
    res_s   = compute_resonance_series(rows)
    harm_s  = [calc_harmony(r[0], r[1], r[2]) for r in rows]

    events = []
    points = []

    prev_d = None
    prev_r = None

    # Priority: show the most “important” tags first.
    # Include derived tags near the top so they can surface.
    priority = [
        # Derived (sentences)
        "D2", "D4", "D9", "D5", "D1", "D3", "D6", "D7", "D8", "D10",

        # Drift / instability
        "A4", "A3", "N2", "N1",

        # Coherence
        "C4", "C3", "C2", "C1",

        # Resonance
        "R3", "R2", "R4", "R1",

        # Bursts
        "BB4", "BB3", "BB2", "BB1",

        # Thermal
        "T2", "T3", "T1",

        # Recovery
        "H2", "H1",
    ]

    # Faster lookup than priority.index() in a loop
    prio_rank = {pid: i for i, pid in enumerate(priority)}

    for i, (eeg, ecg, temp, light, noise, ts) in enumerate(rows):
        # drift
        try:
            d = float(drift_s[i]) if i < len(drift_s) else 0.0
        except Exception:
            d = 0.0
        d = max(0.0, min(100.0, d))

        # coherence
        try:
            c = float(coh_s[i]) if i < len(coh_s) else 0.0
        except Exception:
            c = 0.0
        c = max(0.0, min(100.0, c))

        # resonance
        try:
            r = float(res_s[i]) if i < len(res_s) else 0.0
        except Exception:
            r = 0.0
        r = max(0.0, min(100.0, r))

        # harmony
        try:
            h = float(harm_s[i]) if i < len(harm_s) else 0.0
        except Exception:
            h = 0.0
        h = max(0.0, min(100.0, h))

        # zone per-point (your existing infer_zone)
        z_id, z_label, z_conf = infer_zone(eeg, ecg, temp, light, noise)

        points.append({
            "t": str(ts),
            "harmony": round(h, 2),
            "drift": round(d, 2),
            "coherence": round(c, 2),
            "resonance": round(r, 2),
            "zone_id": z_id,
            "zone_label": z_label,
            "zone_conf": round(float(z_conf), 2),
        })

        # pattern tags for this point (atomic + derived heuristics)
        hits = detect_atomic_patterns_for_point(
            d, c, r,
            prev_drift=prev_d,
            prev_resonance=prev_r
        )
        prev_d, prev_r = d, r

        # Keep top 1-2 per point to avoid spam
        hits_sorted = sorted(hits, key=lambda x: prio_rank.get(x, 999))[:2]

        for pid in hits_sorted:
            meta = pattern_meta(pid)  # ✅ unified resolver for atomic + derived
            events.append({
                "t": str(ts),
                "pattern_id": pid,
                "label": meta.get("label", pid),
                "desc": meta.get("desc", ""),
                "zone_id": z_id,
                "zone_label": z_label,
                "zone_conf": round(float(z_conf), 2),
            })

    return points, events


# -------------------------------------------------
# ---------- RESEARCH / PARTNER ENDPOINTS ----------
# -------------------------------------------------

@app.get("/research/registry")
def research_registry(x_ashwin_key: str | None = Header(default=None)):
    require_partner_key(x_ashwin_key)
    return PROFILE_HYPOTHESIS_REGISTRY


@app.get("/research/hypotheses/{uid}")
def research_hypotheses(
    uid: int,
    limit: int = 2000,
    x_ashwin_key: str | None = Header(default=None),
):
    require_partner_key(x_ashwin_key)

    rows = _fetch_recent_rows_for_user(uid, limit=limit)
    points, events = build_live_points_and_events(rows)

    return {
        "uid": uid,
        "counts": {"points": len(points), "events": len(events)},
        "hypotheses": evaluate_profile_hypotheses_from_events(events),
        "disclaimer": PROFILE_HYPOTHESIS_REGISTRY.get("disclaimer", ""),
    }


@app.get("/research/aggregation/{uid}")
def research_aggregation(
    uid: int,
    limit: int = 2000,
    x_ashwin_key: str | None = Header(default=None),
):
    require_partner_key(x_ashwin_key)

    rows = _fetch_recent_rows_for_user(uid, limit=limit)
    points, events = build_live_points_and_events(rows)
    agg = aggregate_zone_pattern_profile(points, events)

    # Optional "alive" feel: include most recent radar frame
    latest_frames = weather_radar_frames(points, events, frame_step=1)
    latest_frame = latest_frames[-1] if latest_frames else None

    return {
        "uid": uid,
        "counts": {"points": len(points), "events": len(events)},
        **agg,
        "latest_frame": latest_frame,
        "disclaimer": PROFILE_HYPOTHESIS_REGISTRY.get("disclaimer", ""),
    }


@app.get("/research/export/{uid}.pdf")
def research_export_pdf(
    uid: int,
    limit: int = 2000,
    x_ashwin_key: str | None = Header(default=None),
):
    require_partner_key(x_ashwin_key)

    rows = _fetch_recent_rows_for_user(uid, limit=limit)
    points, events = build_live_points_and_events(rows)
    agg = aggregate_zone_pattern_profile(points, events)
    hyps = evaluate_profile_hypotheses_from_events(events)

    import io
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=letter)
    w, h = letter

    y = h - 50
    c.setFont("Helvetica-Bold", 16)
    c.drawString(50, y, f"Ashwin Research Snapshot - User {uid}")
    y -= 22

    c.setFont("Helvetica", 10)
    c.drawString(
        50,
        y,
        "Non-diagnostic. Research-only. Correlational. Not intended for medical use."
    )
    y -= 18

    c.setFont("Helvetica-Bold", 12)
    c.drawString(50, y, "Counts")
    y -= 14
    c.setFont("Helvetica", 10)
    c.drawString(50, y, f"Points: {len(points)} | Events: {len(events)}")
    y -= 18

    c.setFont("Helvetica-Bold", 12)
    c.drawString(50, y, "Top Zone → Pattern Counts (sample)")
    y -= 14
    c.setFont("Helvetica", 10)

    zpc = agg.get("zone_pattern_counts", {})
    lines = 0
    for zid, pats in zpc.items():
        top = sorted(pats.items(), key=lambda x: x[1], reverse=True)[:5]
        c.drawString(
            50,
            y,
            f"{zid}: " + ", ".join([f"{pid}({cnt})" for pid, cnt in top])
        )
        y -= 12
        lines += 1
        if lines >= 10 or y < 120:
            break

    y -= 10
    c.setFont("Helvetica-Bold", 12)
    c.drawString(50, y, "Hypothesis Registry Evaluation (research-only)")
    y -= 14
    c.setFont("Helvetica", 10)

    for hp in hyps[:10]:
        c.drawString(
            50,
            y,
            f"{hp['profile_id']} | hits={hp['hit_count']}/{hp['min_hits']} | hit={hp['hit']}"
        )
        y -= 12
        if y < 80:
            break

    c.showPage()
    c.save()

    pdf = buf.getvalue()
    buf.close()
    return Response(content=pdf, media_type="application/pdf")


@app.get("/research/window/{uid}")
def research_window(
    uid: int,
    hours: int = 6,
    limit: int = 2000,
    x_ashwin_key: str | None = Header(default=None),
):
    require_partner_key(x_ashwin_key)

    rows = _fetch_recent_rows_for_user(uid, limit=limit)
    points, events = build_live_points_and_events(rows)
    frames = weather_radar_frames(points, events, frame_step=5)

    return {
        "uid": uid,
        "hours_requested": hours,
        "counts": {
            "points": len(points),
            "events": len(events),
            "frames": len(frames),
        },
        "frames": frames,
        "disclaimer": PROFILE_HYPOTHESIS_REGISTRY.get("disclaimer", ""),
    }




# -------------------------------------------------
# LEGACY - SINGLE-PATTERN REDUCER (DO NOT USE FOR LIVE PIPELINE)
# -------------------------------------------------
# This function is intentionally retained for:
# - backward compatibility
# - debugging / reduced views
# - historical comparison
#
# SOURCE OF TRUTH:
#   detect_atomic_patterns_for_point()
#   build_live_points_and_events()
#
# This function MUST NOT be called by any route.
# -------------------------------------------------

def classify_patterns(rows, drift_vals, coh_vals, res_vals):
    """
    LEGACY reducer.
    Produces a simplified, single-pattern-per-point stream.
    Non-medical. Reference only.
    """
    out = []

    for i, r in enumerate(rows):
        eeg, ecg, temp, light, noise, ts = r[0], r[1], r[2], r[3], r[4], r[5]

        zid, _zlabel, zconf = infer_zone(eeg, ecg, temp, light, noise)
        d = drift_vals[i] if i < len(drift_vals) else 0.0
        c = coh_vals[i] if i < len(coh_vals) else 50.0
        rns = res_vals[i] if i < len(res_vals) else 50.0

        pid = None

        # Legacy priority logic (intentionally coarse)
        if d >= 80:
            pid = "A4"
        elif d >= 60:
            pid = "A3"
        elif c <= 35:
            pid = "C4"
        elif rns <= 30:
            pid = "R3"
        elif abs(98.6 - safe(temp, 98.6)) > 1.2:
            pid = "T3"
        elif d <= 25 and c >= 70:
            pid = "H2"

        if pid:
            meta = pattern_meta(pid)
            out.append({
                "t": ts,
                "id": pid,
                "label": meta.get("label", pid),
                "desc": meta.get("desc", ""),
                "intensity": round(float(d), 2),
                "zone": zid,
                "zone_label": ZONE_DICT.get(zid, zid),
                "zone_confidence": round(float(zconf), 2),
                "confidence": 0.65,
                "legacy": True,
            })

    return out

# ---- BUILD TAG (top-level, once in file) ----
BUILD_TAG = "radar-frames-ON-2026-01-05"

@app.get("/patterns/{uid}")
def patterns(
    uid: int,
    limit: int = Query(2000),
    frame_step: int = Query(5),
    range_key: str = Query("session", alias="range"),
    start: str | None = Query(default=None),
    end: str | None = Query(default=None),
):
    """
    Unified Radar endpoint.
    Uses SAME dataset as /board and /tags.
    """

    # -------------------------------------------------
    # 1️⃣ Unified window fetch
    # -------------------------------------------------
    rows = get_window_rows(uid, range_key, start, end)

    if limit and len(rows) > limit:
        rows = rows[-limit:]

    if not rows:
        return JSONResponse({
            "build_tag": BUILD_TAG,
            "has_radar_frames": False,
            "range": range_key,
            "pattern_library": PATTERN_LIBRARY,
            "zones": ZONES,
            "counts": {"rows": 0, "points": 0, "events": 0, "frames": 0},
            "points": [],
            "events": [],
            "radar_frames": [],
            "pattern_counts": {},
            "zone_counts": {},
        })

    # -------------------------------------------------
    # 2️⃣ Build patterns from SAME rows
    # -------------------------------------------------
    points, events = build_live_points_and_events(rows)

    # -------------------------------------------------
    # 3️⃣ Downsample for radar
    # -------------------------------------------------
    step = max(1, int(frame_step or 1))
    pts = points[::step] if points else []

    radar_frames = [
        {
            "t": p.get("t"),
            "harmony": p.get("harmony", 0),
            "zone_id": p.get("zone_id", ""),
            "zone_label": p.get("zone_label", ""),
            "zone_conf": p.get("zone_conf", 0.0),
            "patterns": p.get("patterns", []),
        }
        for p in pts
    ]

    pat_counts = Counter(
        [e.get("pattern_id") for e in events if e.get("pattern_id")]
    )

    zone_counts = Counter(
        [p.get("zone_id") for p in pts if p.get("zone_id")]
    )

    return JSONResponse({
        "build_tag": BUILD_TAG,
        "has_radar_frames": len(radar_frames) > 0,
        "range": range_key,
        "pattern_library": PATTERN_LIBRARY,
        "zones": ZONES,
        "counts": {
            "rows": len(rows),
            "points": len(points),
            "events": len(events),
            "frames": len(radar_frames),
        },
        "points": pts,
        "events": events,
        "radar_frames": radar_frames,
        "pattern_counts": dict(pat_counts),
        "zone_counts": dict(zone_counts),
    })


# ✅ UPDATED /api/board_snapshot (adds drift + max_drift; nothing else removed)
@app.get("/api/board_snapshot")
def api_board_snapshot(
    user: int = Query(1),
    range_key: str = Query("session", alias="range"),
    limit: int = Query(2000),
    start: str | None = Query(default=None),
    end: str | None = Query(default=None),  
    ):
    """
    Live snapshot for /board (no refresh).
    Returns: KPIs + charts + patterns + zones + radar + table HTML.
    """

    # 1) Fetch rows (UNIFIED WINDOW LOGIC)
    rows = get_window_rows(user, range_key, start, end)

    # ✅ WINDOW FALLBACK LOGIC
    if not rows and range_key != "session":
      rows = get_window_rows(user, "session")

    # Apply limit if needed
    if limit and len(rows) > limit:
      rows = rows[-limit:]

    if not rows:
    
      return JSONResponse({
        "has_data": False,
        "user": user,
        "range": range_key,
        "message": "No readings found for this user."
    })

    # rest of function continues...

    # -------------------------------------------------
    # 2) Unified Pattern Engine (SAME DATASET)
    # -------------------------------------------------

    points, events = build_live_points_and_events(rows)

    pat_counts = Counter(
        [e.get("pattern_id") for e in events if e.get("pattern_id")]
    )

    zone_counts = Counter(
        [p.get("zone_id") for p in points if p.get("zone_id")]
    )

    dominant_zone = max(zone_counts, key=zone_counts.get) if zone_counts else None

    radar_frames = [
        {
            "t": p.get("t"),
            "harmony": p.get("harmony", 0),
            "zone_id": p.get("zone_id", ""),
            "zone_label": p.get("zone_label", ""),
            "zone_conf": p.get("zone_conf", 0.0),
            "patterns": p.get("patterns", []),
        }
        for p in points
    ]

# -------------------------------------------------
# 3) Build raw arrays
# -------------------------------------------------

    times_raw = []
    eeg_vals = []
    ecg_vals = []
    temp_vals = []
    light_vals = []
    noise_vals = []
    harmonies = []
    autonomic_vals = []

    for (eeg, ecg, temp, light, noise, ts) in rows:

      times_raw.append(parse_iso_to_et(ts))

    eeg_vals.append(safe(eeg))
    ecg_vals.append(safe(ecg))
    temp_vals.append(safe(temp, 98.6))
    light_vals.append(safe(light))
    noise_vals.append(safe(noise))

    harmonies.append(calc_harmony(eeg, ecg, temp))

    # Emotional / Autonomic signal
    autonomic = abs(safe(eeg) - safe(ecg))
    autonomic_vals.append(autonomic)


    # -------------------------------------------------
    # 4) Drift
    # -------------------------------------------------

    drifts = [
        abs(harmonies[i] - harmonies[i - 1])
        for i in range(1, len(harmonies))
    ]

    avg_drift = round(mean(drifts), 3) if drifts else 0.0
    max_drift = round(max(drifts), 3) if drifts else 0.0

    # -------------------------------------------------
    # 5) Core stats
    # -------------------------------------------------

    avg_harmony = round(mean(harmonies), 2) if harmonies else 0.0
    min_h = round(min(harmonies), 2) if harmonies else 0.0
    max_h = round(max(harmonies), 2) if harmonies else 0.0

    n = len(harmonies)
    mid = max(1, n // 2)

    before = harmonies[:mid]
    after = harmonies[mid:]

    avg_before = round(mean(before), 2) if before else 0.0
    avg_after = round(mean(after), 2) if after else 0.0

    improvement = (
        round(((avg_after - avg_before) / avg_before) * 100, 2)
        if avg_before and len(harmonies) > 1
        else 0.0
    )

    stability = 0.0
    try:
        if len(before) >= 2 and len(after) >= 2:
          bstd = pstdev(before)
          astd = pstdev(after)
          stability = round(((bstd - astd) / bstd) * 100, 2) if bstd else 0.0
    except Exception:
      stability = 0.0

    hri = round((improvement + stability) / 2, 2)

    # -------------------------------------------------
    # 6) Zone inference (window-based)
    # -------------------------------------------------

    zone = infer_zone_from_window(eeg_vals, ecg_vals, temp_vals)

    # -------------------------------------------------
    # 7) Latest timestamp (range-limited)
    # -------------------------------------------------

    last_ts_et = parse_iso_to_et(rows[-1][5]) if rows else "-"

    # -------------------------------------------------
    # 8) Charts
    # -------------------------------------------------

    chart_times, chart_harmonies, chart_eeg, chart_ecg = downsample_and_smooth(
        times_raw, harmonies, eeg_vals, ecg_vals, step=5, window=20
    )

    # -------------------------------------------------
    # 9) Table (last 40 rows)
    # -------------------------------------------------

    raw_rows_html = ""
    for (eeg, ecg, temp, light, noise, ts), h in zip(rows[-40:], harmonies[-40:]):
        raw_rows_html += (
            f"<tr>"
            f"<td>{parse_iso_to_et(ts)}</td>"
            f"<td>{safe(eeg):.2f}</td>"
            f"<td>{safe(ecg):.2f}</td>"
            f"<td>{safe(temp, 98.6):.2f}</td>"
            f"<td>{safe(light):.2f}</td>"
            f"<td>{safe(noise):.2f}</td>"
            f"<td>{h:.2f}</td>"
            f"</tr>"
        )

    # -------------------------------------------------
    # FINAL UNIFIED RESPONSE
    # -------------------------------------------------

        return JSONResponse({
        "has_data": True,
        "user": user,
        "range": range_key,
        "last_ts_et": last_ts_et,

        "kpis": {
            "avg_harmony": avg_harmony,
            "min_h": min_h,
            "max_h": max_h,
            "avg_before": avg_before,
            "avg_after": avg_after,
            "improvement": improvement,
            "stability": stability,
            "hri": hri,
            "avg_drift": avg_drift,
            "max_drift": max_drift,
            "zone_label": zone.get("zone_label", ""),
            "zone_conf": zone.get("confidence", 0.0),
        },

        "charts": {
            "times": chart_times,
            "harmonies": chart_harmonies,
            "eeg": chart_eeg,
            "ecg": chart_ecg,
        },

        "patterns": {
            "events": events,
            "pattern_counts": dict(pat_counts),
        },

        "zones": {
            "dominant_zone": dominant_zone,
            "zone_counts": dict(zone_counts),
        },

        "radar_frames": radar_frames,

        "tables": {
            "raw_rows_html": raw_rows_html
        }
    })

# ---------- Correlation Helper (Pearson) ----------
def pearson(xs: list, ys: list):
    """
    Compute Pearson correlation coefficient between two sequences.
    Returns float or None if insufficient data.
    """
    if len(xs) < 3 or len(ys) < 3:
      return None

    mx, my = mean(xs), mean(ys)

    # numerator
    num = sum((x - mx) * (y - my) for x, y in zip(xs, ys))

    # denominator
    denx = sum((x - mx)**2 for x in xs)
    deny = sum((y - my)**2 for y in ys)

    if denx == 0 or deny == 0:
        return None

    return round(num / ((denx * deny) ** 0.5), 3)


# -------------------------------------------------
# ---------- ZONES (inferred field regions) ----------
# -------------------------------------------------

def _series_stats(vals: list[float]):
    if not vals:
        return {"mean": 0.0, "std": 0.0, "min": 0.0, "max": 0.0}
    m = mean(vals)
    s = pstdev(vals) if len(vals) > 1 else 0.0
    return {"mean": m, "std": s, "min": min(vals), "max": max(vals)}

def infer_zone_from_window(eeg_vals: list[float], ecg_vals: list[float], temp_vals: list[float]):
    """
    Zones are inferred field behavior regions, NOT organs.
    Returns: zone_id (1-3), zone_label, confidence (0-1), reasons[]
    """
    eeg_s = _series_stats(eeg_vals)
    ecg_s = _series_stats(ecg_vals)
    tmp_s = _series_stats(temp_vals)

    # Basic features
    amplitude = (eeg_s["mean"] + ecg_s["mean"]) / 2.0
    variability = (eeg_s["std"] + ecg_s["std"]) / 2.0

    coupling = 0.0
    r = pearson(eeg_vals, ecg_vals)
    coupling = abs(r) if r is not None else 0.0

    reasons = []
    if variability > 18 and coupling > 0.35:
        zone_id = 1
        zone_label = "Z1 - Proximal / High-Variability Dominance"
        reasons.append("Higher variability + stronger coupling")
    elif variability > 10 and coupling > 0.20:
        zone_id = 2
        zone_label = "Z2 - Mid-Band / Mixed Dominance"
        reasons.append("Moderate variability + moderate coupling")
    else:
        zone_id = 3
        zone_label = "Z3 - Broad / Low-Variability Dominance"
        reasons.append("Lower variability and/or weaker coupling")

    confidence = max(0.15, min(1.0, (coupling * 0.6) + (min(variability / 25.0, 1.0) * 0.4)))
    confidence = round(confidence, 2)

    return {
        "zone_id": zone_id,
        "zone_label": zone_label,
        "confidence": confidence,
        "features": {
            "amplitude": round(amplitude, 2),
            "variability": round(variability, 2),
            "coupling": round(coupling, 3),
            "temp_std": round(tmp_s["std"], 2),
        },
        "reasons": reasons,
        "disclaimer": "Zones are inferred field behavior regions, not anatomical localization."
    }

def get_recent_rows_for_user(user_id: int, limit: int = 120):
    conn = get_conn()
    c = conn.cursor()
    c.execute("""
        SELECT eeg, ecg, temperature, light, noise, timestamp
        FROM readings
        WHERE user_id = ?
        ORDER BY timestamp DESC
        LIMIT ?
    """, (user_id, limit))
    rows = c.fetchall()
    conn.close()

    rows = [tuple(r) for r in rows]
    rows.reverse()
    return rows

from datetime import datetime, timedelta
from typing import Optional
from pydantic import BaseModel

class TagIn(BaseModel):
    user_id: int
    tag_type: str
    start_ts: Optional[str] = None
    end_ts: Optional[str] = None
    note: Optional[str] = None
    severity: Optional[int] = None

@app.post("/tags")
def create_tag(t: TagIn):
    conn = get_conn()
    c = conn.cursor()

    now_iso = datetime.utcnow().isoformat(timespec="seconds")
    start_ts = t.start_ts or now_iso

    sev = t.severity
    if sev is not None:
        try:
            sev = int(sev)
        except Exception:
            sev = None
        if sev is not None:
            sev = max(1, min(10, sev))

    c.execute(
        """
        INSERT INTO user_tags(user_id, tag_type, start_ts, end_ts, note, severity, created_at)
        VALUES(?,?,?,?,?,?,?)
        """,
        (t.user_id, t.tag_type.strip(), start_ts, t.end_ts, t.note, sev, now_iso),
    )

    tag_id = c.lastrowid
    conn.commit()
    conn.close()

    return {
        "status": "ok",
        "id": tag_id,
        "user_id": t.user_id,
        "tag_type": t.tag_type.strip(),
        "start_ts": start_ts,
        "end_ts": t.end_ts,
    }

def _cutoff_iso_for_range(range_key: str) -> Optional[str]:
    now = datetime.utcnow()

    if range_key == "10m":
        return to_sqlite_dt(now - timedelta(minutes=10))
    if range_key == "30m":
        return to_sqlite_dt(now - timedelta(minutes=30))
    if range_key == "1h":
        return to_sqlite_dt(now - timedelta(hours=1))
    if range_key == "6h":
        return to_sqlite_dt(now - timedelta(hours=6))
    if range_key == "24h":
        return to_sqlite_dt(now - timedelta(hours=24))
    if range_key == "7d":
        return to_sqlite_dt(now - timedelta(days=7))

    return None


@app.get("/tags/{uid}")
def get_tags(
    uid: int,
    range_key: str = Query("session", alias="range"),
    start: str | None = Query(default=None),
    end: str | None = Query(default=None),
    limit: int = Query(200),
):
    # -------------------------------------------------
    # 1️⃣ Get unified window rows
    # -------------------------------------------------
    rows = get_window_rows(uid, range_key, start, end)

    if not rows:
        return []

    # Window bounds derived from actual readings
    window_start = rows[0][5]
    window_end = rows[-1][5]

    conn = get_conn()
    c = conn.cursor()

    # -------------------------------------------------
    # 2️⃣ Fetch tags inside SAME window
    # -------------------------------------------------
    c.execute(
        """
        SELECT id, tag_type, start_ts, end_ts, note, severity, created_at
        FROM user_tags
        WHERE user_id=?
        AND datetime(start_ts) >= datetime(?)
        AND datetime(start_ts) <= datetime(?)
        ORDER BY datetime(start_ts) DESC
        LIMIT ?
        """,
        (uid, window_start, window_end, limit),
    )

    rows = c.fetchall()
    conn.close()

    # -------------------------------------------------
    # 3️⃣ Return dict format
    # -------------------------------------------------
    out = []
    for (id_, tag_type, start_ts, end_ts, note, severity, created_at) in rows:
        out.append(
            {
                "id": id_,
                "tag_type": tag_type,
                "start_ts": start_ts,
                "end_ts": end_ts,
                "note": note,
                "severity": severity,
                "created_at": created_at,
            }
        )

    return out


@app.get("/api/recent")
def api_recent(
    user: int = Query(1),
    limit: int = Query(120),
):
    """
    Returns recent points + tagged events (pattern + zone).
    Non-medical. Used by /board live strip.
    """
    # IMPORTANT:
    # Replace this with the SAME query logic you already use in /board to build `rows`.
    # rows must be list of tuples: (eeg, ecg, temp, light, noise, ts)
    rows = get_recent_rows_for_user(user, limit=limit)

    points, events = build_live_points_and_events(rows)

    # trim events to last ~40 so UI stays clean
    events = events[-40:]

    return JSONResponse({
        "user": user,
        "points": points,
        "events": events,
        "disclaimer": "Pattern + zone tags are non-diagnostic behavioral labels for research/wellness visualization only."
    })
@app.get("/debug/tables")
def debug_tables():
    conn = get_conn()
    c = conn.cursor()
    c.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = [t[0] for t in c.fetchall()]
    conn.close()
    return {"tables": tables}


# ✅ DEBUG: confirm which DB file the backend is actually using
@app.get("/debug/dbpath")
@app.get("/debug/runtime")
def debug_runtime():
    import inspect, os, sys
    m = sys.modules[__name__]
    return {
        "cwd": os.getcwd(),
        "main_file": getattr(m, "__file__", None),
        "db_path_var": getattr(m, "DB_PATH", None),
        "api_recent_src_head": inspect.getsource(m.api_recent).splitlines()[:25],
    }


def debug_dbpath():
    import os
    return {
        "cwd": os.getcwd(),
        "db_abspath": os.path.abspath("ashwin.db")
    }


def to_sqlite_dt(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%d %H:%M:%S")


# -------------------------------------------------
# ---------- PATTERN REVIEW QUEUE (Milestone 4) ----------
# -------------------------------------------------

def _sig_from_pattern_counts(pc: dict) -> str:
    """
    Make a stable signature string from pattern counts.
    Keep only top few patterns so signatures are comparable.
    """
    if not pc:
        return "EMPTY"
    top = sorted(pc.items(), key=lambda x: (-x[1], x[0]))[:6]
    return "|".join([f"{k}:{v}" for k, v in top])


@app.post("/review_queue/run/{uid}")
def review_queue_run(uid: int, hours: int = 6, min_repeats: int = 3, range_q: str = "day"):
    ...
    """
    Build review candidates from repeated pattern signatures in recent events.
    Stores candidates into pattern_review_queue for later review (non-diagnostic).
    """
    rows = _fetch_rows_for_patterns(uid, limit=6000, range_key=range)
    if not rows:
        return {"ok": True, "inserted": 0, "reason": "no rows"}

    points, events = build_live_points_and_events(rows)
    if not events:
        return {"ok": True, "inserted": 0, "reason": "no events"}

    now = datetime.utcnow()
    cutoff = now - timedelta(hours=int(hours))

    # Filter events by time if parseable; otherwise keep (MVP safe)
    recent = []
    for e in events:
        ts = e.get("t") or e.get("ts")
        if not ts:
            continue

        dt = None
        try:
            dt = datetime.strptime(ts, "%Y-%m-%d %H:%M:%S")
        except Exception:
            dt = None

        if dt is None or dt >= cutoff:
            recent.append(e)


    if not recent:
        return {"ok": True, "inserted": 0, "reason": "no recent events"}

    # Bucket by minute-ish key (works best if ts is ISO)
    buckets = {}
    for e in recent:
        ts = e.get("t") or e.get("ts") or ""
        pid = e.get("pattern_id") or e.get("id")
        if not pid:
            continue
        key = ts[:16]
        buckets.setdefault(key, []).append(pid)

    sig_counter = Counter()
    sig_meta = {}

    for k, pids in buckets.items():
        pc = dict(Counter(pids))
        sig = _sig_from_pattern_counts(pc)
        sig_counter[sig] += 1
        if sig not in sig_meta:
            sig_meta[sig] = {"pc": pc, "ws": k, "we": k}
        else:
            sig_meta[sig]["we"] = k

    conn = get_conn()
    c = conn.cursor()
    inserted = 0

    for sig, reps in sig_counter.items():
        if reps < int(min_repeats):
            continue

        meta = sig_meta.get(sig, {})
        pc = meta.get("pc", {})
        ws = meta.get("ws", "")
        we = meta.get("we", "")

        # Avoid duplicates that are still "new"
        c.execute("""
          SELECT id FROM pattern_review_queue
          WHERE user_id=? AND sig=? AND status='new'
          LIMIT 1
        """, (uid, sig))
        if c.fetchone():
            continue

        c.execute("""
          INSERT INTO pattern_review_queue
          (user_id, sig, window_start, window_end, event_count, pattern_counts_json, status)
          VALUES (?, ?, ?, ?, ?, ?, 'new')
        """, (uid, sig, ws, we, int(reps), json.dumps(pc)))
        inserted += 1

    conn.commit()
    conn.close()

    return {"ok": True, "inserted": inserted, "scanned_events": len(recent), "unique_sigs": len(sig_counter)}


@app.get("/review_queue/{uid}")
def review_queue_get(uid: int, status: str = "new", limit: int = 50):
    conn = get_conn()
    c = conn.cursor()
    c.execute("""
      SELECT id, sig, window_start, window_end, event_count, pattern_counts_json, suggested_label, status, created_at
      FROM pattern_review_queue
      WHERE user_id=? AND status=?
      ORDER BY datetime(created_at) DESC
      LIMIT ?
    """, (uid, status, limit))
    rows = c.fetchall()
    conn.close()

    items = []
    for (rid, sig, ws, we, ec, pcj, label, st, created_at) in rows:
        try:
            pc = json.loads(pcj) if pcj else {}
        except Exception:
            pc = {}
        items.append({
            "id": rid,
            "sig": sig,
            "window": {"start": ws, "end": we},
            "repeats": ec,
            "pattern_counts": pc,
            "suggested_label": label,
            "status": st,
            "created_at": created_at,
        })

    return {"user_id": uid, "status": status, "items": items}



@app.get("/debug/session_state/{uid}")
def debug_session_state(uid: int):

    conn = get_conn()
    c = conn.cursor()

    c.execute("SELECT id, start_time, end_time FROM sessions WHERE user_id=? ORDER BY id DESC LIMIT 5", (uid,))
    sessions = c.fetchall()

    c.execute("SELECT id FROM sessions WHERE user_id=? AND end_time IS NULL ORDER BY id DESC LIMIT 1", (uid,))
    active = c.fetchone()
    active_id = active[0] if active else None

    c.execute("SELECT timestamp, session_id FROM readings WHERE user_id=? ORDER BY timestamp DESC LIMIT 10", (uid,))
    latest_reads = c.fetchall()

    conn.close()

    return {
        "active_session_id": active_id,
        "recent_sessions": sessions,
        "latest_readings": latest_reads
    }



# ---------- Wellness Command Center (/board) ----------
def map_event_type(etype: str):
    """
    Maps internal pattern/event codes to safe, non-diagnostic labels + descriptions.
    Used by /board to render 'Critical Harmony Events'.
    """
    et = (etype or "").strip().upper()

    mapping = {
        "A1": ("Micro Drift", "Small deviation with fast recovery."),
        "A2": ("Drift Spike", "Short burst of instability in the signal envelope."),
        "A3": ("Acute Drift Spike", "Sudden instability event."),
        "A4": ("Sustained Instability Spike", "Elevated drift with slower recovery."),

        "C1": ("Micro-Coherence Dip", "Brief alignment loss with quick restoration."),
        "C2": ("Coherence Shift", "Coupling pattern changed across windows."),
        "C3": ("Coherence Drop", "Reduced alignment stability across sensors."),

        "R1": ("Resonance Plateau", "Stable dominant rhythm with low variance."),
        "R2": ("Resonance Build", "Growing rhythm stability across windows."),
        "R3": ("Resonance Break", "Sudden loss of dominant rhythm."),
        "R4": ("Resonance Lock", "Strong stable envelope across windows."),
    }

    return mapping.get(et, ("Signal Event", "Notable change detected in the recent window."))

# ✅ ADD THIS HELPER FUNCTION RIGHT HERE
def detect_sessions(rows, gap_seconds=180):
    sessions = []
    current = []

    for r in rows:

        if not current:
            current.append(r)
            continue

        prev_time = datetime.fromisoformat(current[-1][5]).replace(tzinfo=None)
        cur_time = datetime.fromisoformat(r[5]).replace(tzinfo=None)

        if (cur_time - prev_time).total_seconds() > gap_seconds:
            sessions.append(current)
            current = []

        current.append(r)

    if current:
        sessions.append(current)

    return sessions

def get_window_rows(user: int, range_key: str, start: str | None = None, end: str | None = None):

    conn = get_conn()
    c = conn.cursor()

    now_utc = datetime.utcnow()
    rows = []

      # ---------------------------
      # 1️⃣ Custom date range
      # ---------------------------
    if start and end:
      try:
        s_dt = datetime.strptime(start, "%Y-%m-%d")
        e_dt = datetime.strptime(end, "%Y-%m-%d") + timedelta(days=1)

        c.execute("""
            SELECT eeg, ecg, temperature, light, noise, timestamp
            FROM readings
            WHERE user_id=?
            AND timestamp >= ?
            AND timestamp < ?
            ORDER BY timestamp ASC
        """, (user, to_sqlite_dt(s_dt), to_sqlite_dt(e_dt)))

        rows = c.fetchall()
        conn.close()
        return rows

      except Exception:
        pass

    # ---------------------------
    # 2️⃣ Session mode (auto-detect)
    # ---------------------------
    if range_key == "session":

        c.execute("""
            SELECT eeg, ecg, temperature, light, noise, timestamp
            FROM readings
            WHERE user_id=?
            ORDER BY timestamp ASC
        """, (user,))

        all_rows = c.fetchall()
        conn.close()

        sessions = detect_sessions(all_rows)

        if sessions:
            return sessions[-1]

        return []

    # ---------------------------
    # 3️⃣ Rolling time ranges
    # ---------------------------
    cutoff = None

    if range_key == "10m":
        cutoff = now_utc - timedelta(minutes=10)

    elif range_key == "30m":
        cutoff = now_utc - timedelta(minutes=30)

    elif range_key == "1h":
        cutoff = now_utc - timedelta(hours=1)

    elif range_key == "6h":
        cutoff = now_utc - timedelta(hours=6)

    elif range_key == "24h":
        cutoff = now_utc - timedelta(hours=24)

    elif range_key == "7d":
        cutoff = now_utc - timedelta(days=7)

    if cutoff:
        c.execute("""
          SELECT eeg, ecg, temperature, light, noise, timestamp
          FROM readings
          WHERE user_id=?
          AND timestamp >= ?
          ORDER BY timestamp ASC
        """, (user, to_sqlite_dt(cutoff)))

        rows = c.fetchall()
        conn.close()
        return rows

    # ---------------------------
    # 4️⃣ All time (limited for performance)
    # ---------------------------
    c.execute("""
          SELECT eeg, ecg, temperature, light, noise, timestamp
          FROM readings
          WHERE user_id=?
          ORDER BY timestamp ASC
        """, (user,))

    rows = c.fetchall()
    rows.reverse()  # restore chronological order

    conn.close()
    return rows
  
def get_window_events(user: int, range_key: str, start: str | None = None, end: str | None = None):
    """
    Fetch life_events inside the SAME window used by get_window_rows().
    """

    rows = get_window_rows(user, range_key, start, end)

    if not rows:
        return []

    window_start = rows[0][5]
    window_end = rows[-1][5]

    conn = get_conn()
    c = conn.cursor()

    c.execute(
        """
        SELECT event_type, confidence, note, created_at
        FROM life_events
        WHERE user_id=?
        AND datetime(created_at) >= datetime(?)
        AND datetime(created_at) <= datetime(?)
        ORDER BY datetime(created_at) DESC
        """,
        (user, window_start, window_end),
    )

    events = c.fetchall()
    conn.close()

    return events


@app.get("/board", response_class=HTMLResponse)
def board(req: Request):
    conn = get_conn()
    c = conn.cursor()

    # Get all users with a friendly display name if present
    c.execute("SELECT id, COALESCE(display_name, name) FROM users")
    users = c.fetchall()

    # ⭐ ALWAYS LOAD DASHBOARD
    q_user = req.query_params.get("user")

    if q_user:
      selected = int(q_user)

    else:
    # Automatically select the user with the latest reading
      row = c.execute(
        """
        SELECT user_id
        FROM readings
        ORDER BY id DESC
        LIMIT 1
        """
    ).fetchone()

    if row:
        selected = int(row[0])
    else:
        selected = users[0][0] if users else 1

    # Get display name for selected user
    c.execute("SELECT COALESCE(display_name, name) FROM users WHERE id=?", (selected,))
    row = c.fetchone()
    uname = row[0] if row else f"User {selected}"

    # Selected time range
    range_key = req.query_params.get("range") or "all"

    start = req.query_params.get("start")
    end = req.query_params.get("end")

    rows = get_window_rows(selected, range_key, start, end)

    if not rows:
      rows = get_window_rows(selected, "all")

    # ⭐ Smart fallback: if window empty, load last session
    if not rows and range_key != "session":
        rows = get_window_rows(selected, "session")

    event_rows = get_window_events(selected, range_key, start, end)

    # Last reading timestamp
    try:
      last_ts_et = parse_iso_to_et(rows[-1][5]) if rows else "-"
    except Exception:
      last_ts_et = "-"

    # ---------- Build numeric arrays safely ----------
if not rows:
    rows = [(0.0, 0.0, 98.6, 0.0, 0.0, "1970-01-01T00:00:00")]

times_raw = []
eeg_vals = []
ecg_vals = []
temp_vals = []
light_vals = []
noise_vals = []
harmonies = []
autonomic_vals = []

for (eeg, ecg, temp, light, noise, ts) in rows:

        times_raw.append(parse_iso_to_et(ts))

        eeg_vals.append(safe(eeg))
        ecg_vals.append(safe(ecg))
        temp_vals.append(safe(temp, 98.6))
        light_vals.append(safe(light))
        noise_vals.append(safe(noise))

        harmonies.append(calc_harmony(eeg, ecg, temp))

        # ⭐ Emotional / Autonomic signal
        autonomic = abs(safe(eeg) - safe(ecg))
        autonomic_vals.append(autonomic)

    # ---------- SAFETY: prevent empty arrays crashing charts ----------
if not times_raw:
        times_raw = ["-"]

if not harmonies:
        harmonies = [0]

if not eeg_vals:
        eeg_vals = [0]

if not ecg_vals:
        ecg_vals = [0]

    # --- Drift (avg step-to-step change in Harmony) ---
try:
        drifts = [abs(harmonies[i] - harmonies[i-1]) for i in range(1, len(harmonies))]
        avg_drift = round(mean(drifts), 3) if drifts else 0.0
        max_drift = round(max(drifts), 3) if drifts else 0.0
except Exception:
        avg_drift = 0.0
        max_drift = 0.0

    # Core stats from raw harmonies
if harmonies:
        avg_harmony = round(mean(harmonies), 2)
        min_h = round(min(harmonies), 2)
        max_h = round(max(harmonies), 2)
else:
        avg_harmony = min_h = max_h = 0.0

    # Split before/after safely
n = len(harmonies)
mid = max(1, n // 2)

before = harmonies[:mid]
after = harmonies[mid:]

avg_before = round(mean(before), 2) if before else 0.0
avg_after = round(mean(after), 2) if after else 0.0

    # Improvement (% change) safely
improvement = round(((avg_after - avg_before) / avg_before) * 100, 2) if avg_before else 0.0

    # Stability safely (pstdev requires >= 2 points)
stability = 0.0
try:
        if len(before) >= 2 and len(after) >= 2:
            stability = round(((pstdev(before) - pstdev(after)) / pstdev(before)) * 100, 2) if pstdev(before) else 0.0
except Exception:
        stability = 0.0

hri = round((improvement + stability) / 2, 2)

        # ---------- Zone Inference ----------
zone = infer_zone_from_window(eeg_vals, ecg_vals, temp_vals)

zone_html = f"""
    <div class="col-sm-6 col-lg-3 mb-3">
    <div class="card kpi-card p-3 h-100">
    <h6 class="text-muted mb-1">Zone Dominance</h6>
    <h5 class="mb-1"><span id="kpiZoneLabel">{zone["zone_label"]}</span></h5>
    <small class="text-muted">
    Confidence: <span id="kpiZoneConf">{zone["confidence"]}</span>
    </small>
    </div>
    </div>
    """

    # ---------- Ratios (brain coherence + signal-to-noise) ----------
ratio_rows = []

for eeg, ecg, temp, light, noise, ts in rows:

        if ecg:
            brain_coherence = round(eeg / ecg, 3) if eeg is not None and ecg != 0 else 0
        else:
            brain_coherence = 0

        if noise not in (None, 0):
            signal_to_noise = round(light / noise, 3) if light is not None else 0
        else:
            signal_to_noise = 0

        ratio_rows.append((parse_iso_to_et(ts), brain_coherence, signal_to_noise))

    # ---------- Correlations ----------
def safe_series(vals):
        return [v for v in vals if v is not None]

eeg_s = safe_series(eeg_vals)
ecg_s = safe_series(ecg_vals)
temp_s = safe_series(temp_vals)
light_s = safe_series(light_vals)
noise_s = safe_series(noise_vals)

corr_rows = []

def add_corr(label, xs, ys):
        r = pearson(xs, ys)
        if r is None:
            corr_rows.append((label, "-"))
        else:
            corr_rows.append((label, r))

add_corr("EEG vs Light", eeg_s, light_s)
add_corr("EEG vs Noise", eeg_s, noise_s)
add_corr("ECG vs Light", ecg_s, light_s)
add_corr("ECG vs Noise", ecg_s, noise_s)
add_corr("Temp vs Light", temp_s, light_s)
add_corr("Temp vs Noise", temp_s, noise_s)

    # ---------- Tables HTML ----------
raw_rows_html = ""

for (eeg, ecg, temp, light, noise, ts), h in zip(rows[-40:], harmonies[-40:]):

        eeg_s_ = f"{safe(eeg):.2f}" if eeg is not None else "-"
        ecg_s_ = f"{safe(ecg):.2f}" if ecg is not None else "-"
        temp_s_ = f"{safe(temp, 98.6):.2f}" if temp is not None else "-"
        light_s_ = f"{safe(light):.2f}" if light is not None else "-"
        noise_s_ = f"{safe(noise):.2f}" if noise is not None else "-"
        h_s = f"{h:.2f}" if h is not None else "-"

        raw_rows_html += (
            f"<tr>"
            f"<td>{parse_iso_to_et(ts)}</td>"
            f"<td>{eeg_s_}</td>"
            f"<td>{ecg_s_}</td>"
            f"<td>{temp_s_}</td>"
            f"<td>{light_s_}</td>"
            f"<td>{noise_s_}</td>"
            f"<td>{h_s}</td>"
            f"</tr>"
        )

ratio_html = ""

for ts, bc, sn in ratio_rows[-40:]:
        ratio_html += f"<tr><td>{ts}</td><td>{bc}</td><td>{sn}</td></tr>"

corr_html = ""

for label, val in corr_rows:
        corr_html += f"<tr><td>{label}</td><td>{val}</td></tr>"

    # ---------- Critical Harmony Events ----------
events_html = ""

if not event_rows:
        events_html = (
            "<tr><td colspan='4' class='text-muted'>No Critical Harmony Events in this window."
            " Harmony patterns stayed within expected wellness ranges.</td></tr>"
        )
else:
        for etype, conf, note, created_at in event_rows:

            label, safe_desc = map_event_type(etype)
            ts_et = parse_iso_to_et(created_at)

            events_html += (
                "<tr>"
                f"<td>{ts_et}</td>"
                f"<td>{label}</td>"
                f"<td>{conf:.2f}</td>"
                f"<td>{safe_desc}</td>"
                "</tr>"
            )

    # ---------- Chart arrays ----------
chart_times, chart_harmonies, chart_eeg, chart_ecg = downsample_and_smooth(
        times_raw,
        harmonies,
        eeg_vals,
        ecg_vals,
        step=5,
        window=20
    )

    # ---------- Range Options ----------
range_options = [
        ("session", "Last Session"),
        ("10m", "Last 10 minutes"),
        ("30m", "Last 30 minutes"),
        ("1h", "Last 1 hour"),
        ("6h", "Last 6 hours"),
        ("24h", "Last 24 hours"),
        ("7d", "Last 7 days"),
        ("all", "All Time"),
    ]

  
# ---------- Prepare chart arrays ----------
chart_times = times_raw
chart_harmonies = harmonies
chart_eeg = eeg_vals
chart_ecg = ecg_vals

if not chart_times:
      chart_times = ["-"]
      chart_harmonies = [0]
      chart_eeg = [0]
      chart_ecg = [0]
    # ---------- Chart JSON ----------
chart_payload = {
        "times": chart_times,
        "harmonies": chart_harmonies,
        "eeg": chart_eeg,
        "ecg": chart_ecg,
        "autonomic": autonomic_vals[::5] if autonomic_vals else [],
        "temp": temp_vals[::5] if temp_vals else [],
        "light": light_vals[::5] if light_vals else [],
        "noise": noise_vals[::5] if noise_vals else [],
        "avg_before": avg_before,
        "avg_after": avg_after,
    }

chart_json = json.dumps(chart_payload)

chart_data_script = f"""
    <script>
    window.CHART_DATA = {chart_json};
    </script>
    """
# ---------- Charts JS (SAFE TEMPLATE) ----------

charts_js = r'''
    <script>
    (function () {
      const D = window.CHART_DATA || {};

      function ctx(id) {
        const el = document.getElementById(id);
        return el ? el.getContext('2d') : null;
      }

      // Harmony Summary
      const c1 = ctx('summaryHarmonyChart');
      if (c1 && (D.times || []).length) {
        window.summaryHarmonyChartObj = new Chart(c1, {
          type: 'line',
          data: { labels: D.times || [], datasets: [{ label: 'Harmony', data: D.harmonies || [], tension: 0.25 }] },
          options: { responsive: true, animation: false }
        });
      }

      // Harmony Trend
      const c2 = ctx('harmonyTrendChart');
      if (c2 && (D.times || []).length) {
        window.harmonyTrendChartObj = new Chart(c2, {
          type: 'line',
          data: {
            labels: D.times || [],
            datasets: [
              { label: 'Harmony', data: D.harmonies || [], tension: 0.25 },
              { label: 'EEG-like', data: D.eeg || [], tension: 0.25 },
              { label: 'ECG-like', data: D.ecg || [], tension: 0.25 }
            ]
          },
          options: { responsive: true, animation: false }
        });
      }

      // Proof
      const c3 = ctx('proofCompareChart');
      if (c3) {
        window.proofCompareChartObj = new Chart(c3, {
          type: 'bar',
          data: { labels: ['Before','After'], datasets: [{ label: 'Avg Harmony', data: [D.avg_before || 0, D.avg_after || 0] }] },
          options: { responsive: true, animation: false }
        });
      }

      const c4 = ctx('proofHarmonyChart');
      if (c4 && (D.times || []).length) {
        window.proofHarmonyChartObj = new Chart(c4, {
          type: 'line',
          data: { labels: D.times || [], datasets: [{ label: 'Harmony', data: D.harmonies || [], tension: 0.25 }] },
          options: { responsive: true, animation: false }
        });
      }

      // Fields
      const brain = ctx('brainFieldChart');
      if (brain && (D.times || []).length) {
        window.brainFieldChartObj = new Chart(brain, {
          type: 'line',
          data: { labels: D.times || [], datasets: [{ label: 'EEG-like', data: D.eeg || [], tension: 0.25 }] },
          options: { responsive: true, animation: false }
        });
      }

      const cardiac = ctx('cardiacFieldChart');
      if (cardiac && (D.times || []).length) {
        window.cardiacFieldChartObj = new Chart(cardiac, {
          type: 'line',
          data: { labels: D.times || [], datasets: [{ label: 'ECG-like', data: D.ecg || [], tension: 0.25 }] },
          options: { responsive: true, animation: false }
        });
      }

      const thermal = ctx('thermalFieldChart');
      if (thermal && (D.times || []).length) {
        window.thermalFieldChartObj = new Chart(thermal, {
          type: 'line',
          data: { labels: D.times || [], datasets: [{ label: 'Temperature', data: D.temp || [], tension: 0.25 }] },
          options: { responsive: true, animation: false }
        });
      }

      const env = ctx('envFieldChart');
      if (env && (D.times || []).length) {
        window.envFieldChartObj = new Chart(env, {
          type: 'line',
          data: {
            labels: D.times || [],
            datasets: [
              { label: 'Light', data: D.light || [], tension: 0.25 },
              { label: 'Noise', data: D.noise || [], tension: 0.25 }
            ]
          },
          options: { responsive: true, animation: false }
        });
      }

    })();
    </script>
    '''

range_select_html = "".join(
            f"<option value='{val}' {'selected' if val == range_key else ''}>{label}</option>"
            for val, label in range_options
        )

        # --- SAFETY DEFAULTS: never let /board crash due to missing JS blocks ---
LIVE_STRIP_JS = globals().get("LIVE_STRIP_JS", "")
RADAR_SCRIPT_JS = globals().get("RADAR_SCRIPT_JS", "")
        

            # ---------- HTML ----------
       
       
RANGE_JS = r"""
<script>
document.addEventListener("DOMContentLoaded", function () {

  const rangeSelect = document.getElementById("rangeSelect");
  const userSelect = document.getElementById("userSelect");

  function updateUrl(newRange, newUser) {
    const params = new URLSearchParams(window.location.search);

    if (newRange && newRange.trim() !== "") {
      params.set("range", newRange);
    }

    if (newUser && newUser.trim() !== "") {
      params.set("user", newUser);
    } else {
      params.delete("user");  // 🚨 NEVER allow user=
    }

    window.location.search = params.toString();
  }

  if (rangeSelect) {
    rangeSelect.addEventListener("change", function () {
      const userVal = userSelect ? userSelect.value : null;
      updateUrl(this.value, userVal);
    });
  }

  if (userSelect) {
    userSelect.addEventListener("change", function () {
      const rangeVal = rangeSelect ? rangeSelect.value : null;
      updateUrl(rangeVal, this.value);
    });
  }

});
</script>
"""
    # Fetch users for dropdown
conn = get_conn()
c = conn.cursor()
c.execute("SELECT id, COALESCE(display_name, name) FROM users ORDER BY id ASC")
users = c.fetchall()
conn.close()

      # Safety fallback if DB empty
if not users:
          users = [(1, "User 1")]

user_options_html = ""

user_options_html = ""

for uid, display_name in users:
      selected_attr = "selected" if uid == selected else ""
      user_options_html += (
          f"<option value='{uid}' {selected_attr}>"
          f"{display_name} (User {uid})"
          f"</option>"
      )

      html = f"""
                    <html>
                    <head>
                      <title>Ashwin Wellness Command Center (Harmony Science)</title>
                      ...

                      <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
                      <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
                      <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
                      <style>
                        body {{
                          background-color:#f5f7fa;
                          font-family:'Segoe UI',system-ui,-apple-system,BlinkMacSystemFont;
                          color:#212529;
                        }}
                        .kpi-card {{
                          border-radius:15px;
                          box-shadow:0 3px 8px rgba(0,0,0,0.05);
                        }}
                        .tab-card {{
                          border-radius:15px;
                          box-shadow:0 3px 8px rgba(0,0,0,0.05);
                          background:#fff;
                        }}
                        .nav-pills .nav-link.active {{
                          background-color:#0D6EFD;
                        }}
                        .chart-wrap {{
                  height: 360px;
                }}
                .chart-wrap canvas {{
                  width: 100% !important;
                  height: 100% !important;
                }}

                      </style>
                    </head>
                    <body class="p-4">
                      <div class="container-fluid">
                        <div class="d-flex flex-wrap justify-content-between align-items-center mb-3">
                          <div>
                            <h1 class="mb-1">🧠 Ashwin Wellness Command Center <small class="text-muted">(Harmony Science)</small></h1>
                            <p class="text-muted mb-1">
                              Contactless Harmony Science - real-time bioelectric field patterns converted into a single Harmony Index
                              and supporting wellness metrics.
                            </p>
                            <p class="text-muted mb-0">
                  Viewing: <strong id="viewingUser">{uname} (User {selected})</strong>
                  <span class="ms-2">• Last reading: <strong id="lastReading">{last_ts_et}</strong></span>
                </p>

                          </div>
                          <div class="text-end mt-3 mt-md-0">
                            <a href="/export/full/{selected}" class="btn btn-outline-secondary btn-sm mb-1">📄 Download Full CSV</a><br/>
                            <a href="/export/pdf/{selected}" class="btn btn-outline-danger btn-sm">🧾 Download Full PDF Report</a>
                          </div>
                        </div>

                        <!-- User + Time Range selector -->
                      <form id="filtersForm" class="row g-2 mb-3" onsubmit="return false;">
                  <div class="col-md-4">
                    <label class="form-label fw-semibold">Switch user</label>
                    <select id="userSelect" name="user" class="form-select">
                  {user_options_html}
                  </select>
                  </div>

                  <div class="col-md-4">
                    <label class="form-label fw-semibold">Time range</label>
                    <select id="rangeSelect" name="range" class="form-select">
                      {range_select_html}
                    </select>
                  </div>

                  <div class="col-md-2">
                    <label class="form-label fw-semibold">Start date</label>
                    <input id="startDate" name="start" type="date" class="form-control" />
                  </div>

                  <div class="col-md-2">
                    <label class="form-label fw-semibold">End date</label>
                    <input id="endDate" name="end" type="date" class="form-control" />
                  </div>

                  <div class="col-md-2 d-flex align-items-end">
                    <button id="applyDates" class="btn btn-primary w-100">Apply</button>
                  </div>

                  <div class="col-md-2 d-flex align-items-end">
                    <button id="clearDates" class="btn btn-outline-secondary w-100">Clear</button>
                  </div>
                </form>


                        <!-- KPI row -->
                    <div class="row text-center mb-4">
                    <div class="col-6 col-md-4 col-lg-2 mb-3">
                    <div class="card kpi-card p-3 h-100">
                      <h6 class="text-muted mb-1">Current Harmony</h6>
                      <h2 class="mb-0"><span id="kpiAvgHarmony">{avg_harmony}</span></h2>
                      <small class="text-muted">Composite index (0-100 style)</small>
                    </div>
                      </div>

                    <div class="col-6 col-md-4 col-lg-2 mb-3">
                    <div class="card kpi-card p-3 h-100">
                    <h6 class="text-muted mb-1">Avg Drift</h6>
                    <h2 class="mb-0"><span id="kpiDrift">{avg_drift}</span></h2>
                    <small class="text-muted">Avg step-to-step change</small>
                    </div>
                    </div>

                      <div class="col-6 col-md-4 col-lg-2 mb-3">
                    <div class="card kpi-card p-3 h-100">
                      <h6 class="text-muted mb-1">Improvement</h6>
                      <h2 class="mb-0"><span id="kpiImprovement">{improvement}%</span></h2>
                      <small class="text-muted">Change from early to late readings in this window</small>
                    </div>
                      </div>

                      <div class="col-6 col-md-4 col-lg-2 mb-3">
                    <div class="card kpi-card p-3 h-100">
                      <h6 class="text-muted mb-1">Stability Gain</h6>
                      <h2 class="mb-0"><span id="kpiStability">{stability}%</span></h2>
                      <small class="text-muted">Less volatility = calmer Harmony patterns</small>
                    </div>
                      </div>

                      <div class="col-6 col-md-4 col-lg-2 mb-3">
                    <div class="card kpi-card p-3 h-100">
                      <h6 class="text-muted mb-1">Harmony Resilience Index</h6>
                      <h2 class="mb-0"><span id="kpiHri">{hri}</span></h2>
                      <small class="text-muted">Blends improvement + stability</small>
                    </div>
                      </div>

                      {zone_html}
                    </div>

                    <!-- LIVE STRIP + TAG FEED -->
                    <div class="row mb-4">
                      <div class="col-lg-8 mb-3">
                    <div class="card p-3 h-100">
                      <div class="d-flex justify-content-between align-items-center">
                        <div>
                          <h5 class="mb-0">Live Pattern Strip</h5>
                          <small class="text-muted">Scrolling signal view + real-time pattern flags (non-medical)</small>
                        </div>
                        <div class="text-end">
                          <small class="text-muted">Source:</small>
                          <span class="badge bg-secondary">/api/recent</span>
                        </div>
                      </div>

                      <div class="mt-3">
                        <canvas id="liveStrip" height="140" style="width:100%; border-radius:12px; background:#0b0f14;"></canvas>
                      </div>

                      <div class="mt-2">
                        <small class="text-muted">
                          This strip visualizes recent Harmony (scaled). Flags are pattern tags; zones are inferred field regions (not anatomy).
                        </small>
                      </div>
                    </div>
                      </div>

                      <div class="col-lg-4 mb-3">
                    <div class="card p-3 h-100">
                      <h5 class="mb-2">Latest Tags</h5>
                      <small class="text-muted d-block mb-2">Pattern + zone feed (last 40)</small>
                      <div id="tagFeed" style="max-height: 260px; overflow:auto;"></div>

                <hr />
                <h6 class="mb-2">Your Tags</h6>
                <div id="userTagList" style="max-height: 220px; overflow:auto;"></div>

                <hr />
                <small class="text-muted">
                  Disclaimer: research/wellness visualization only. Not diagnostic.
                </small>

                    </div>
                      </div>
                    </div>

                    <!-- ====== RADAR PANEL (KEEP ONE COPY ONLY) ====== -->
                    <div class="row mb-4" id="radarPanel" data-user="{selected}">
                      <div class="col-lg-8 mb-3">
                    <div class="card p-3 h-100">
                      <div class="d-flex justify-content-between align-items-center">
                        <h5 class="mb-0"> Body Radar</h5>
                        <div id="radarMeta" class="text-muted small"></div>
                      </div>

                      <div class="mt-3 d-flex justify-content-center">
                        <canvas
                          id="radarCanvas"
                          width="520"
                          height="520"
                          style="width:100%; max-width:520px; border-radius:12px; background:#0b0f14;"
                        ></canvas>
                      </div>
                      <div class="mt-2 small text-muted" style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center;">
                  <span><span style="display:inline-block;width:12px;height:12px;border-radius:3px;background:#0b7a2a;margin-right:6px;"></span>0–19</span>
                  <span><span style="display:inline-block;width:12px;height:12px;border-radius:3px;background:#34c759;margin-right:6px;"></span>20–39</span>
                  <span><span style="display:inline-block;width:12px;height:12px;border-radius:3px;background:#ffd60a;margin-right:6px;"></span>40–59</span>
                  <span><span style="display:inline-block;width:12px;height:12px;border-radius:3px;background:#ff9f0a;margin-right:6px;"></span>60–79</span>
                  <span><span style="display:inline-block;width:12px;height:12px;border-radius:3px;background:#ff2d2d;margin-right:6px;"></span>80–100</span>
                  <span style="opacity:.8;">(Harmony)</span>
                </div>

                    </div>
                      </div>

                      <div class="col-lg-4 mb-3">
                    <div class="card p-3 h-100">
                      <h5 class="mb-2">Top Patterns</h5>
                      <div id="radarPatterns"></div>
                      <hr />
                      <small class="text-muted">Non-diagnostic research/wellness visualization only.</small>
                    </div>
                      </div>
                    </div>

                        <!-- Tabs: Harmony first, supporting second, technical/critical third -->
                        <ul class="nav nav-pills mb-3" id="harmonyTabs" role="tablist">
                          <!-- Row 1: Core Harmony -->
                          <li class="nav-item" role="presentation">
                            <button class="nav-link active" id="summary-tab" data-bs-toggle="pill" data-bs-target="#summary-pane" type="button" role="tab">
                              Harmony Summary
                            </button>
                          </li>
                          <li class="nav-item" role="presentation">
                            <button class="nav-link" id="trend-tab" data-bs-toggle="pill" data-bs-target="#trend-pane" type="button" role="tab">
                              Harmony Trend
                            </button>
                          </li>
                          <li class="nav-item" role="presentation">
                            <button class="nav-link" id="proof-tab" data-bs-toggle="pill" data-bs-target="#proof-pane" type="button" role="tab">
                              Proof of Harmony
                            </button>
                          </li>
                          <li class="nav-item" role="presentation">
                            <button class="nav-link" id="ratios-tab" data-bs-toggle="pill" data-bs-target="#ratios-pane" type="button" role="tab">
                              Ratios
                            </button>
                          </li>
                          <li class="nav-item" role="presentation">
                            <button class="nav-link" id="corr-tab" data-bs-toggle="pill" data-bs-target="#corr-pane" type="button" role="tab">
                              Correlation Map
                            </button>
                          </li>

                          <!-- Row 2: Field-level supporting tabs -->
                          <li class="nav-item" role="presentation">
                            <button class="nav-link" id="brain-tab" data-bs-toggle="pill" data-bs-target="#brain-pane" type="button" role="tab">
                              Brain Field (EEG-like)
                            </button>
                          </li>
                          <li class="nav-item" role="presentation">
                            <button class="nav-link" id="cardiac-tab" data-bs-toggle="pill" data-bs-target="#cardiac-pane" type="button" role="tab">
                              Cardiac Field (ECG-like)
                            </button>
                          </li>
                          <li class="nav-item" role="presentation">
                            <button class="nav-link" id="emotional-tab" data-bs-toggle="pill" data-bs-target="#emotional-pane" type="button" role="tab">
                              Emotional / Autonomic
                            </button>
                          </li>
                          <li class="nav-item" role="presentation">
                            <button class="nav-link" id="thermal-tab" data-bs-toggle="pill" data-bs-target="#thermal-pane" type="button" role="tab">
                              Thermal Drift Field
                            </button>
                          </li>
                          <li class="nav-item" role="presentation">
                            <button class="nav-link" id="env-tab" data-bs-toggle="pill" data-bs-target="#env-pane" type="button" role="tab">
                              Environment Field
                            </button>
                          </li>
                          <li class="nav-item" role="presentation">
                            <button class="nav-link" id="raw-tab" data-bs-toggle="pill" data-bs-target="#raw-pane" type="button" role="tab">
                              Raw Field Trace
                            </button>
                          </li>

                          <!-- Row 3: Critical Harmony Events -->
                          <li class="nav-item" role="presentation">
                            <button class="nav-link" id="critical-tab" data-bs-toggle="pill" data-bs-target="#critical-pane" type="button" role="tab">
                              Critical Harmony Events
                            </button>
                          </li>
                        </ul>

                        <div class="tab-content" id="harmonyTabsContent">
                          <!-- Harmony Summary -->
                          <div class="tab-pane fade show active" id="summary-pane" role="tabpanel" aria-labelledby="summary-tab">
                            <div class="card tab-card p-4 mb-4">
                              <h4 class="mb-3">Harmony Summary</h4>
                              <p class="text-muted">
                                The Ashwin Harmony Index blends brain-related harmonics, cardiac micro-rhythms, thermal drift and
                                environmental fingerprints into a single wellness trend. This view is designed for quick reading by
                                wellness teams, coaches and health professionals (non-diagnostic).
                              </p>

                              <div class="row">
                                <div class="col-lg-7 mb-3">
                                  <div class="chart-wrap">
                                    <canvas id="summaryHarmonyChart"></canvas>
                                  </div>
                                </div>
                                <div class="col-lg-5">
                                  <ul class="list-group">
                                    <li class="list-group-item d-flex justify-content-between align-items-center">
                                      Average Harmony
                                      <span id="badgeAvgHarmony" class="badge bg-primary rounded-pill">{avg_harmony}</span>
                                    <li class="list-group-item d-flex justify-content-between align-items-center">
                                      Min / Max Harmony
                                      <span class="badge bg-secondary rounded-pill">{min_h} / {max_h}</span>
                                    </li>
                                    <li class="list-group-item d-flex justify-content-between align-items-center">
                                      Before → After Average
                                      <span class="badge bg-success rounded-pill">{avg_before} → {avg_after}</span>
                                    </li>
                                    <li class="list-group-item d-flex justify-content-between align-items-center">
                                      Improvement %
                                      <span id="badgeImprovement" class="badge bg-success rounded-pill">{improvement}%</span>
                                    </li>
                                    <li class="list-group-item d-flex justify-content-between align-items-center">
                                      Stability Gain
                                      <span id="badgeStability" class="badge bg-info rounded-pill">{stability}%</span>

                                  </ul>
                                </div>
                              </div>
                            </div>
                          </div>

                          <!-- Harmony Trend -->
                          <div class="tab-pane fade" id="trend-pane" role="tabpanel" aria-labelledby="trend-tab">
                            <div class="card tab-card p-4 mb-4">
                              <h4 class="mb-3">Harmony Trend</h4>
                              <p class="text-muted">
                                This chart shows how Harmony evolves over time in this window, alongside field-level EEG-like and
                                ECG-like patterns. It demonstrates how the Ashwin Pillow converts raw field micro-signals into a
                                coherent Harmony trend.
                              </p>
                              <div class="chart-wrap mb-3">
                                <canvas id="harmonyTrendChart"></canvas>
                              </div>
                            </div>
                          </div>

                          <!-- Proof of Harmony -->
                          <div class="tab-pane fade" id="proof-pane" role="tabpanel" aria-labelledby="proof-tab">
                            <div class="card tab-card p-4 mb-4">
                              <h4 class="mb-3">Proof of Harmony</h4>
                              <p class="text-muted">
                                Before/after Harmony comparison across this time window. This is built for “show me the data” conversations
                                around calm, regulation and field stability in a non-medical context.
                              </p>
                              <div class="row">
                                <div class="col-lg-6 mb-3">
                                  <div class="chart-wrap">
                                    <canvas id="proofCompareChart"></canvas>
                                  </div>
                                </div>
                                <div class="col-lg-6 mb-3">
                                  <div class="chart-wrap">
                                    <canvas id="proofHarmonyChart"></canvas>
                                  </div>
                                </div>
                              </div>
                              <a href="/proof/{selected}" class="btn btn-outline-secondary btn-sm">Open detailed Proof of Harmony page</a>
                            </div>
                          </div>

                          <!-- Ratios -->
                          <div class="tab-pane fade" id="ratios-pane" role="tabpanel" aria-labelledby="ratios-tab">
                            <div class="card tab-card p-4 mb-4">
                              <h4 class="mb-3">Wellness Ratios</h4>
                              <p class="text-muted">
                                Brain coherence (EEG/ECG) and signal-to-noise (Light/Noise) as simple, clinician-friendly ratios.
                                Higher coherence and better signal-to-noise support more ordered field patterns.
                              </p>
                              <div class="table-responsive">
                                <table class="table table-sm table-striped align-middle">
                                  <thead>
                                    <tr>
                                      <th>Timestamp (ET)</th>
                                      <th>Brain Coherence (EEG/ECG)</th>
                                      <th>Signal-to-Noise (Light/Noise)</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {ratio_html}
                                  </tbody>
                                </table>
                              </div>
                              <a href="/ratios/{selected}" class="btn btn-outline-secondary btn-sm">Open detailed Ratios page</a>
                            </div>
                          </div>

                          <!-- Correlation Map -->
                          <div class="tab-pane fade" id="corr-pane" role="tabpanel" aria-labelledby="corr-tab">
                            <div class="card tab-card p-4 mb-4">
                              <h4 class="mb-3">Correlation Map</h4>
                              <p class="text-muted">
                                Correlations between field measures (EEG/ECG/Temp) and environment (Light/Noise). These show how the
                                nervous system aligns or reacts to environment changes. Correlations are patterns, not diagnoses.
                              </p>
                              <div class="table-responsive">
                                <table class="table table-sm table-striped align-middle">
                                  <thead>
                                    <tr>
                                      <th>Pair</th>
                                      <th>Pearson r</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {corr_html}
                                  </tbody>
                                </table>
                              </div>
                              <a href="/correlation/{selected}" class="btn btn-outline-secondary btn-sm">Open detailed Correlation page</a>
                            </div>
                          </div>

                          <!-- Brain Field (EEG-like) -->
                          <div class="tab-pane fade" id="brain-pane" role="tabpanel" aria-labelledby="brain-tab">
                            <div class="card tab-card p-4 mb-4">
                              <h4 class="mb-3">Brain Field (EEG-like Harmonics)</h4>
                              <p class="text-muted">
                                Field harmonics primarily driven by brain-related activity. This shows how cortical-like rhythms organize
                                as Harmony improves. Values are derived from contactless field sensing, not skin electrodes.
                              </p>
                              <div class="chart-wrap mb-3">
                                <canvas id="brainFieldChart"></canvas>
                              </div>
                            </div>
                          </div>

                          <!-- Cardiac Field (ECG-like) -->
                          <div class="tab-pane fade" id="cardiac-pane" role="tabpanel" aria-labelledby="cardiac-tab">
                            <div class="card tab-card p-4 mb-4">
                              <h4 class="mb-3">Cardiac Field (ECG-like Harmonics)</h4>
                              <p class="text-muted">
                                Field rhythms influenced by cardiac micro-patterns. This gives a view of how the pillow senses heart-driven
                                harmonics in the air and how those patterns align with Harmony.
                              </p>
                              <div class="chart-wrap mb-3">
                                <canvas id="cardiacFieldChart"></canvas>
                              </div>
                            </div>
                          </div>

                          <!-- Emotional / Autonomic -->
                          <div class="tab-pane fade" id="emotional-pane" role="tabpanel" aria-labelledby="emotional-tab">
                            <div class="card tab-card p-4 mb-4">
                              <h4 class="mb-3">Emotional / Autonomic Field</h4>
                              <p class="text-muted">
                                A smoothed view of variability and drift patterns that relate to stress load vs. calm alignment.
                                This tab is designed to communicate emotional/autonomic load in a wellness, non-medical framework.
                              </p>
                              <div class="chart-wrap mb-3">
                                <canvas id="emotionalFieldChart"></canvas>
                              </div>
                            </div>
                          </div>

                          <!-- Thermal Drift -->
                          <div class="tab-pane fade" id="thermal-pane" role="tabpanel" aria-labelledby="thermal-tab">
                            <div class="card tab-card p-4 mb-4">
                              <h4 class="mb-3">Thermal Drift Field</h4>
                              <p class="text-muted">
                                Slow thermal drift patterns sensed through the field. Helps explain comfort, regulation and how the body
                                settles over time during a session.
                              </p>
                              <div class="chart-wrap mb-3">
                                <canvas id="thermalFieldChart"></canvas>
                              </div>
                            </div>
                          </div>

                          <!-- Environment Field -->
                          <div class="tab-pane fade" id="env-pane" role="tabpanel" aria-labelledby="env-tab">
                            <div class="card tab-card p-4 mb-4">
                              <h4 class="mb-3">Environment Field (Light + Noise)</h4>
                              <p class="text-muted">
                                Light and sound levels that surround the user. This shows how room conditions evolve and provides context
                                for Harmony patterns (e.g., noisy or bright rooms vs darker, quieter ones).
                              </p>
                              <div class="chart-wrap mb-3">
                                <canvas id="envFieldChart"></canvas>
                              </div>
                            </div>
                          </div>

                          <!-- Raw Field Trace -->
                          <div class="tab-pane fade" id="raw-pane" role="tabpanel" aria-labelledby="raw-tab">
                            <div class="card tab-card p-4 mb-4">
                              <h4 class="mb-3">Raw Field Trace (latest 40 readings)</h4>
                              <p class="text-muted">
                                Latest raw readings from the Ashwin Pillow: EEG-like, ECG-like, thermal, light, noise and computed Harmony.
                                This view is for technical reviewers who want to see row-level values.
                              </p>
                              <div class="table-responsive">
                                <table class="table table-sm table-striped align-middle">
                                  <thead>
                                    <tr>
                                      <th>Timestamp (ET)</th>
                                      <th>EEG-like</th>
                                      <th>ECG-like</th>
                                      <th>Temp</th>
                                      <th>Light</th>
                                      <th>Noise</th>
                                      <th>Harmony</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {raw_rows_html}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </div>

                          <!-- Critical Harmony Events -->
                          <div class="tab-pane fade" id="critical-pane" role="tabpanel" aria-labelledby="critical-tab">
                            <div class="card tab-card p-4 mb-4">
                              <h4 class="mb-3">Critical Harmony Events (Wellness Patterns)</h4>
                              <p class="text-muted">
                                Non-medical, pattern-based events where the user’s field temporarily left its typical Harmony range
                                (e.g., extended stillness, turbulence bursts, environmental interference). These support Harmony Science
                                interpretation and are not diagnoses.
                              </p>
                              <div class="table-responsive">
                                <table class="table table-sm table-striped align-middle">
                                  <thead>
                                    <tr>
                                      <th>Timestamp (ET)</th>
                                      <th>Event</th>
                                      <th>Confidence</th>
                                      <th>Explanation</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {events_html}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </div>
                        </div>

                                <div class="text-center mt-3 mb-2">
                  <small class="text-muted">
                    Graph essentials included: clear purpose, labeled axes, consistent colors, smoothing for readability,
                    Harmony-first narrative, and exportable data. All views are wellness-focused and non-diagnostic.
                  </small>
                </div>
                </div>

              
                {chart_data_script}
                {charts_js}

                {BUMP_JS}

                <script>
                {LIVE_STRIP_JS}
                </script>

                <script>
                {RADAR_SCRIPT_JS}
                </script>

                <script>
                {POLL_JS}
                </script>

                {RANGE_JS}

                </body>
                </html>
                  """
      if not users:
       users = [(1, "User 1")]

      return HTMLResponse(content=html)

@app.get("/api/correlation/{uid}")
def api_correlation(
    uid: int,
    tag_type: str = "migraine_start",
    lookback_minutes: int = 360,
    limit: int = 20
):
    """
    Correlate pattern events with user tags (non-diagnostic).
    For each tag:
      - PRE: lookback window ending at start_ts
      - DURING: start_ts -> end_ts (if end exists)
      - BASELINE: 24h ending at start_ts (simple v1)
    """
    conn = get_conn()
    c = conn.cursor()

    c.execute(
        """
        SELECT id, tag_type, start_ts, end_ts, note, severity, created_at
        FROM user_tags
        WHERE user_id=? AND tag_type=?
        ORDER BY datetime(start_ts) DESC
        LIMIT ?
        """,
        (uid, tag_type, limit),
    )
    tags = c.fetchall()
    conn.close()

    if not tags:
        return {
            "user_id": uid,
            "tag_type": tag_type,
            "lookback_minutes": lookback_minutes,
            "tags": [],
            "summary": {"pattern_counts": {}, "top_patterns": []},
        }

    tag_reports = []

    # Optional: separate totals so you can compare PRE vs DURING vs BASELINE
    all_pre = Counter()
    all_during = Counter()
    all_baseline = Counter()

    for (tid, ttype, start_ts, end_ts, note, severity, created_at) in tags:
        # Parse start time
        try:
            start_dt = datetime.fromisoformat(start_ts.replace("Z", ""))
        except Exception:
            start_dt = datetime.strptime(start_ts[:19], "%Y-%m-%dT%H:%M:%S")

        # -------------------------
        # PRE window: [start - lookback, start]
        # -------------------------
        pre_start_dt = start_dt - timedelta(minutes=lookback_minutes)
        pre_start_iso = to_sqlite_dt(pre_start_dt)
        pre_end_iso = to_sqlite_dt(start_dt)

        pre_points, pre_events, pre_pc = _window_stats(uid, pre_start_iso, pre_end_iso, limit=5000)
        all_pre.update(Counter(pre_pc))

        # -------------------------
        # DURING window: [start, end] if end_ts exists
        # -------------------------
        during = None
        during_pc = {}
        if end_ts:
            try:
                end_dt = datetime.fromisoformat(end_ts.replace("Z", ""))
            except Exception:
                end_dt = datetime.strptime(end_ts[:19], "%Y-%m-%dT%H:%M:%S")

            during_start_iso = to_sqlite_dt(start_dt)
            during_end_iso = to_sqlite_dt(end_dt)

            d_points, d_events, during_pc = _window_stats(uid, during_start_iso, during_end_iso, limit=5000)
            all_during.update(Counter(during_pc))

            during = {
                "window": {"start": during_start_iso, "end": during_end_iso},
                "points": d_points,
                "events": d_events,
                "pattern_counts": during_pc,
            }

        # -------------------------
        # BASELINE window: [start - 24h, start] (simple v1)
        # -------------------------
        base_start_dt = start_dt - timedelta(hours=24)
        base_start_iso = to_sqlite_dt(base_start_dt)
        base_end_iso = to_sqlite_dt(start_dt)

        b_points, b_events, base_pc = _window_stats(uid, base_start_iso, base_end_iso, limit=5000)
        all_baseline.update(Counter(base_pc))

        tag_reports.append({
            "tag": {
                "id": tid,
                "tag_type": ttype,
                "start_ts": start_ts,
                "end_ts": end_ts,
                "note": note,
                "severity": severity,
                "created_at": created_at,
            },
            "pre": {
                "window": {"start": pre_start_iso, "end": pre_end_iso},
                "points": pre_points,
                "events": pre_events,
                "pattern_counts": pre_pc,
            },
            "during": during,
            "baseline": {
                "window": {"start": base_start_iso, "end": base_end_iso},
                "points": b_points,
                "events": b_events,
                "pattern_counts": base_pc,
            }
        })

    # Summary: keep it simple + useful
    return {
        "user_id": uid,
        "tag_type": tag_type,
        "lookback_minutes": lookback_minutes,
        "tags": tag_reports,
        "summary": {
            "pre": {
                "pattern_counts": dict(all_pre),
                "top_patterns": all_pre.most_common(10),
            },
            "during": {
                "pattern_counts": dict(all_during),
                "top_patterns": all_during.most_common(10),
            },
            "baseline": {
                "pattern_counts": dict(all_baseline),
                "top_patterns": all_baseline.most_common(10),
            },
        },
    }

    # -------------------------------------------------
    # ---------- DETAILED PROOF PAGE ----------
    # -------------------------------------------------
@app.get("/proof/{uid}", response_class=HTMLResponse)
def proof(uid: int):
    conn = get_conn()
    c = conn.cursor()

    c.execute("""
        SELECT eeg, ecg, temperature, light, noise, timestamp
        FROM readings
        WHERE user_id = ?
        ORDER BY id ASC
    """, (uid,))
    rows = c.fetchall()

    c.execute("SELECT COALESCE(display_name, name) FROM users WHERE id = ?", (uid,))
    uname_row = c.fetchone()
    conn.close()

    uname = uname_row[0] if uname_row else f"User {uid}"

    times = [parse_iso_to_et(r[5]) for r in rows]
    harmonies = [calc_harmony(r[0], r[1], r[2]) for r in rows]

    # Split before/after
    if len(harmonies) < 2:
      avg_before = avg_after = 0
    else:
        mid = len(harmonies) // 2
        before = harmonies[:mid]
        after = harmonies[mid:]
        avg_before = round(mean(before), 2) if before else 0
        avg_after = round(mean(after), 2) if after else 0

    html = f"""
<html>
  <head>
    <title>Ashwin Proof of Harmony</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
  </head>
  <body class="p-4" style="font-family:Segoe UI;background:#f5f7fa;">
    <h2>Proof of Harmony - {uname} (User {uid})</h2>
    <p class="text-muted">Clear before/after evidence from Ashwin Harmony Index.</p>

    <div class="card p-4 mb-4">
      <h4 class="mb-3">Before -> After Harmony Change</h4>
      <canvas id="proofBar"></canvas>
    </div>

    <div class="card p-4 mb-4">
      <h4 class="mb-3">Full Harmony Timeline</h4>
      <canvas id="proofLine"></canvas>
    </div>
  </body>
</html>
"""
    return HTMLResponse(html)
# -------------------------------------------------
# ---------- DETAILED RATIOS PAGE ----------
# -------------------------------------------------
@app.get("/ratios/{uid}", response_class=HTMLResponse)
def ratios(uid: int):
    conn = get_conn()
    c = conn.cursor()

    c.execute(
        """
        SELECT eeg, ecg, light, noise, timestamp
        FROM readings
        WHERE user_id=?
        ORDER BY id ASC
        """,
        (uid,),
    )
    rows = c.fetchall()

    c.execute("SELECT COALESCE(display_name, name) FROM users WHERE id=?", (uid,))
    uname_row = c.fetchone()
    conn.close()

    uname = uname_row[0] if uname_row else f"User {uid}"

    rows_html = ""
    for eeg, ecg, light, noise, ts in rows:
        if ecg not in (None, 0):
            bc = round(eeg / ecg, 3) if eeg is not None else 0
        else:
            bc = 0
        if noise not in (None, 0):
            sn = round(light / noise, 3) if light is not None else 0
        else:
            sn = 0

        rows_html += (
            f"<tr><td>{parse_iso_to_et(ts)}</td><td>{bc}</td><td>{sn}</td></tr>"
        )

    html = f"""
    <html>
    <head>
      <title>Ashwin Ratios - {uname}</title>
      <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
    </head>
    <body class="p-4" style="font-family:Segoe UI;background:#f5f7fa;">
      <h2>📊 Ratios - {uname} (User {uid})</h2>
      <p class="text-muted">Brain coherence and signal-to-noise patterns in detail.</p>

      <div class="card p-4">
        <h4>Ratio Table</h4>
        <div class="table-responsive">
          <table class="table table-sm table-striped">
            <thead>
              <tr>
                <th>Timestamp (ET)</th>
                <th>Brain Coherence (EEG/ECG)</th>
                <th>Signal-to-Noise (Light/Noise)</th>
              </tr>
            </thead>
            <tbody>
              {rows_html}
            </tbody>
          </table>
        </div>
      </div>

      <a href="/board?user={uid}" class="btn btn-primary mt-3">← Back</a>
    </body>
    </html>
    """
    return HTMLResponse(html)


# -------------------------------------------------
# ---------- DETAILED CORRELATION PAGE ----------
# -------------------------------------------------
@app.get("/correlation/{uid}", response_class=HTMLResponse)
def correlation(uid: int):
    conn = get_conn()
    c = conn.cursor()

    c.execute(
        """
        SELECT eeg, ecg, temperature, light, noise, timestamp
        FROM readings
        WHERE user_id=?
        ORDER BY id ASC
        """,
        (uid,),
    )
    rows = c.fetchall()

    c.execute("SELECT COALESCE(display_name, name) FROM users WHERE id=?", (uid,))
    uname_row = c.fetchone()
    conn.close()

    uname = uname_row[0] if uname_row else f"User {uid}"

    eeg = [r[0] for r in rows if r[0] is not None]
    ecg = [r[1] for r in rows if r[1] is not None]
    temp = [r[2] for r in rows if r[2] is not None]
    light = [r[3] for r in rows if r[3] is not None]
    noise = [r[4] for r in rows if r[4] is not None]

    pairs = []
    def add_pair(label, xs, ys):
        r = pearson(xs, ys)
        if r is not None:
            pairs.append((label, r))

    if eeg and light: add_pair("EEG vs Light", eeg, light)
    if eeg and noise: add_pair("EEG vs Noise", eeg, noise)
    if ecg and light: add_pair("ECG vs Light", ecg, light)
    if ecg and noise: add_pair("ECG vs Noise", ecg, noise)
    if temp and light: add_pair("Temp vs Light", temp, light)
    if temp and noise: add_pair("Temp vs Noise", temp, noise)

    rows_html = "".join(
        f"<tr><td>{label}</td><td>{val}</td></tr>" for label, val in pairs
    )

    html = f"""
    <html>
    <head>
      <title>Ashwin Correlation - {uname}</title>
      <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
    </head>
    <body class="p-4" style="font-family:Segoe UI;background:#f5f7fa;">
      <h2>🔗 Correlation Map - {uname} (User {uid})</h2>
      <p class="text-muted">Statistical patterns between signals and environment.</p>

      <div class="card p-4">
        <h4>Correlation Values</h4>
        <table class="table table-sm table-striped">
          <thead>
            <tr>
              <th>Pair</th>
              <th>Pearson r</th>
            </tr>
          </thead>
          <tbody>
            {rows_html}
          </tbody>
        </table>
      </div>

      <a href="/board?user={uid}" class="btn btn-primary mt-3">← Back</a>
    </body>
    </html>
    """
    return HTMLResponse(html)


# -------------------------------------------------
# ---------- CSV EXPORT ----------
# -------------------------------------------------
@app.get("/export/full/{uid}")
def export_full(uid: int):
    conn = get_conn()
    c = conn.cursor()

    c.execute(
        """
        SELECT eeg, ecg, temperature, light, noise, timestamp
        FROM readings
        WHERE user_id=?
        ORDER BY id ASC
        """,
        (uid,),
    )
    rows = c.fetchall()
    conn.close()

    def generate():
        yield "timestamp_et,eeg,ecg,temp,light,noise,harmony\n"
        for eeg, ecg, temp, light, noise, ts in rows:
            h = calc_harmony(eeg, ecg, temp)
            yield f"{parse_iso_to_et(ts)},{eeg},{ecg},{temp},{light},{noise},{h}\n"

    return StreamingResponse(
        generate(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=user_{uid}_full_export.csv"},
    )


# -------------------------------------------------
# ---------- PDF EXPORT ----------
# -------------------------------------------------
@app.get("/export/pdf/{uid}")
def export_pdf(uid: int):
    if not PDF_AVAILABLE:
        return JSONResponse(
            {"error": "PDF library unavailable; install `fpdf` to enable."},
            status_code=500,
        )

    conn = get_conn()
    c = conn.cursor()

    c.execute("SELECT COALESCE(display_name, name) FROM users WHERE id=?", (uid,))
    uname_row = c.fetchone()

    c.execute(
        """
        SELECT eeg, ecg, temperature, light, noise, timestamp
        FROM readings WHERE user_id=? ORDER BY id ASC
        """,
        (uid,),
    )
    rows = c.fetchall()
    conn.close()

    uname = uname_row[0] if uname_row else f"User {uid}"

    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Arial", size=12)

    pdf.cell(200, 10, txt=f"Ashwin Wellness Report - {uname}", ln=1)
    pdf.ln(4)
    pdf.set_font("Arial", size=10)

    pdf.cell(200, 5, txt="Timestamp (ET) | EEG | ECG | Temp | Light | Noise | Harmony", ln=1)
    pdf.ln(2)

    for eeg, ecg, temp, light, noise, ts in rows:
        h = calc_harmony(eeg, ecg, temp)
        line = (
            f"{parse_iso_to_et(ts)} | {eeg} | {ecg} | {temp} | {light} | {noise} | {h}"
        )
        pdf.multi_cell(0, 5, line)

    out_path = os.path.join(BASE_DIR, f"user_{uid}_report.pdf")
    pdf.output(out_path)

    return FileResponse(out_path, media_type="application/pdf")


# -------------------------------------------------
# ---------- TEST DATA INJECTION ----------
# -------------------------------------------------
@app.post("/inject/testdata")
def inject_testdata():
    """
    Injects demo readings for quick dashboard demos.
    """
    conn = get_conn()
    c = conn.cursor()

    # Create demo user if missing
    c.execute("SELECT id FROM users WHERE name='demo@example.com'")
    row = c.fetchone()
    if row:
        uid = row[0]
    else:
        now = datetime.utcnow().isoformat()
        c.execute(
            "INSERT INTO users(name, pin, created_at, display_name) VALUES (?,?,?,?)",
            ("demo@example.com", "1111", now, "Demo User"),
        )
        conn.commit()
        uid = c.lastrowid

    # Demo session
    session = start_autosession(uid, "Demo Session")
    sid = session["session_id"]

    import random

    for i in range(80):
        ts = (datetime.utcnow() - timedelta(minutes=80 - i)).isoformat()
        eeg = round(0.4 + random.random() * 0.9, 3)
        ecg = round(0.5 + random.random() * 0.8, 3)
        temp = round(98.2 + random.random() * 1.2, 2)
        light = random.randint(10, 60)
        noise = random.randint(5, 40)

        c.execute(
            """
            INSERT INTO readings(user_id, session_id, eeg, ecg, temperature, light, noise, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (uid, sid, eeg, ecg, temp, light, noise, ts),
        )

    conn.commit()
    conn.close()

    return {"status": "ok", "user_id": uid, "session_id": sid}


# -------------------------------------------------
# ---------- ADMIN RESET ----------
# -------------------------------------------------
@app.post("/admin/reset")
def admin_reset():
    """
    Wipes users, sessions, readings, and life events.
    Keeps DB structure intact.
    """
    conn = get_conn()
    c = conn.cursor()

    c.execute("DELETE FROM readings")
    c.execute("DELETE FROM sessions")
    c.execute("DELETE FROM life_events")
    c.execute("DELETE FROM profiles")
    c.execute("DELETE FROM users")

    conn.commit()
    conn.close()

    return {"status": "reset_complete"}


# -------------------------------------------------
# ---------- AUTO BACKUP (24 HOURS) ----------
# -------------------------------------------------
def backup_full_project():
    """
    Creates a full backup of the backend folder every 24 hours.
    """
    while True:
        try:
            timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
            backup_dir = os.path.join(BASE_DIR, "backups")
            os.makedirs(backup_dir, exist_ok=True)

            dest = os.path.join(backup_dir, f"backup_{timestamp}")
            shutil.copytree(BASE_DIR, dest, dirs_exist_ok=True)

            print(f"✔ Backup created at {dest}")
        except Exception as e:
            print("⚠️ Backup failed:", e)

        time.sleep(86400)  # 24 hours
