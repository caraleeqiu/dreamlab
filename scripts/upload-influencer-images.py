#!/usr/bin/env python3
"""
Upload influencer front images to R2 and update Supabase DB.
Run: python3 scripts/upload-influencer-images.py
Requires: source dev.sh first (or set env vars manually)
"""

import os, sys, json, mimetypes
import urllib.request, urllib.error
import boto3
from botocore.exceptions import ClientError

# ── Config ────────────────────────────────────────────────────────────────────
ASSETS_DIR    = os.path.expanduser('~/Desktop/FeishuClaw/Dreamlab/dreamlab-assets/influencers')
BUCKET        = 'dreamlab-assets'
R2_PUBLIC_URL = 'https://pub-d322045dfd244ecf9fa6fcbe9ca506bc.r2.dev'
SUPA_URL      = 'https://sygylcdxubqgswnzapku.supabase.co'

# ── Credentials from env (loaded via dev.sh or inline) ───────────────────────
def kc(key):
    """Read from macOS Keychain if env not set."""
    val = os.environ.get(key)
    if val:
        return val
    import subprocess
    result = subprocess.run(
        ['security', 'find-generic-password', '-a', 'dreamlab', '-s', key, '-w'],
        capture_output=True, text=True
    )
    return result.stdout.strip() if result.returncode == 0 else None

CF_ACCOUNT_ID        = kc('CF_ACCOUNT_ID')
R2_ACCESS_KEY_ID     = kc('R2_ACCESS_KEY_ID')
R2_SECRET_ACCESS_KEY = kc('R2_SECRET_ACCESS_KEY')
SUPABASE_SERVICE_KEY = kc('SUPABASE_SERVICE_ROLE_KEY')

if not all([CF_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, SUPABASE_SERVICE_KEY]):
    print("ERROR: Missing credentials. Run `source dev.sh` first or check Keychain.")
    sys.exit(1)

# ── R2 client ─────────────────────────────────────────────────────────────────
s3 = boto3.client(
    's3',
    endpoint_url=f'https://{CF_ACCOUNT_ID}.r2.cloudflarestorage.com',
    aws_access_key_id=R2_ACCESS_KEY_ID,
    aws_secret_access_key=R2_SECRET_ACCESS_KEY,
    region_name='auto',
)

def upload_image(local_path: str, r2_key: str) -> str:
    content_type = mimetypes.guess_type(local_path)[0] or 'image/png'
    print(f"  Uploading {os.path.basename(local_path)} → r2://{r2_key}")
    s3.upload_file(local_path, BUCKET, r2_key, ExtraArgs={'ContentType': content_type})
    return f'{R2_PUBLIC_URL}/{r2_key}'

# ── Supabase helpers ──────────────────────────────────────────────────────────
SUPA_HEADERS = {
    'apikey': SUPABASE_SERVICE_KEY,
    'Authorization': f'Bearer {SUPABASE_SERVICE_KEY}',
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
}

def supa_get(path: str):
    req = urllib.request.Request(f'{SUPA_URL}/rest/v1/{path}', headers=SUPA_HEADERS)
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())

def supa_patch(path: str, data: dict):
    body = json.dumps(data).encode()
    headers = {**SUPA_HEADERS, 'Prefer': 'return=representation'}
    req = urllib.request.Request(
        f'{SUPA_URL}/rest/v1/{path}', data=body, headers=headers, method='PATCH'
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())

def supa_upsert(path: str, data: dict):
    body = json.dumps(data).encode()
    headers = {**SUPA_HEADERS, 'Prefer': 'resolution=merge-duplicates,return=representation'}
    req = urllib.request.Request(
        f'{SUPA_URL}/rest/v1/{path}', data=body, headers=headers, method='POST'
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())

# ── Influencer map: folder_name → slug (builtin) or None (user-created) ───────
# slug=None means insert as user example (is_builtin=False)
INFLUENCER_MAP = {
    'sable':    {'slug': 'sable'},
    'miso':     {'slug': 'miso'},
    'quinn':    {'slug': 'quinn'},
    'ellie':    {'slug': 'ellie'},
    'aria':     {'slug': 'aria'},
    'kai':      {'slug': 'kai'},
    'gintoki':  {'slug': 'gintoki'},
    'tanjiro':  {'slug': 'tanjiro'},
    'atlas':    {'slug': 'atlas'},
    'luffy':    {'slug': 'luffy'},
    'loopy':    {'slug': 'loopy'},
    'snowking': {'slug': 'snow-king'},
    # User-created examples — upsert as builtin so they appear
    'xiaohua': {'slug': 'xiaohua', 'name': '小花', 'insert': True,
                'type': 'human', 'tagline': '用真实故事打动人心的生活系博主'},
    'zane':    {'slug': 'zane',    'name': 'Zane', 'insert': True,
                'type': 'human', 'tagline': '潮流先锋，用镜头记录城市生活美学'},
}

# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    print(f"\n=== Dreamlab Influencer Image Upload ===\n")

    # Fetch all builtin influencers from DB
    db_rows = supa_get('influencers?is_builtin=eq.true&select=id,slug,name,frontal_image_url')
    slug_to_row = {r['slug']: r for r in db_rows}
    print(f"Found {len(db_rows)} builtin influencers in DB")

    results = []

    for folder_name, meta in INFLUENCER_MAP.items():
        folder = os.path.join(ASSETS_DIR, folder_name)
        img_path = os.path.join(folder, f'{folder_name}_front.png')

        if not os.path.exists(img_path):
            print(f"\n[SKIP] {folder_name}: no {folder_name}_front.png found")
            continue

        slug = meta['slug']
        r2_key = f'influencers/{folder_name}/{folder_name}_front.png'

        print(f"\n[{folder_name}] slug={slug}")

        # Upload to R2
        try:
            public_url = upload_image(img_path, r2_key)
        except ClientError as e:
            print(f"  ERROR uploading: {e}")
            continue

        # Update or insert in DB
        if slug in slug_to_row:
            row = slug_to_row[slug]
            if row.get('frontal_image_url') == public_url:
                print(f"  DB already up-to-date: {public_url}")
            else:
                updated = supa_patch(f'influencers?slug=eq.{slug}', {'frontal_image_url': public_url})
                print(f"  DB updated id={row['id']}: {public_url}")
        elif meta.get('insert'):
            # Insert new builtin record for user-created examples
            new_row = {
                'slug': slug,
                'name': meta['name'],
                'type': meta['type'],
                'tagline': meta['tagline'],
                'is_builtin': True,
                'user_id': None,
                'frontal_image_url': public_url,
            }
            inserted = supa_upsert('influencers', new_row)
            print(f"  DB inserted: {inserted}")
        else:
            print(f"  WARNING: slug '{slug}' not found in DB and no insert config")

        results.append({'folder': folder_name, 'slug': slug, 'url': public_url})

    print(f"\n=== Done! Uploaded {len(results)} images ===")
    for r in results:
        print(f"  {r['folder']:12s} → {r['url']}")

if __name__ == '__main__':
    main()
