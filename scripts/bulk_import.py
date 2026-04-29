#!/usr/bin/env python3
"""One-shot bulk import from athinorama.gr — no Claude API needed."""

import json
import os
import re
import sys
import time
from pathlib import Path
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parent.parent
DATA_JS = ROOT / "js" / "data.js"
IMAGES_DIR = ROOT / "images"
IMAGES_DIR.mkdir(exist_ok=True)

BASE = "https://www.athinorama.gr"
GUIDE = f"{BASE}/theatre/guide/"
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
      "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
HEADERS = {"User-Agent": UA, "Accept-Language": "el,en;q=0.9"}
TIMEOUT = 20

# Existing play IDs to skip
EXISTING = {
    "i-diki", "oidipodas", "antigoni", "bussinokipos",
    "theos-tis-sfagis", "macbeth", "12-enorkoi", "alexandria",
}

GENRE_MAP = {
    "Κωμωδία": "Κωμωδία",
    "Δράμα": "Δράμα",
    "Μονόλογος": "Μονόλογος",
    "Μιούζικαλ": "Μιούζικαλ",
    "Θέατρο δρόμου": "Θέατρο",
    "Σάτιρα": "Κωμωδία",
    "Τραγωδία": "Δράμα",
    "Κοινωνικό": "Δράμα",
    "Stand-up": "Stand-up",
    "Παιδικό": "Παιδικό",
}


def fetch(url):
    r = requests.get(url, headers=HEADERS, timeout=TIMEOUT)
    r.raise_for_status()
    return BeautifulSoup(r.text, "html.parser")


def slug(url):
    m = re.search(r"/performance/(.+?)/?$", url)
    return m.group(1) if m else None


def norm_id(s):
    """Normalize slug to a cleaner ID."""
    s = s.replace("_", "-").replace("%e2%80%93", "-").replace("!", "")
    s = re.sub(r"-{2,}", "-", s).strip("-")
    if len(s) > 50:
        s = s[:50].rsplit("-", 1)[0]
    return s


def get_text(el):
    return el.get_text(strip=True) if el else ""


def parse_play(url):
    """Parse a single play detail page. Returns dict or None."""
    soup = fetch(url)
    text = soup.get_text("\n", strip=True)

    # Title — first h1 or h2
    title_el = soup.find("h1") or soup.find("h2")
    title = get_text(title_el)
    if not title or len(title) < 2:
        return None

    # Image
    img_url = ""
    for img in soup.find_all("img", src=True):
        src = img["src"]
        if "ImagesDatabase" in src and "noimage" not in src:
            # Request higher res
            src = re.sub(r"/p/\d+x\d+/", "/p/500x600/", src)
            img_url = urljoin(BASE, src)
            break
    if not img_url:
        og = soup.find("meta", property="og:image")
        if og and og.get("content"):
            img_url = og["content"]

    # Try to find structured info from the detail block
    # Athinorama puts info in a structured layout
    all_text = text

    # Director
    director = ""
    m = re.search(r"Σκηνοθεσία[:\s]+([^\n]+)", all_text)
    if m:
        director = m.group(1).strip().rstrip(",.")

    # Author / playwright
    author = ""
    for pat in [r"Συγγραφέας[:\s]+([^\n]+)", r"Κείμενο[:\s]+([^\n]+)", r"Έργο[:\s]+([^\n]+)"]:
        m = re.search(pat, all_text)
        if m:
            author = m.group(1).strip().rstrip(",.")
            break

    # Duration
    duration = ""
    m = re.search(r"Διάρκεια[:\s]*(\d+)", all_text)
    if m:
        duration = f"~{m.group(1)}'"

    # Genre
    genre_raw = ""
    m = re.search(r"Είδος[:\s]+([^\n]+)", all_text)
    if m:
        genre_raw = m.group(1).strip()
    genres = []
    if genre_raw:
        for k, v in GENRE_MAP.items():
            if k.lower() in genre_raw.lower():
                if v not in genres:
                    genres.append(v)
        if not genres:
            genres = ["Θέατρο"]
    else:
        genres = ["Θέατρο"]

    # Venue
    venue = ""
    venue_addr = ""
    m = re.search(r"Χώρος[:\s]+([^\n]+)", all_text)
    if m:
        venue = m.group(1).strip()
    # Try finding address from venue section
    m = re.search(r"Διεύθυνση[:\s]+([^\n]+)", all_text)
    if m:
        venue_addr = m.group(1).strip()

    # If no venue found, look for theater name patterns
    if not venue:
        for a_tag in soup.find_all("a", href=True):
            if "/theatre/halls/" in a_tag["href"]:
                venue = get_text(a_tag)
                break

    # Cast — look for actor links or names after "Παίζουν" / "Ερμηνεύουν"
    cast = []
    cast_section = re.search(r"(?:Παίζουν|Ερμηνεύουν|Ηθοποιοί)[:\s]+([^\n]+(?:\n[^\n]+)*?)(?:\n\n|\nΣκηνοθεσία|\nΧώρος|\nΔιάρκεια|\nΗμερομηνίες)", all_text)
    if cast_section:
        names_raw = cast_section.group(1)
        for name in re.split(r"[,\n]", names_raw):
            name = name.strip().rstrip(".")
            name = re.sub(r"\s+", " ", name)
            if name and len(name) > 2 and not name.startswith("Σκηνο"):
                cast.append({"name": name, "role": ""})

    # If no cast found via regex, try finding abbreviated names in the structured area
    if not cast:
        for a_tag in soup.find_all("a", href=True):
            if "/theatre/people/" in a_tag["href"]:
                name = get_text(a_tag)
                if name and len(name) > 2:
                    cast.append({"name": name, "role": ""})
        # Deduplicate
        seen_names = set()
        deduped = []
        for c in cast:
            if c["name"] not in seen_names:
                seen_names.add(c["name"])
                deduped.append(c)
        cast = deduped

    # Schedule
    schedule = ""
    m = re.search(r"(?:Ώρες|Πρόγραμμα|Ημέρες)[:\s]+([^\n]+)", all_text)
    if m:
        schedule = m.group(1).strip()

    # Description — og:description or first long paragraph
    desc = ""
    og_desc = soup.find("meta", property="og:description")
    if og_desc and og_desc.get("content"):
        desc = og_desc["content"].strip()
    if not desc or len(desc) < 30:
        for p in soup.find_all("p"):
            t = get_text(p)
            if len(t) > 80:
                desc = t[:500]
                break

    # Crew
    crew = []
    if director:
        crew.append({"role": "Σκηνοθεσία", "name": director})
    for role_label in ["Μετάφραση", "Σκηνογραφία", "Κοστούμια", "Μουσική", "Φωτισμοί", "Χορογραφία"]:
        m = re.search(rf"{role_label}[:\s]+([^\n]+)", all_text)
        if m:
            crew.append({"role": role_label, "name": m.group(1).strip().rstrip(",.")})

    return {
        "title": title,
        "author": author,
        "director": director,
        "duration": duration,
        "genres": genres,
        "venue": venue,
        "venueAddress": venue_addr,
        "cast": cast[:15],  # cap at 15
        "crew": crew[:8],
        "schedule": schedule,
        "description": desc[:500] if desc else "",
        "imageUrl": img_url,
    }


def download_img(url, play_id):
    if not url:
        return ""
    ext = ".jpg"
    local = IMAGES_DIR / f"{play_id}{ext}"
    if local.exists():
        return f"images/{play_id}{ext}"
    try:
        r = requests.get(url, headers=HEADERS, timeout=TIMEOUT, stream=True)
        r.raise_for_status()
        with open(local, "wb") as f:
            for chunk in r.iter_content(8192):
                f.write(chunk)
        return f"images/{play_id}{ext}"
    except Exception as e:
        print(f"    img fail: {e}")
        return url  # fall back to remote


def translate_title(title):
    """Very basic Greek→English title translations for common words."""
    # We'll just return the Greek — better than a bad translation
    return ""


def main():
    limit = int(sys.argv[1]) if len(sys.argv) > 1 else 50

    print("Fetching play listing...")
    soup = fetch(GUIDE)
    urls = []
    seen = set()
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if "/theatre/performance/" in href and href not in seen:
            seen.add(href)
            urls.append(urljoin(BASE, href))

    print(f"Found {len(urls)} plays on listing page")

    # Load existing data.js
    existing_text = DATA_JS.read_text(encoding="utf-8")
    match = re.search(r"const\s+PLAYS\s*=\s*(\[.*\]);?\s*$", existing_text, re.DOTALL)
    if match:
        raw = match.group(1)
        # Remove trailing commas (JS → JSON)
        raw = re.sub(r",(\s*[}\]])", r"\1", raw, flags=re.DOTALL)
        # Quote unquoted keys (JS → JSON) — handles both line-start and inline
        raw = re.sub(r'(?<=[{,\n])\s*(\w+)\s*:', lambda m: f' "{m.group(1)}":', raw)
        plays = json.loads(raw)
    else:
        plays = []

    existing_ids = {p["id"] for p in plays}
    existing_ids.update(EXISTING)

    added = 0
    errors = 0
    for url in urls:
        if added >= limit:
            break

        s = slug(url)
        if not s:
            continue
        pid = norm_id(s)
        if pid in existing_ids:
            continue

        print(f"\n[{added+1}/{limit}] {pid}")
        try:
            data = parse_play(url)
            if not data or not data["title"]:
                print("  SKIP: no title")
                errors += 1
                continue

            print(f"  {data['title']}")

            img_local = download_img(data["imageUrl"], pid)

            entry = {
                "id": pid,
                "titleGr": data["title"],
                "titleEn": "",
                "author": data["author"],
                "authorEn": "",
                "director": data["director"],
                "year": 2025,
                "season": "2025–2026",
                "venue": data["venue"],
                "venueAddress": data["venueAddress"],
                "genre": data["genres"],
                "duration": data["duration"],
                "image": img_local,
                "imageFallback": data["imageUrl"] if img_local != data["imageUrl"] else "",
                "description": data["description"],
                "cast": data["cast"],
                "crew": data["crew"],
                "schedule": data["schedule"],
                "moreUrl": f"https://www.more.com/gr-el/search/?q={requests.utils.quote(data['title'])}",
                "highlight": "",
            }
            plays.append(entry)
            existing_ids.add(pid)
            added += 1

            time.sleep(0.5)

        except Exception as e:
            print(f"  ERROR: {e}")
            errors += 1
            continue

    print(f"\n{'='*40}")
    print(f"Added {added} new plays ({errors} errors)")
    print(f"Total plays: {len(plays)}")

    js = json.dumps(plays, ensure_ascii=False, indent=2)
    DATA_JS.write_text(f"const PLAYS = {js};\n", encoding="utf-8")
    print("Wrote data.js")


if __name__ == "__main__":
    main()
