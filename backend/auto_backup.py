import os
import shutil
from datetime import datetime, timedelta

BASE_DIR = os.path.dirname(__file__)
BACKUP_ROOT = os.path.join(os.path.expanduser("~/Desktop"), "ashwin_backups")
LAST_RUN_FILE = os.path.join(BACKUP_ROOT, "last_run.txt")

def perform_backup():
    """
    Safe, non-recursive backup.
    Runs once every 24 hours.
    Backs up only ashwin.db and nothing else.
    """

    os.makedirs(BACKUP_ROOT, exist_ok=True)

    # ---- Check last run ----
    if os.path.exists(LAST_RUN_FILE):
        with open(LAST_RUN_FILE, "r") as f:
            last_ts = f.read().strip()

        try:
            last_run = datetime.fromisoformat(last_ts)
            if datetime.utcnow() - last_run < timedelta(hours=24):
                # Too soon → do nothing
                return
        except:
            pass

    # ---- Create folder ----
    stamp = datetime.utcnow().strftime("%Y-%m-%d_%H-%M-%S")
    backup_folder = os.path.join(BACKUP_ROOT, f"backup_{stamp}")
    os.makedirs(backup_folder, exist_ok=True)

    # ---- Copy ONLY ashwin.db ----
    src_db = os.path.join(BASE_DIR, "ashwin.db")
    dst_db = os.path.join(backup_folder, "ashwin.db")

    if os.path.exists(src_db):
        shutil.copy2(src_db, dst_db)

    # ---- Update last run ----
    with open(LAST_RUN_FILE, "w") as f:
        f.write(datetime.utcnow().isoformat())

    print(f"🟢 Daily backup completed → {backup_folder}")
