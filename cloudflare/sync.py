#!/usr/bin/env python3
"""One-way sync of the Scratchpad data (the git-synced Go box) into the
serverless deployment (Cloudflare D1 + R2).

Pulls every item from the box's API (real titles + freshest content), then
mirrors it into D1 (items + links, full replace) and R2 (content/<id>). Idempotent
— safe to re-run. Deletions on the box propagate to D1; their R2 blobs are left
as harmless orphans (R2 has no list-and-prune in this wrangler).

Usage:  python3 sync.py           (from the cloudflare/ dir; `make sync-cf`)
Config (env overrides, else read from ../cloudflare_api_keys):
  SYNC_BOX_URL          default https://scratchpad-suh.z6o.cc
  SCRATCHPAD_PASSWORD   app password for the box
  CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID   for wrangler
"""
import os, re, json, sys, shutil, subprocess, urllib.request
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
KEYS = os.path.join(HERE, "..", "cloudflare_api_keys")
SYNC = os.path.join(HERE, ".sync")
BLOBS = os.path.join(SYNC, "blobs")
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36"
WIKI = re.compile(r"\[\[([^\[\]]+)\]\]")


def keyfile():
    vals = {}
    if os.path.exists(KEYS):
        for line in open(KEYS):
            if "=" in line:
                k, v = line.split("=", 1)
                vals[k.strip().lower()] = v.strip()
    return vals


def cfg():
    k = keyfile()
    return {
        "box": os.environ.get("SYNC_BOX_URL", "https://scratchpad-suh.z6o.cc").rstrip("/"),
        "password": os.environ.get("SCRATCHPAD_PASSWORD", k.get("scratchpad_password", "")),
        "token": os.environ.get("CLOUDFLARE_API_TOKEN", k.get("toke", "")),
        "account": os.environ.get("CLOUDFLARE_ACCOUNT_ID", k.get("account_id", "")),
    }


def links(content):
    seen, out = set(), []
    for m in WIKI.finditer(content):
        t = m.group(1).strip()
        if t and t.lower() not in seen:
            seen.add(t.lower())
            out.append(t)
    return out


def q(s):
    return "'" + str(s).replace("'", "''") + "'"


def fetch_items(box, password):
    body = json.dumps({"password": password}).encode()
    req = urllib.request.Request(box + "/api/login", data=body,
                                 headers={"Content-Type": "application/json", "User-Agent": UA}, method="POST")
    cookie = urllib.request.urlopen(req).headers.get("Set-Cookie", "").split(";")[0]

    def api(path):
        r = urllib.request.Request(box + path, headers={"Cookie": cookie, "User-Agent": UA})
        return json.loads(urllib.request.urlopen(r).read())

    items = api("/api/items")["items"]
    with ThreadPoolExecutor(max_workers=8) as ex:
        contents = list(ex.map(lambda it: api("/api/items/" + it["id"]).get("content", ""), items))
    return list(zip(items, contents))


def build(pairs):
    if os.path.exists(SYNC):
        shutil.rmtree(SYNC)
    os.makedirs(BLOBS)
    sql = ["DELETE FROM links;", "DELETE FROM shares;", "DELETE FROM items;"]
    manifest = []
    for it, content in pairs:
        open(os.path.join(BLOBS, it["id"]), "w", encoding="utf-8").write(content)
        sql.append(
            "INSERT OR REPLACE INTO items (id,title,type,path,language,folder,archived,trashed,created_at,updated_at) "
            f"VALUES ({q(it['id'])},{q(it['title'])},{q(it['type'])},{q(it['path'])},{q(it.get('language',''))},"
            f"{q(it.get('folder',''))},{1 if it['archived'] else 0},{1 if it['trashed'] else 0},{it['createdAt']},{it['updatedAt']});"
        )
        for t in links(content):
            sql.append(f"INSERT INTO links (from_id,to_title) VALUES ({q(it['id'])},{q(t)});")
        manifest.append((f"content/{it['id']}", os.path.join(BLOBS, it["id"])))
    open(os.path.join(SYNC, "migrate.sql"), "w").write("\n".join(sql) + "\n")
    return manifest


def wrangler(args, env):
    return subprocess.run(["npx", "wrangler", *args], cwd=HERE, env=env, capture_output=True, text=True)


def main():
    c = cfg()
    if not c["password"]:
        sys.exit("no SCRATCHPAD_PASSWORD (env or cloudflare_api_keys)")
    if not c["token"] or not c["account"]:
        sys.exit("no CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID")
    env = {**os.environ, "CLOUDFLARE_API_TOKEN": c["token"], "CLOUDFLARE_ACCOUNT_ID": c["account"]}

    print(f"→ fetching from {c['box']} …")
    pairs = fetch_items(c["box"], c["password"])
    manifest = build(pairs)
    print(f"  {len(pairs)} items")

    print("→ applying D1 (items + links) …")
    r = wrangler(["d1", "execute", "scratchpad", "--remote", "--file", os.path.join(SYNC, "migrate.sql")], env)
    if r.returncode != 0:
        sys.exit("D1 apply failed:\n" + r.stderr[-2000:])

    print(f"→ uploading {len(manifest)} content blobs to R2 …")
    fails = []

    def put(item):
        key, path = item
        rr = wrangler(["r2", "object", "put", f"scratchpad/{key}", "--file", path,
                       "--content-type", "text/plain;charset=utf-8"], env)
        if rr.returncode != 0:
            fails.append(key)

    with ThreadPoolExecutor(max_workers=6) as ex:
        list(ex.map(put, manifest))
    if fails:
        sys.exit(f"R2 upload failed for {len(fails)}: {fails[:5]}")

    print(f"✓ synced {len(pairs)} items to Cloudflare (D1 + R2)")


if __name__ == "__main__":
    main()
