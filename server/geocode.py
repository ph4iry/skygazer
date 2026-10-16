import os
import re
import threading
import time

import requests
from cachetools import TTLCache
from flask import Blueprint, request, jsonify
from flask_cors import cross_origin
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from haversine import haversine

# switch to a self-hosted instance later by setting PHOTON_URL
PHOTON_URL = os.environ.get("PHOTON_URL", "https://photon.komoot.io/api")
PHOTON_REVERSE_URL = os.environ.get("PHOTON_REVERSE_URL", re.sub(r"/api/?$", "/reverse", PHOTON_URL))
USER_AGENT = "skygazer/1.0 (+https://github.com/ph4iry/skygazer)"
TIMEOUT = 5          # seconds per Photon request
MIN_QUERY_LENGTH = 3
MAX_RESULTS = 5
FETCH_LIMIT = 15     # ask for more than we return, since non-US results get filtered out
COUNTRY_CODE = "US"

# public places a viewing spot can snap to
PLACE_TAGS = [
  "leisure:park", "leisure:nature_reserve",
  "boundary:national_park", "boundary:protected_area",
  "tourism:viewpoint", "tourism:camp_site", "tourism:picnic_site", "leisure:picnic_table",
]
PLACE_RADIUS_KM = 15
PLACE_LIMIT = 25
# marine reserves are tagged like parks but are mostly water
WATER_PLACE = re.compile(r"\b(marine|underwater)\b", re.IGNORECASE)
# numbered campground pads and loops ("Site 7", "Campsite 12", "Loop B") aren't destinations
PLACEHOLDER_PLACE = re.compile(r"^((camp)?site|pad|loop|lot)\s*#?\s*[\w-]{1,4}$", re.IGNORECASE)

geocode = Blueprint("geocode", __name__)
limiter = Limiter(key_func=get_remote_address, storage_uri="memory://")

cache = TTLCache(maxsize=10_000, ttl=24 * 60 * 60)
cache_lock = threading.Lock()

class Throttle:
  """Spaces out calls across the whole app to at most `rate` per second."""

  def __init__(self, rate, max_wait):
    self.interval = 1 / rate
    self.max_wait = max_wait
    self.next_slot = 0.0
    self.lock = threading.Lock()

  def acquire(self):
    with self.lock:
      now = time.monotonic()
      slot = max(now, self.next_slot)
      if slot - now > self.max_wait:
        return False
      self.next_slot = slot + self.interval
    time.sleep(slot - now)
    return True

photon_throttle = Throttle(rate=2, max_wait=1)

def normalize(query):
  return re.sub(r"\s+", " ", query).strip().lower()

def make_label(props):
  street = " ".join(p for p in (props.get("housenumber"), props.get("street")) if p)
  name = props.get("name")
  city = props.get("city") or props.get("locality") or props.get("district") or props.get("county")
  region = " ".join(p for p in (props.get("state"), props.get("postcode")) if p)

  parts = [name if name != street else None, street, city if city != name else None, region]
  return ", ".join(p for p in parts if p)

def make_locality(props):
  city = props.get("city") or props.get("locality") or props.get("district") or props.get("county")
  return ", ".join(p for p in (city, props.get("state")) if p)

def feature_coordinates(feature):
  try:
    # GeoJSON points are [lon, lat]
    lon, lat = feature["geometry"]["coordinates"][:2]
    return float(lat), float(lon)
  except (KeyError, TypeError, ValueError):
    return None

def parse_features(data):
  results = []
  seen = set()
  for feature in data.get("features", []):
    props = feature.get("properties", {})
    if props.get("countrycode") != COUNTRY_CODE:
      continue
    coords = feature_coordinates(feature)
    if coords is None:
      continue
    lat, lon = coords

    label = make_label(props)
    if not label or label in seen:
      continue
    seen.add(label)
    results.append({"label": label, "lat": lat, "lon": lon})
    if len(results) == MAX_RESULTS:
      break
  return results

def photon_get(url, params):
  """Returns Photon's JSON, or None if it couldn't be reached (so callers don't cache it)."""
  if not photon_throttle.acquire():
    return None
  try:
    response = requests.get(url, params=params, headers={"User-Agent": USER_AGENT}, timeout=TIMEOUT)
    if response.status_code != 200:
      return None
    return response.json()
  except (requests.RequestException, ValueError):
    return None

def search_photon(query):
  data = photon_get(PHOTON_URL, {"q": query, "limit": FETCH_LIMIT, "lang": "en"})
  return None if data is None else parse_features(data)

def cached(key, fetch):
  """Looks up `key` in the cache, otherwise calls `fetch` and caches anything but None."""
  with cache_lock:
    value = cache.get(key)
  if value is None:
    value = fetch()
    if value is not None:
      with cache_lock:
        cache[key] = value
  return value

def nearby_places(lat, lon):
  data = photon_get(PHOTON_REVERSE_URL, {
    "lat": lat, "lon": lon, "radius": PLACE_RADIUS_KM, "limit": PLACE_LIMIT, "lang": "en", "osm_tag": PLACE_TAGS,
  })
  if data is None:
    return None

  places = []
  for feature in data.get("features", []):
    props = feature.get("properties", {})
    coords = feature_coordinates(feature)
    name = (props.get("name") or "").strip()
    # skip unnamed places, marine reserves, and placeholder names like campsite "B" or "Site 7"
    if coords is None or len(name) < 3 or WATER_PLACE.search(name) or PLACEHOLDER_PLACE.match(name):
      continue
    places.append({
      "name": name,
      "label": make_locality(props),
      "type": props.get("osm_value"),
      "lat": coords[0],
      "lon": coords[1],
    })
  return places

def nearby_locality(lat, lon):
  data = photon_get(PHOTON_REVERSE_URL, {"lat": lat, "lon": lon, "limit": 1, "lang": "en"})
  if data is None:
    return None
  features = data.get("features", [])
  return make_locality(features[0].get("properties", {})) if features else ""

def find_public_place(lat, lon, origin, bortle_at, max_bortle, penalty_km):
  """
  Finds the best public place (park, reserve, viewpoint, campsite...) near the dark spot at
  (lat, lon). Places brighter than `max_bortle` (the spot's own class) are skipped so snapping
  never makes the sky worse; the rest are ranked by distance from `origin`, the user's
  location, plus `penalty_km(bortle)`, the same darkness penalty the pixel search uses.

  Returns a place dict, a {"name": None, "label": "near ..."} fallback when no place
  qualifies, or None if Photon couldn't be reached.
  """
  key = (round(lat, 4), round(lon, 4))
  places = cached(("places", *key), lambda: nearby_places(lat, lon))
  if places is None:
    return None

  scored = []
  for p in places:
    bortle = bortle_at(p["lat"], p["lon"])
    if 1 <= bortle <= max_bortle:
      scored.append((haversine(origin, (p["lat"], p["lon"])) + penalty_km(bortle), p))
  if scored:
    return min(scored, key=lambda item: item[0])[1]

  locality = cached(("locality", *key), lambda: nearby_locality(lat, lon))
  if not locality:
    return None
  return {"name": None, "label": f"near {locality}", "type": None, "lat": lat, "lon": lon}

@geocode.route("/autocomplete")
@cross_origin()
@limiter.limit("30 per minute")
def autocomplete():
  query = normalize(request.args.get("q", type=str, default=""))
  if len(query) < MIN_QUERY_LENGTH:
    return jsonify([])

  return jsonify(cached(query, lambda: search_photon(query)) or [])
