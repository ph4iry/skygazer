import os

# keep GDAL's tile cache small so the server fits in a free-tier instance
os.environ.setdefault("GDAL_CACHEMAX", "64")

from flask import Flask, request, jsonify
from flask_cors import CORS, cross_origin
import numpy as np
import rasterio
from rasterio.windows import Window
from haversine import haversine
from werkzeug.middleware.proxy_fix import ProxyFix
from geocode import geocode, limiter, find_public_place

app = Flask(__name__)
CORS(app)
# hosts put the app behind a proxy; trust its X-Forwarded-For so rate limits are per client
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1)
limiter.init_app(app)
app.register_blueprint(geocode)

# built from map.tif by scripts/build_raster.py
# pixel values: 0 = water/no data, 1..8 = bortle class (8 means "8-9")
DATA_PATH = os.environ.get("DATA_PATH", os.path.join(os.path.dirname(__file__), "data", "bortle.tif"))
dat = rasterio.open(DATA_PATH)

EARTH_RADIUS_KM = 6371.0088
MAX_DARK_BORTLE = 4
START_RADIUS = 64   # pixels (~7 km)
MAX_RADIUS = 2048   # pixels (~1900 km north/south)
CANDIDATES = 256    # best pixels (by approximate score) to check exactly
# each bortle class above 1 counts as this many extra km, so a slightly farther
# darker spot beats a slightly closer brighter one (bortle 1 wins unless a 4 is 30+ km closer)
KM_PER_BORTLE_CLASS = 10
# how far the user is willing to go for a darker sky
MAX_KM_CHOICES = (100, 250, 500)
DEFAULT_MAX_KM = 250

def bortle_label(value):
  if value == 0:
    return None
  return "8-9" if value == 8 else str(value)

def location_to_pixel(lat, lon):
  row, col = dat.index(lon, lat)
  if not (0 <= row < dat.height and 0 <= col < dat.width):
    return None
  return row, col

def classify_location(lat, lon):
  pixel = location_to_pixel(lat, lon)
  if pixel is None:
    return None
  row, col = pixel
  return bortle_label(int(dat.read(1, window=Window(col, row, 1, 1))[0, 0]))

def bortle_class(lat, lon):
  """Bortle class 1..8 at a location, or 0 for water / outside the map."""
  pixel = location_to_pixel(lat, lon)
  if pixel is None:
    return 0
  row, col = pixel
  return int(dat.read(1, window=Window(col, row, 1, 1))[0, 0])

def darkness_penalty_km(bortle):
  return KM_PER_BORTLE_CLASS * (bortle - 1)

def haversine_km(lat1, lon1, lat2, lon2):
  lat1, lon1, lat2, lon2 = map(np.radians, (lat1, lon1, lat2, lon2))
  a = np.sin((lat2 - lat1) / 2) ** 2 + np.cos(lat1) * np.cos(lat2) * np.sin((lon2 - lon1) / 2) ** 2
  return 2 * EARTH_RADIUS_KM * np.arcsin(np.sqrt(a))

def find_dark_spots(lat, lon, max_km=DEFAULT_MAX_KM):
  """
  Finds the nearest spot at each darkness level (bortle <= 4, <= 3, <= 2, <= 1) within
  `max_km`, keeping only levels that cost extra distance: a level whose nearest spot is
  actually darker (because a darker pixel is just as close) is folded into that darker one.

  Returns {"options": [...], "recommended": index, "missing": [bortle classes]}, with options
  ordered closest/brightest first, or None if the location is off the map. If nothing is
  within `max_km`, the single nearest dark spot is returned anyway so there's always an answer.
  """
  pixel = location_to_pixel(lat, lon)
  if pixel is None:
    return None
  center_r, center_c = pixel
  t = dat.transform
  res = abs(t.a)
  levels = range(1, MAX_DARK_BORTLE + 1)

  nearest = {}  # bortle class -> (distance_km, lat, lon) of the nearest pixel with exactly that class
  radius = START_RADIUS
  while True:
    row0, row1 = max(center_r - radius, 0), min(center_r + radius + 1, dat.height)
    col0, col1 = max(center_c - radius, 0), min(center_c + radius + 1, dat.width)
    classes = dat.read(1, window=Window(col0, row0, col1 - col0, row1 - row0))

    rows, cols = np.nonzero((classes >= 1) & (classes <= MAX_DARK_BORTLE))
    pixel_classes = classes[rows, cols]
    lats = t.f + (rows + row0 + 0.5) * t.e
    lons = t.c + (cols + col0 + 0.5) * t.a
    # a cheap flat-earth distance to narrow things down before the exact haversine
    approx_km = np.radians(np.hypot(lats - lat, (lons - lon) * np.cos(np.radians(lat)))) * EARTH_RADIUS_KM

    nearest = {}
    for k in levels:
      idx = np.flatnonzero(pixel_classes == k)
      if len(idx) == 0:
        continue
      if len(idx) > CANDIDATES:
        idx = idx[np.argpartition(approx_km[idx], CANDIDATES)[:CANDIDATES]]
      dists = haversine_km(lat, lon, lats[idx], lons[idx])
      best = int(np.argmin(dists))
      nearest[k] = (float(dists[best]), float(lats[idx[best]]), float(lons[idx[best]]))

    # the window is square in degrees, not km, so a hit is only guaranteed to be the nearest
    # if it's closer than the window's nearest edge
    span = np.radians(radius * res)
    max_abs_lat = np.radians(min(abs(lat) + radius * res, 90))
    edge_km = EARTH_RADIUS_KM * min(span, np.arcsin(min(np.cos(max_abs_lat) * np.sin(min(span, np.pi / 2)), 1)))

    # nearest pixel that is at least as dark as each level
    at_least = {}
    for k in levels:
      found = [nearest[j] + (j,) for j in range(1, k + 1) if j in nearest]
      if found:
        at_least[k] = min(found)

    settled = all(k in at_least and at_least[k][0] <= edge_km for k in levels)
    covers_range = edge_km >= max_km and at_least
    if settled or covers_range or radius >= MAX_RADIUS:
      break
    radius *= 2

  options = []
  missing = []
  for k in reversed(levels):
    spot = at_least.get(k)
    if spot is None or spot[0] > max_km:
      missing.append(k)
    elif spot[3] == k:
      options.append({"distance_km": spot[0], "lat": spot[1], "lon": spot[2], "bortle": k})

  if not options and at_least:
    # nothing within range: fall back to the nearest dark spot, however far
    distance_km, spot_lat, spot_lon, k = at_least[MAX_DARK_BORTLE]
    options.append({"distance_km": distance_km, "lat": spot_lat, "lon": spot_lon, "bortle": k})
  if not options:
    return None

  recommended = min(range(len(options)), key=lambda i: options[i]["distance_km"] + darkness_penalty_km(options[i]["bortle"]))
  return {"options": options, "recommended": recommended, "missing": sorted(missing)}

def find_nearest_dark_location(lat, lon, max_km=DEFAULT_MAX_KM):
  """The recommended spot from find_dark_spots, as (lat, lon, None, bortle label)."""
  result = find_dark_spots(lat, lon, max_km)
  if result is None:
    return None
  spot = result["options"][result["recommended"]]
  return spot["lat"], spot["lon"], None, bortle_label(spot["bortle"])

def snap_spot(spot_lat, spot_lon, origin, unit="km"):
  """Moves a dark spot to a dark public place nearby (a park, viewpoint, campsite...) if there is one."""
  bortle = bortle_class(spot_lat, spot_lon)
  place = None
  if bortle:
    place = find_public_place(
      spot_lat, spot_lon, origin=origin,
      bortle_at=bortle_class, max_bortle=bortle, penalty_km=darkness_penalty_km,
    )
  if place and place["name"]:
    spot_lat, spot_lon = place["lat"], place["lon"]

  return {
    "latitude": spot_lat,
    "longitude": spot_lon,
    "distance": haversine(origin, (spot_lat, spot_lon), unit=unit),
    "bortle": classify_location(spot_lat, spot_lon),
    "place": {key: place[key] for key in ("name", "label", "type")} if place else None,
  }

def unsnapped_spot(spot, origin, unit="km"):
  return {
    "latitude": spot["lat"],
    "longitude": spot["lon"],
    "distance": haversine(origin, (spot["lat"], spot["lon"]), unit=unit),
    "bortle": bortle_label(spot["bortle"]),
    "place": None,
  }

def get_coordinate(name):
  value = request.args.get(name, type=float)
  return value if value is not None and np.isfinite(value) else None

@app.route("/")
@cross_origin()
def index():
  latitude = request.args.get("lat", type=float)
  if latitude is None:
    return jsonify({"error": "Latitude missing or it is not a number"})
  longitude = request.args.get("lon", type=float)
  if longitude is None:
    return jsonify({"error": "Longitude missing or it is not a number"})
  
  result = classify_location(latitude, longitude)
  
  if result is None:
    return jsonify({"error": "Location not found"})
  
  return jsonify({
    "bortle": result
  })

@app.route("/nearest")
@cross_origin()
@limiter.limit("10 per minute")
def nearest():
  latitude = get_coordinate("lat")
  if latitude is None:
    return jsonify({"error": "Latitude missing or it is not a number"})
  longitude = get_coordinate("lon")
  if longitude is None:
    return jsonify({"error": "Longitude missing or it is not a number"})
  unit = request.args.get("unit", type=str, default="km")
  requested_km = request.args.get("max_km", type=float, default=DEFAULT_MAX_KM)
  max_km = min(MAX_KM_CHOICES, key=lambda choice: abs(choice - requested_km))
  origin = (latitude, longitude)

  try:
    cur_bortle = classify_location(latitude, longitude)
    result = find_dark_spots(latitude, longitude, max_km)
    if result is None:
      return jsonify({
        "error": "No dark sky location found within search radius"
      })

    # only the recommended spot is snapped to a public place here; the client snaps the
    # others through /place so this response doesn't wait on several Photon calls
    options = []
    for i, spot in enumerate(result["options"]):
      if i == result["recommended"]:
        option = snap_spot(spot["lat"], spot["lon"], origin, unit)
      else:
        option = unsnapped_spot(spot, origin, unit)
      options.append({**option, "recommended": i == result["recommended"]})

    recommended = options[result["recommended"]]
    return jsonify({
      "latitude": recommended["latitude"],
      "longitude": recommended["longitude"],
      "distance": recommended["distance"],
      "bortle": recommended["bortle"],
      "place": recommended["place"],
      "options": options,
      "missing": [bortle_label(k) for k in result["missing"]],
      "max_km": max_km,
      "input": {
        "latitude": latitude,
        "longitude": longitude,
        "bortle": cur_bortle,
      }
    })
  except Exception as e:
    return jsonify({
      "error": str(e)
    })

@app.route("/place")
@cross_origin()
@limiter.limit("30 per minute")
def place():
  coords = [get_coordinate(name) for name in ("lat", "lon", "from_lat", "from_lon")]
  if any(c is None for c in coords):
    return jsonify({"error": "lat, lon, from_lat and from_lon are required numbers"})
  spot_lat, spot_lon, from_lat, from_lon = coords
  unit = request.args.get("unit", type=str, default="km")

  if not bortle_class(spot_lat, spot_lon):
    return jsonify({"error": "Location not found"})
  return jsonify(snap_spot(spot_lat, spot_lon, (from_lat, from_lon), unit))

if __name__ == "__main__":
  app.run(debug=True)