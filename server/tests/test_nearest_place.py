import os
import sys

import pytest
import requests

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import app as server  # noqa: E402
import geocode  # noqa: E402

DARK_SPOT = (42.6875, -70.6292)
FAR_SPOT = (44.5, -69.5)
BOSTON = (42.36, -71.06)

def place(lon, lat, name, osm_value="park", **props):
  return {
    "type": "Feature",
    "properties": {"name": name, "osm_value": osm_value, "city": "Rockport", "state": "Massachusetts", "countrycode": "US", **props},
    "geometry": {"type": "Point", "coordinates": [lon, lat]},
  }

# ordered the way Photon returns them: closest to the dark spot first
NEAR_SPOT = place(-70.6260, 42.6848, "Andrews Woods", "nature_reserve")
NEAR_USER = place(-70.6500, 42.6700, "Pingree Park")
BRIGHT = place(-70.7000, 42.6000, "Bright Park")

class FakeResponse:
  def __init__(self, status_code=200, data=None):
    self.status_code = status_code
    self.data = data

  def json(self):
    return self.data

@pytest.fixture
def photon(monkeypatch):
  """Answers place lookups and plain reverse lookups separately, recording each call."""
  state = {
    "places": FakeResponse(data={"features": [NEAR_SPOT, NEAR_USER]}),
    "locality": FakeResponse(data={"features": [{"properties": {"city": "Rockport", "state": "Massachusetts"}, "geometry": None}]}),
    "calls": [],
  }

  def fake_get(url, params=None, **kwargs):
    state["calls"].append((url, params))
    response = state["places"] if "osm_tag" in params else state["locality"]
    if isinstance(response, Exception):
      raise response
    return response

  monkeypatch.setattr(geocode.requests, "get", fake_get)
  return state

@pytest.fixture(autouse=True)
def reset(monkeypatch):
  geocode.cache.clear()
  geocode.limiter.reset()
  monkeypatch.setattr(geocode, "photon_throttle", geocode.Throttle(rate=1000, max_wait=1))

def bortle_1(lat, lon):
  return 1

def penalty(bortle):
  return server.KM_PER_BORTLE_CLASS * (bortle - 1)

def find(bortle_at=bortle_1, max_bortle=4):
  return geocode.find_public_place(*DARK_SPOT, origin=BOSTON, bortle_at=bortle_at, max_bortle=max_bortle, penalty_km=penalty)

def test_picks_the_dark_place_closest_to_the_user(photon):
  result = find()

  assert result["name"] == "Pingree Park"
  assert result["label"] == "Rockport, Massachusetts"
  assert result["type"] == "park"

def test_skips_places_that_are_not_dark(photon):
  photon["places"] = FakeResponse(data={"features": [BRIGHT, NEAR_SPOT]})

  result = find(bortle_at=lambda lat, lon: 6 if (lat, lon) == (42.6, -70.7) else 1)

  assert result["name"] == "Andrews Woods"

def test_darker_place_beats_a_slightly_closer_brighter_one(photon):
  # Pingree Park is closer to Boston, but Andrews Woods is three classes darker
  darkness = {"Pingree Park": 4, "Andrews Woods": 1}
  by_coords = {(42.67, -70.65): "Pingree Park", (42.6848, -70.626): "Andrews Woods"}

  result = find(bortle_at=lambda lat, lon: darkness[by_coords[(lat, lon)]])

  assert result["name"] == "Andrews Woods"

def test_skips_places_brighter_than_the_dark_spot(photon):
  # the dark spot is bortle 2, so a bortle 3 park would make the sky worse
  result = find(bortle_at=lambda lat, lon: 3 if (lat, lon) == (42.67, -70.65) else 2, max_bortle=2)

  assert result["name"] == "Andrews Woods"

def test_place_coordinates_are_not_swapped(photon):
  photon["places"] = FakeResponse(data={"features": [place(-120.5, 35.25, "Somewhere Park")]})

  result = find()

  assert (result["lat"], result["lon"]) == (35.25, -120.5)

def test_queries_photon_reverse_with_place_tags(photon):
  find()

  url, params = photon["calls"][0]
  assert url == geocode.PHOTON_REVERSE_URL
  assert (params["lat"], params["lon"]) == DARK_SPOT
  assert "leisure:park" in params["osm_tag"]
  assert "tourism:viewpoint" in params["osm_tag"]

def test_skips_unnamed_placeholder_and_marine_places(photon):
  unnamed = place(-70.62, 42.68, None)
  marine = place(-70.62, 42.68, "Cape Ann State Marine Conservation Area", "nature_reserve")
  placeholders = [place(-70.62, 42.68, name, "camp_site") for name in ("B", "Site 7", "Campsite #12", "Loop C")]
  photon["places"] = FakeResponse(data={"features": [unnamed, marine, *placeholders, NEAR_SPOT]})

  assert find()["name"] == "Andrews Woods"

@pytest.mark.parametrize("features", [[], [NEAR_SPOT]])
def test_falls_back_to_a_locality_label(photon, features):
  photon["places"] = FakeResponse(data={"features": features})

  result = find(bortle_at=lambda lat, lon: 6)

  assert result == {"name": None, "label": "near Rockport, Massachusetts", "type": None, "lat": DARK_SPOT[0], "lon": DARK_SPOT[1]}

@pytest.mark.parametrize("response", [FakeResponse(status_code=429), requests.Timeout()])
def test_photon_failures_return_none(photon, response):
  photon["places"] = response

  assert find() is None

def test_results_are_cached(photon):
  find()
  find()

  assert len(photon["calls"]) == 1

def nearest(client, lat=BOSTON[0], lon=BOSTON[1]):
  return client.get("/nearest", query_string={"lat": lat, "lon": lon}).get_json()

@pytest.fixture
def client(monkeypatch):
  # a fixed dark spot keeps these tests independent of the raster search
  monkeypatch.setattr(server, "find_dark_spots", lambda lat, lon, max_km: {
    "options": [
      {"distance_km": 37.0, "lat": DARK_SPOT[0], "lon": DARK_SPOT[1], "bortle": 4},
      {"distance_km": 210.0, "lat": FAR_SPOT[0], "lon": FAR_SPOT[1], "bortle": 2},
    ],
    "recommended": 0,
    "missing": [1],
  })
  monkeypatch.setattr(server, "bortle_class", lambda lat, lon: 3)
  monkeypatch.setattr(server, "classify_location", lambda lat, lon: "4" if (lat, lon) == DARK_SPOT else "3")
  return server.app.test_client()

def test_nearest_moves_the_spot_to_the_place(client, photon):
  data = nearest(client)

  assert (data["latitude"], data["longitude"]) == (42.67, -70.65)
  assert data["bortle"] == "3"
  assert data["place"] == {"name": "Pingree Park", "label": "Rockport, Massachusetts", "type": "park"}
  assert data["distance"] == pytest.approx(server.haversine(BOSTON, (42.67, -70.65)))

def test_nearest_keeps_the_raw_spot_when_photon_fails(client, photon):
  photon["places"] = requests.ConnectionError()

  data = nearest(client)

  assert (data["latitude"], data["longitude"]) == DARK_SPOT
  assert data["bortle"] == "4"
  assert data["place"] is None

def test_nearest_is_rate_limited(client, photon):
  for _ in range(10):
    assert client.get("/nearest", query_string={"lat": 42.36, "lon": -71.06}).status_code == 200

  assert client.get("/nearest", query_string={"lat": 42.36, "lon": -71.06}).status_code == 429

def test_nearest_returns_options_with_only_the_recommended_one_snapped(client, photon):
  data = nearest(client)

  # the recommended spot moved to a park (bortle 3 there); the other keeps its own class
  assert [o["bortle"] for o in data["options"]] == ["3", "2"]
  recommended, other = data["options"]
  assert recommended["recommended"] and recommended["place"]["name"] == "Pingree Park"
  assert (recommended["latitude"], recommended["longitude"]) == (data["latitude"], data["longitude"])
  assert not other["recommended"] and other["place"] is None
  assert (other["latitude"], other["longitude"]) == FAR_SPOT
  assert other["distance"] == pytest.approx(server.haversine(BOSTON, FAR_SPOT))
  assert data["missing"] == ["1"]
  assert len(photon["calls"]) == 1

@pytest.mark.parametrize("requested, expected", [
  (None, 250), (100, 100), (402.336, 402.336), (804.672, 804.672), (10_000, 805), (1, 25), ("nan", 250),
])
def test_nearest_max_km_is_clamped_to_a_sane_range(client, photon, monkeypatch, requested, expected):
  seen = []
  real = server.find_dark_spots
  monkeypatch.setattr(server, "find_dark_spots", lambda lat, lon, max_km: seen.append(max_km) or real(lat, lon, max_km))
  query = {"lat": BOSTON[0], "lon": BOSTON[1]}
  if requested is not None:
    query["max_km"] = requested

  data = client.get("/nearest", query_string=query).get_json()

  assert seen == [expected]
  assert data["max_km"] == expected

def place_lookup(client, lat=DARK_SPOT[0], lon=DARK_SPOT[1]):
  return client.get("/place", query_string={"lat": lat, "lon": lon, "from_lat": BOSTON[0], "from_lon": BOSTON[1]})

def test_place_snaps_a_spot_on_demand(client, photon):
  data = place_lookup(client).get_json()

  assert data["place"]["name"] == "Pingree Park"
  assert (data["latitude"], data["longitude"]) == (42.67, -70.65)
  assert data["distance"] == pytest.approx(server.haversine(BOSTON, (42.67, -70.65)))

def test_place_keeps_the_raw_spot_when_photon_fails(client, photon):
  photon["places"] = requests.Timeout()

  data = place_lookup(client).get_json()

  assert (data["latitude"], data["longitude"]) == DARK_SPOT
  assert data["place"] is None

def test_place_requires_all_coordinates(client, photon):
  data = client.get("/place", query_string={"lat": 1, "lon": 2}).get_json()

  assert "error" in data

def test_place_is_rate_limited(client, photon):
  for _ in range(30):
    assert place_lookup(client).status_code == 200

  assert place_lookup(client).status_code == 429
