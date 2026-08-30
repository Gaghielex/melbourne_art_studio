#!/usr/bin/env python3
"""
Switch gallery <img> src to WebP thumbs, add data-full for lightbox, add loading=lazy.
Works on digital-art.html and traditional-art.html.
"""

import re
from pathlib import Path

BASE = Path(__file__).parent.parent

GALLERIES = [
    (BASE / "digital-art.html",    "Digital Illustrations"),
    (BASE / "traditional-art.html", "Traditional Media"),
]

# Match gallery img tags (ones that have data-title, meaning they're artwork images)
# src="assets/images/<folder>/<file>"  →  thumb src + data-full + loading=lazy
IMG_RE = re.compile(
    r'(<img\s[^>]*?)src="(assets/images/(?:Digital Illustrations|Traditional Media)/([^"]+))"([^>]*?>)',
    re.DOTALL,
)

def stem_webp(filename: str) -> str:
    return Path(filename).stem + ".webp"

def replace_img(m, folder):
    prefix    = m.group(1)
    orig_path = m.group(2)          # assets/images/Folder/file.ext
    filename  = m.group(3)          # file.ext
    suffix    = m.group(4)          # rest of tag

    stem      = Path(filename).stem
    thumb_src = f"assets/images/thumbs/{folder}/{stem}.webp"
    full_src  = f"assets/images/full/{folder}/{stem}.webp"

    # Only add loading=lazy if not already there
    lazy = '' if 'loading=' in prefix + suffix else ' loading="lazy"'
    # Only add data-full if not already there
    dfull = '' if 'data-full=' in prefix + suffix else f' data-full="{full_src}"'

    return f'{prefix}src="{thumb_src}"{dfull}{lazy}{suffix}'

for html_path, folder in GALLERIES:
    content = html_path.read_text(encoding='utf-8')

    def repl(m):
        # Only replace artwork images (those with data-title), not logo SVGs
        if 'data-title=' not in m.group(0) and 'gallery-item' not in m.group(0):
            # still replace if it's in the gallery grid (has w-full class)
            if 'w-full h-auto' not in m.group(0):
                return m.group(0)
        return replace_img(m, folder)

    new_content = IMG_RE.sub(repl, content)
    html_path.write_text(new_content, encoding='utf-8')
    changed = content != new_content
    print(f"{'Updated' if changed else 'No change'}: {html_path.name}")
