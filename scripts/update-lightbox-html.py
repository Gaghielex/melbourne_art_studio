#!/usr/bin/env python3
"""Wrap counter + close in lb-topbar div in both gallery HTML files."""
from pathlib import Path

BASE = Path(__file__).parent.parent

OLD = '''\
        <button class="lb-close" id="lightbox-close" aria-label="Close"><i class="fas fa-times"></i></button>
        <div class="lb-counter" id="lightbox-counter"></div>'''

NEW = '''\
        <div class="lb-topbar">
            <div class="lb-counter" id="lightbox-counter"></div>
            <button class="lb-close" id="lightbox-close" aria-label="Close"><i class="fas fa-times"></i></button>
        </div>'''

for name in ('digital-art.html', 'traditional-art.html'):
    f = BASE / name
    content = f.read_text(encoding='utf-8')
    updated = content.replace(OLD, NEW, 1)
    f.write_text(updated, encoding='utf-8')
    print(f"{'Updated' if updated != content else 'No change'}: {name}")
