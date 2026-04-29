#!/usr/bin/env python3
"""
Scrape current Athens theater plays from athinorama.gr,
extract structured data via Claude API, download images,
and update js/data.js.
"""

import json
import os
import re
import hashlib
import sys
import time
from pathlib import Path
from urllib.parse import urljoin

import anthropic
import requests
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parent.parent
DATA_JS = ROOT / "js" / "data.js"
IMAGES_DIR = ROOT / "images"
IMAGES_DIR.mkdir(exist_ok=True)

GUIDE_URL = "https://www.athinorama.gr/theatre/guide/"
BASE_URL = "https://www.athinorama.gr"
MAX_NEW_PLAYS = 10
REQUEST_TIMEOUT = 30

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) "
                  "Chrome/120.0.0.0 Safari/537.36",
    "Accept-Language": "el,en;q=0.9",
}

EXTRACTION_PROMPT = """\
You are extracting structured data about a theater play from a Greek theater listing page.
Return ONLY a JSON object with these fields (all strings unless noted):

{
  "titleGr": "Greek title",
  "titleEn": "English translation of the title (translate it yourself if not on the page)",
  "author": "Author name in Greek",
  "authorEn": "Author name in English/Latin characters",
  "director": "Director name in Greek",
  "year": 2025,
  "season": "e.g. 2025–2026",
  "venue": "Venue name in Greek",
  "venueAddress": "Full address",
  "genre": ["genre1", "genre2"],
  "duration": "e.g. ~120'",
  "description": "2-4 sentence description in Greek summarizing the play",
  "cast": [{"name": "Actor Name", "role": "Character name or empty string"}],
  "crew": [{"role": "Role title", "name": "Person name"}],
  "schedule": "Human-readable schedule summary",
  "highlight": "One-line highlight if the play is notable (sold out, award-winning, etc.) or empty string"
}

Rules:
- All names in Greek characters where available
- Crew should include at minimum: director, translator/adapter (if any), set designer (if any)
- Cast: include all actors listed. If character roles are shown, include them.
- genre: pick from these when possible: Θέατρο, Κωμωδία, Δράμα, Μιούζικαλ, Μονόλογος, Αρχαία Τραγωδία, Σύγχρονη Διασκευή, Κλασικό, Παιδικό, Stand-up, Χοροθέατρο
- If a field is not available, use empty string or empty array
- Return ONLY valid JSON, no markdown fences, no explanation
"""


def load_existing_plays():
    """Parse the current data.js and return list of play dicts + set of IDs."""
    if not DATA_JS.exists():
        return [], set()

    text = DATA_JS.read_text(encoding="utf-8")
    # Extract the JSON array from `const PLAYS = [...]`
    match = re.search(r"const\s+PLAYS\s*=\s*(\[.*\]);?\s*$", text, re.DOTALL)
    if not match:
        return [], set()

    raw = match.group(1)
    # JS → JSON: trailing commas, single quotes (rare but possible)
    raw = re.sub(r",\s*([}\]])", r"\1", raw)
    try:
        plays = json.loads(raw)
    except json.JSONDecodeError:
        print("WARNING: Could not parse existing data.js, starting fresh")
        return [], set()

    ids = {p["id"] for p in plays}
    return plays, ids


def write_data_js(plays):
    """Write plays list back to data.js."""
    js = json.dumps(plays, ensure_ascii=False, indent=2)
    DATA_JS.write_text(f"const PLAYS = {js};\n", encoding="utf-8")


def slug_from_url(url):
    """Extract a stable slug from an athinorama performance URL."""
    match = re.search(r"/performance/(.+?)/?$", url)
    return match.group(1) if match else hashlib.md5(url.encode()).hexdigest()[:12]


def fetch_page(url):
    """Fetch a page and return BeautifulSoup."""
    resp = requests.get(url, headers=HEADERS, timeout=REQUEST_TIMEOUT)
    resp.raise_for_status()
    return BeautifulSoup(resp.text, "html.parser")


def get_play_links():
    """Scrape the guide page for individual play detail links."""
    soup = fetch_page(GUIDE_URL)
    links = []
    seen = set()

    for a in soup.find_all("a", href=True):
        href = a["href"]
        if "/theatre/performance/" in href and href not in seen:
            seen.add(href)
            full_url = urljoin(BASE_URL, href)
            links.append(full_url)

    return links


def get_page_text(url):
    """Fetch a page and return the text content (stripped of scripts/styles)."""
    soup = fetch_page(url)
    for tag in soup(["script", "style", "nav", "footer", "header"]):
        tag.decompose()
    return soup.get_text(separator="\n", strip=True)[:12000]


def find_image_url(url):
    """Find the main play image from the detail page."""
    soup = fetch_page(url)
    # Athinorama uses ImagesDatabase paths for play photos
    for img in soup.find_all("img", src=True):
        src = img["src"]
        if "ImagesDatabase" in src and "noimage" not in src:
            return urljoin(BASE_URL, src)

    # Fallback: og:image
    og = soup.find("meta", property="og:image")
    if og and og.get("content"):
        return og["content"]

    return ""


def download_image(image_url, play_id):
    """Download an image and save it locally. Returns the local path."""
    if not image_url:
        return "", ""

    ext = ".jpg"
    if ".png" in image_url.lower():
        ext = ".png"

    local_name = f"{play_id}{ext}"
    local_path = IMAGES_DIR / local_name

    if local_path.exists():
        return f"images/{local_name}", ""

    try:
        resp = requests.get(image_url, headers=HEADERS, timeout=REQUEST_TIMEOUT, stream=True)
        resp.raise_for_status()
        with open(local_path, "wb") as f:
            for chunk in resp.iter_content(8192):
                f.write(chunk)
        print(f"  Downloaded image: {local_name}")
        return f"images/{local_name}", image_url
    except Exception as e:
        print(f"  WARNING: Failed to download image: {e}")
        return "", image_url


def extract_play_data(page_text, client):
    """Send page text to Claude API and get structured play data."""
    message = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=2000,
        messages=[
            {
                "role": "user",
                "content": f"{EXTRACTION_PROMPT}\n\n---\nPAGE CONTENT:\n{page_text}",
            }
        ],
    )

    raw = message.content[0].text.strip()
    # Remove markdown fences if present
    raw = re.sub(r"^```json?\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)

    return json.loads(raw)


def build_play_entry(play_data, play_id, image_local, image_remote, source_url):
    """Build a complete play entry dict."""
    # Build more.com ticket URL as a search fallback
    title_slug = play_data.get("titleGr", "").replace(" ", "+")
    more_url = f"https://www.more.com/gr-el/search/?q={title_slug}"

    return {
        "id": play_id,
        "titleGr": play_data.get("titleGr", ""),
        "titleEn": play_data.get("titleEn", ""),
        "author": play_data.get("author", ""),
        "authorEn": play_data.get("authorEn", ""),
        "director": play_data.get("director", ""),
        "year": play_data.get("year", 2025),
        "season": play_data.get("season", "2025–2026"),
        "venue": play_data.get("venue", ""),
        "venueAddress": play_data.get("venueAddress", ""),
        "genre": play_data.get("genre", []),
        "duration": play_data.get("duration", ""),
        "image": image_local or image_remote,
        "imageFallback": image_remote or image_local,
        "description": play_data.get("description", ""),
        "cast": play_data.get("cast", []),
        "crew": play_data.get("crew", []),
        "schedule": play_data.get("schedule", ""),
        "moreUrl": more_url,
        "highlight": play_data.get("highlight", ""),
        "sourceUrl": source_url,
    }


def main():
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        print("ERROR: ANTHROPIC_API_KEY environment variable not set")
        sys.exit(1)

    client = anthropic.Anthropic(api_key=api_key)

    print("Loading existing plays...")
    plays, existing_ids = load_existing_plays()
    print(f"  Found {len(plays)} existing plays")

    print("Fetching play listings from athinorama.gr...")
    play_links = get_play_links()
    print(f"  Found {len(play_links)} plays on listing page")

    new_count = 0
    for url in play_links:
        if new_count >= MAX_NEW_PLAYS:
            print(f"Reached max new plays limit ({MAX_NEW_PLAYS}), stopping")
            break

        play_id = slug_from_url(url)
        if play_id in existing_ids:
            continue

        print(f"\nProcessing: {url}")
        print(f"  ID: {play_id}")

        try:
            page_text = get_page_text(url)
            if len(page_text) < 100:
                print("  SKIP: Page too short, likely empty")
                continue

            print("  Extracting data via Claude API...")
            play_data = extract_play_data(page_text, client)

            if not play_data.get("titleGr"):
                print("  SKIP: No title extracted")
                continue

            print(f"  Title: {play_data['titleGr']}")

            image_url = find_image_url(url)
            image_local, image_remote = download_image(image_url, play_id)

            entry = build_play_entry(play_data, play_id, image_local, image_remote, url)
            plays.append(entry)
            existing_ids.add(play_id)
            new_count += 1

            # Be polite to servers
            time.sleep(1)

        except Exception as e:
            print(f"  ERROR: {e}")
            continue

    if new_count > 0:
        print(f"\nWriting {len(plays)} plays to data.js...")
        write_data_js(plays)
        print("Done!")
    else:
        print("\nNo new plays found.")

    print(f"\nSummary: {new_count} new plays added, {len(plays)} total")
    return new_count


if __name__ == "__main__":
    added = main()
    # Exit code 0 = success (even if 0 new plays)
    sys.exit(0)
