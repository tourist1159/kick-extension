import os
import subprocess
import time
from datetime import datetime

# === 設定 ===
REPO_PATH = r"D:\81801\Documents\kick-comment-fetcher"  # あなたのリポジトリのローカルパス
BRANCH = "main"

def log(msg):
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{now}] {msg}", flush=True)

def get_changed_files(repo_path):
    """直前の状態と比較して変更されたファイルを取得"""
    cmd = ["git", "-C", repo_path, "diff", "--name-only", "HEAD@{1}", "HEAD"]
    result = subprocess.run(cmd, capture_output=True, text=True)
    changed = [f.strip() for f in result.stdout.splitlines() if f.strip()]
    return changed

def auto_pull():
    log("=== Kickコメント同期スクリプト 起動 ===")

    if not os.path.exists(REPO_PATH):
        log(f"指定ディレクトリが存在しません: {REPO_PATH}")
        return

    try:
        # 現在の状態を記録
        subprocess.run(["git", "-C", REPO_PATH, "fetch"], check=True)

        # 最新化前のHEADを保持
        subprocess.run(["git", "-C", REPO_PATH, "rev-parse", "HEAD"], check=True)

        # リポジトリ更新
        log("GitHubから最新データを取得中...")
        subprocess.run(["git", "-C", REPO_PATH, "pull", "origin", BRANCH, "--rebase"], check=True)

        # 変更ファイルを検出
        changed = get_changed_files(REPO_PATH)

        if not changed:
            log("更新されたファイルはありません。")
        else:
            new_comments = [f for f in changed if f.startswith("comments/") and f.endswith(".json")]
            if new_comments:
                log(f"更新されたコメントデータ ({len(new_comments)}件):")
                for f in new_comments:
                    log(f"  - {f}")
            else:
                log("コメントデータの更新はありません。")

    except subprocess.CalledProcessError as e:
        log(f"Git操作エラー: {e}")
    except Exception as e:
        log(f"その他のエラー: {e}")

    log("=== 同期完了 ===")

if __name__ == "__main__":
    auto_pull()
    time.sleep(3)
