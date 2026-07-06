import os
import re

PAGES = [
    'about',
    'commissions',
    'gallery',
    'reviews',
    'international',
    'digital-art',
    'traditional-art',
]

# Prepend / to any href/src value that isn't already absolute or an anchor/data URI
REL_ATTR = re.compile(r'((?:href|src)=")(?!https?://|//|/|#|mailto:|tel:|data:)')


def make_absolute(content):
    return REL_ATTR.sub(r'\1/', content)


for page in PAGES:
    src_file = f'{page}.html'
    dst_dir = page
    dst_file = f'{dst_dir}/index.html'

    with open(src_file, encoding='utf-8') as f:
        content = f.read()

    content = make_absolute(content)

    os.makedirs(dst_dir, exist_ok=True)
    with open(dst_file, 'w', encoding='utf-8') as f:
        f.write(content)

    print(f'Generated {dst_file}')

print('Clean URL generation complete.')
