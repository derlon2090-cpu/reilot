#!/usr/bin/env python3
"""Turn trusted honeypot path telemetry into validated exact-match Nginx rules."""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import tempfile
import time
import urllib.parse
import urllib.request
from pathlib import Path

SAFE_PATH = re.compile(r"^/[A-Za-z0-9/._~+%:-]{1,239}$")
PHP_PATH = re.compile(r"\.php(?:/|$)", re.IGNORECASE)
CREDENTIAL_NAME = re.compile(r"(?:^|/)credentials?(?:\.(?:json|ya?ml|txt))?$", re.IGNORECASE)
MAX_PATHS = 2048


def canonical_path(value: object) -> str | None:
    raw = str(value or "").split("?", 1)[0][:1000]
    try:
        path = urllib.parse.unquote(raw, errors="strict")
    except (UnicodeDecodeError, ValueError):
        return None
    path = re.sub(r"/+", "/", path)
    if not path.startswith("/"):
        path = "/" + path
    if not SAFE_PATH.fullmatch(path) or "/../" in f"{path}/" or path.endswith("/.."):
        return None
    return path


def classify_path(value: object) -> tuple[str, str] | None:
    path = canonical_path(value)
    if not path:
        return None
    lower = path.lower()
    segments = lower.split("/")
    if any(segment.startswith(".env") for segment in segments):
        return path, "environment"
    if ".git" in segments:
        return path, "repository"
    if PHP_PATH.search(lower):
        return path, "php"
    if lower == "/storage" or lower.startswith("/storage/"):
        return path, "storage"
    if CREDENTIAL_NAME.search(lower):
        return path, "credentials"
    if "wlwmanifest" in lower or "/wp-includes/" in lower:
        return path, "framework"
    return None


def load_state(path: Path) -> dict:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
        return value if isinstance(value, dict) else {}
    except (FileNotFoundError, json.JSONDecodeError, OSError):
        return {}


def save_json_atomic(path: Path, value: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(prefix=path.name + ".", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            json.dump(value, handle, ensure_ascii=True, sort_keys=True, separators=(",", ":"))
            handle.write("\n")
        os.chmod(temporary, 0o600)
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def ingest_events(state: dict, events: list[dict]) -> bool:
    paths = state.setdefault("paths", {})
    changed = False
    for event in events:
        classified = classify_path(event.get("path") or event.get("requested_path"))
        if not classified:
            continue
        path, family = classified
        seen_at = str(event.get("seenAt") or event.get("timestamp") or "")[:40]
        current = paths.get(path)
        if current:
            current["count"] = min(int(current.get("count", 1)) + 1, 2_147_483_647)
            current["lastSeen"] = seen_at or current.get("lastSeen", "")
        elif len(paths) < MAX_PATHS:
            paths[path] = {"family": family, "count": 1, "firstSeen": seen_at, "lastSeen": seen_at}
            changed = True
    return changed


def render_config(state: dict) -> str:
    lines = [
        "# Managed by honeypot-intel-engine.py. Manual edits are overwritten.",
        "# Only allowlisted suspicious path families become exact-match rules.",
    ]
    for path, metadata in sorted(state.get("paths", {}).items()):
        classified = classify_path(path)
        if not classified:
            continue
        family = str(metadata.get("family") or classified[1])
        lines.extend([
            f"# family={family} count={int(metadata.get('count', 1))}",
            f'location = "{path}" {{',
            "    access_log off;",
            "    log_not_found off;",
            "    return 444;",
            "}",
        ])
    return "\n".join(lines) + "\n"


def run(command: list[str]) -> None:
    subprocess.run(command, check=True, timeout=30)


def install_config(output: Path, content: str, nginx: str, reload_command: list[str]) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    old = output.read_bytes() if output.exists() else None
    fd, temporary = tempfile.mkstemp(prefix=output.name + ".", dir=output.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            handle.write(content)
        os.chmod(temporary, 0o640)
        os.replace(temporary, output)
        try:
            run([nginx, "-t"])
            run(reload_command)
        except Exception:
            if old is None:
                output.unlink(missing_ok=True)
            else:
                output.write_bytes(old)
            run([nginx, "-t"])
            raise
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def fetch_events(url: str, token: str, cursor: str) -> tuple[list[dict], str]:
    separator = "&" if "?" in url else "?"
    target = url + (separator + urllib.parse.urlencode({"after": cursor}) if cursor else "")
    request = urllib.request.Request(target, headers={"Authorization": f"Bearer {token}", "Accept": "application/json"})
    with urllib.request.urlopen(request, timeout=15) as response:
        payload = json.load(response)
    if payload.get("ok") is not True or not isinstance(payload.get("events"), list):
        raise RuntimeError("invalid intelligence export response")
    return payload["events"], str(payload.get("nextCursor") or cursor)


def read_jsonl(path: Path, offset: int) -> tuple[list[dict], int]:
    if not path.exists():
        return [], 0
    size = path.stat().st_size
    if size < offset:
        offset = 0
    events = []
    with path.open("r", encoding="utf-8", errors="replace") as handle:
        handle.seek(offset)
        for line in handle:
            try:
                value = json.loads(line)
                if isinstance(value, dict):
                    events.append(value)
            except json.JSONDecodeError:
                continue
        return events, handle.tell()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--once", action="store_true")
    parser.add_argument("--classify-path")
    parser.add_argument("--api-url", default=os.getenv("HONEYPOT_INTEL_URL", ""))
    parser.add_argument("--token-file", default=os.getenv("HONEYPOT_INTEL_TOKEN_FILE", "/etc/renvix-secops/honeypot-intel.token"))
    parser.add_argument("--input-log", default=os.getenv("HONEYPOT_INTEL_LOG", ""))
    parser.add_argument("--state", default="/var/lib/renvix/honeypot-intel-state.json")
    parser.add_argument("--output", default="/etc/nginx/snippets/renvix-honeypot-deny-rules.conf")
    parser.add_argument("--nginx", default="/usr/sbin/nginx")
    parser.add_argument("--interval", type=float, default=10.0)
    args = parser.parse_args()
    if args.classify_path is not None:
        print(json.dumps(classify_path(args.classify_path)))
        return 0
    if not args.api_url and not args.input_log:
        parser.error("set --api-url or --input-log")

    state_path = Path(args.state)
    output_path = Path(args.output)
    state = load_state(state_path)
    state.setdefault("cursor", "")
    state.setdefault("logOffset", 0)
    token = Path(args.token_file).read_text(encoding="utf-8").strip() if args.api_url else ""
    if args.api_url and len(token) < 32:
        raise SystemExit("honeypot intelligence token must contain at least 32 characters")

    while True:
        events: list[dict] = []
        next_cursor = state.get("cursor", "")
        next_offset = int(state.get("logOffset", 0))
        if args.api_url:
            events, next_cursor = fetch_events(args.api_url, token, next_cursor)
        if args.input_log:
            local_events, next_offset = read_jsonl(Path(args.input_log), next_offset)
            events.extend(local_events)
        changed = ingest_events(state, events)
        state["cursor"] = next_cursor
        state["logOffset"] = next_offset
        if changed:
            install_config(output_path, render_config(state), args.nginx, ["/bin/systemctl", "reload", "nginx"])
        save_json_atomic(state_path, state)
        if args.once:
            return 0
        time.sleep(max(2.0, args.interval))


if __name__ == "__main__":
    raise SystemExit(main())
