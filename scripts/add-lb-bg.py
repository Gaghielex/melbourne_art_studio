#!/usr/bin/env python3
from pathlib import Path

BASE = Path(__file__).parent.parent

OLD = '        <div class="lb-image-wrap">\n            <img src="" alt="" id="lightbox-image">'
NEW = '        <div class="lb-image-wrap">\n            <div class="lb-image-bg" id="lightbox-bg"></div>\n            <img src="" alt="" id="lightbox-image">'

for name in ('digital-art.html', 'traditional-art.html'):
    f = BASE / name
    content = f.read_text(encoding='utf-8')
    updated = content.replace(OLD, NEW, 1)
    f.write_text(updated, encoding='utf-8')
    print(f"{'Updated' if updated != content else 'No change'}: {name}")
