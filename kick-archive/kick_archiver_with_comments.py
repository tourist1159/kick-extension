import json
import os
import time
from urllib.request import Request, urlopen
from datetime import datetime, timedelta, timezone
from kick import get_all_comments
import pandas as pd
import schedule
from pprint import pprint

API_URL = "https://kick.com/api/v2/channels/mokoutoaruotoko/videos"
ARCHIVE_FILE = "kick_archives.json"
COMMENTS_DIR = "archives_comments"

os.makedirs(COMMENTS_DIR, exist_ok=True)

# ---------- Utility ----------
def to_iso(dt_str):
    if not dt_str:
        return None
    try:
        newdt = dt_str.replace(" ", "T")
        if (not "Z" in newdt ): newdt = newdt+"Z"
        return datetime.fromisoformat(newdt).isoformat()
    except Exception:
        return dt_str

def parse_duration(d_str):
    """HH:MM:SS → 秒数に変換"""
    h, m, s = map(int, d_str.split(":"))
    return h * 3600 + m * 60 + s

# ---------- アーカイブ一覧取得 ----------
def fetch_archives():
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36"
        ),
        "Accept": "application/json, text/plain, */*",
    }
    req = Request(API_URL, headers=headers)

    with urlopen(req) as response:
        raw = response.read()
        data = json.loads(raw.decode("utf-8"))

    videos = data  # list 形式
    formatted = []

    for v in videos:
        if v.get("is_live"):
            continue

        video_info = v.get("video", {})
        formatted.append({
            "id": v["id"],
            "video_id": video_info.get("id"),
            "uuid": video_info.get("uuid"),
            "title": v.get("session_title") or "",
            "start_time": to_iso(v.get("start_time")),
            "url": f"https://kick.com/mokoutoaruotoko/videos/{video_info.get('uuid')}",
            "duration": v.get("duration"),
        })
    return formatted

# ---------- ローカル保存管理 ----------
def load_local_archives():
    if os.path.exists(ARCHIVE_FILE):
        with open(ARCHIVE_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return []

def save_local_archives(data):
    with open(ARCHIVE_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

# ---------- コメント統計保存 ----------
def save_comment_stats(video, comments):
    if not comments:
        print("コメントがありません。")
        return

    df = pd.DataFrame(comments)
    df["time"] = pd.to_datetime(df["timestamp"]).dt.floor("min")

    stats = {
        "video_id": video["id"],
        "start_time": video["start_time"],
        "comments": [
            {"timestamp": pd.to_datetime(row["timestamp"]).isoformat(),"id": row["user_id"],"text": row["text"]}
            for _, row in df.iterrows()
        ],
    }

    out_path = f"{COMMENTS_DIR}/{video['id']}_comments.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(stats, f, ensure_ascii=False, indent=2)

    print(f"Saved: {out_path}")

# ---------- メイン ----------
def main():
    print("Fetching archive list...")
    remote_archives = fetch_archives()
    local_archives = load_local_archives()
    existing_ids = {a["id"] for a in local_archives}

    new_videos = [v for v in remote_archives if v["id"] not in existing_ids]
    print(f"New archives found: {len(new_videos)}")

    for video in new_videos:
        print(f"\n=== Processing {video['title']} ({video['id']}) ===")
        pprint(video)
        # 開始・終了時間を算出
        start_time = video.get("start_time")
        if not start_time:
            print("start_time がありません")
            continue

        start_time = datetime.fromisoformat(start_time.replace("Z", "+00:00"))
        duration_ms = video.get("duration", 0)
        if isinstance(duration_ms, str):
            duration_s = parse_duration(duration_ms)
        else:
            duration_s = duration_ms / 1000
        end_time = start_time + timedelta(seconds=duration_s)

        start_time_iso = start_time.isoformat().replace("+00:00", "Z")
        print(f"Fetching comments from {start_time_iso} to {end_time.isoformat()}")

        try:
            comments_raw = get_all_comments(start_time_iso, end_time)
        except Exception as e:
            print(f"Error fetching comments: {e}")
            continue

        comments = []
        for msg in comments_raw:            
            id = msg.get("sender", {}).get("id")
            text = msg.get("content") or ""
            created_at = msg.get("created_at")

            if created_at:
                comments.append({"user_id": id, "timestamp": created_at, "text": text})

        print(f"Fetched {len(comments)} comments.")
        save_comment_stats(video, comments)

        local_archives.append(video)
        save_local_archives(local_archives)

    print("All done.")

if __name__ == "__main__":
    main()

def job():
    main()
    
schedule.every(1).hours.do(job)

while True:
    schedule.run_pending()
    time.sleep(1)