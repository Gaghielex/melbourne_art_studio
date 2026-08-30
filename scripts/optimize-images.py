#!/usr/bin/env python3
"""
Optimize gallery images:
  - thumbs/  800px wide  WebP  (gallery grid)
  - full/   2000px wide  WebP  (lightbox)

Originals are untouched.
"""

import os
from pathlib import Path
from PIL import Image

BASE   = Path(__file__).parent.parent
ASSETS = BASE / "assets" / "images"

FOLDERS = ["Digital Illustrations", "Traditional Media"]

THUMB_W = 800
FULL_W  = 2000
QUALITY = 82   # WebP quality (0-100)

SKIP_EXT = {'.svg'}

def resize_and_save(src: Path, dest: Path, max_width: int):
    dest.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(src) as img:
        img = img.convert("RGB")  # strip alpha / CMYK / etc
        w, h = img.size
        if w > max_width:
            new_h = int(h * max_width / w)
            img = img.resize((max_width, new_h), Image.LANCZOS)
        img.save(dest, "WEBP", quality=QUALITY, method=6)

def human(n):
    for unit in ("B","KB","MB","GB"):
        if n < 1024:
            return f"{n:.1f} {unit}"
        n /= 1024
    return f"{n:.1f} GB"

total_orig = total_thumb = total_full = 0
count = 0

for folder in FOLDERS:
    src_dir   = ASSETS / folder
    thumb_dir = ASSETS / "thumbs" / folder
    full_dir  = ASSETS / "full"   / folder

    for src in sorted(src_dir.iterdir()):
        if src.suffix.lower() in SKIP_EXT or not src.is_file():
            continue

        stem  = src.stem
        thumb = thumb_dir / f"{stem}.webp"
        full  = full_dir  / f"{stem}.webp"

        orig_size = src.stat().st_size

        if not thumb.exists():
            resize_and_save(src, thumb, THUMB_W)
        if not full.exists():
            resize_and_save(src, full, FULL_W)

        thumb_size = thumb.stat().st_size
        full_size  = full.stat().st_size
        saving_pct = 100 - int((thumb_size + full_size) / (orig_size * 2) * 100)

        total_orig  += orig_size
        total_thumb += thumb_size
        total_full  += full_size
        count += 1

        print(f"  {src.name[:50]:<50}  orig {human(orig_size):>8}  "
              f"thumb {human(thumb_size):>7}  full {human(full_size):>7}")

print()
print(f"Processed {count} images")
print(f"  Original total : {human(total_orig)}")
print(f"  Thumb total    : {human(total_thumb)}")
print(f"  Full total     : {human(total_full)}")
print(f"  Combined saving: {100 - int((total_thumb + total_full) / (total_orig * 2) * 100)}%")
