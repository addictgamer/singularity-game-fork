#!/usr/bin/env python3
from __future__ import annotations

import json
import shutil
from pathlib import Path

AUDIO_EXTENSIONS = {".mp3", ".ogg", ".wav", ".flac", ".m4a"}


def main() -> int:
    script_dir = Path(__file__).resolve().parent
    webapp_dir = script_dir.parent
    repo_root = webapp_dir.parent

    source_dir = repo_root / "singularity" / "music" / "singularity-music"
    dest_dir = webapp_dir / "public" / "music"

    dest_dir.mkdir(parents=True, exist_ok=True)

    copied_urls: list[str] = []

    if source_dir.exists():
        for src_file in sorted(source_dir.rglob("*")):
            if not src_file.is_file() or src_file.suffix.lower() not in AUDIO_EXTENSIONS:
                continue

            relative = src_file.relative_to(source_dir)
            dest_file = dest_dir / relative
            dest_file.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src_file, dest_file)
            copied_urls.append(f"/music/{relative.as_posix()}")

    tracks_manifest = dest_dir / "tracks.json"
    tracks_manifest.write_text(json.dumps(copied_urls, indent=2) + "\n", encoding="utf-8")

    if copied_urls:
        print(f"Synced {len(copied_urls)} music tracks into {dest_dir}")
    else:
        print("No music tracks found to sync.")
        print("Expected source: singularity/music/singularity-music")
        print(
            "Hint: run `git submodule update --init --recursive singularity/music/singularity-music` from repo root."
        )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
