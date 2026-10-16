import os
import sys

import pytest
import requests

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import app as server  # noqa: E402
import geocode  # noqa: E402

def feature(lon, lat, countrycode="US", **props):
  return {
    "type": "Feature",
    "properties": {"countrycode": countrycode, **props},
    "geometry": {"type": "Point", "coordinates": [lon, lat]},
  }

PHILLY = feature(
  -75.1672302, 39.9535936,
  name="Four Penn Center", housenumber="1600", street="John F. Kennedy Boulevard",
  city="Philadelphia", state="Pennsylvania", postcode="19103",
)
TORONTO = feature(-79.38, 43.65, countrycode="CA", name="Toronto", state="Ontario")

class FakeResponse:
  def __init__(self, status_code=200, data=None):
    self.status_code = status_code
    self.data = data

  def json(self):
    if isinstance(self.data, Exception):
      raise self.data
    return self.data

@pytest.fixture
def photon(monkeypatch):
  """Replaces requests.get and records each outbound call."""
  calls = []
  state = {"response": FakeResponse(data={"features": [PHILLY]})}

  def fake_get(url, **kwargs):
    calls.append(kwargs)
    response = state["response"]
    if isinstance(response, Exception):
      raise response
    return response

  monkeypatch.setattr(geocode.requests, "get", fake_get)
  state["calls"] = calls
  return state

@pytest.fixture
def client(monkeypatch):
  geocode.cache.clear()
  geocode.limiter.reset()
  # don't make tests wait on the outbound throttle
  monkeypatch.setattr(geocode, "photon_throttle", geocode.Throttle(rate=1000, max_wait=1))
  return server.app.test_client()

def get(client, q, ip="1.2.3.4"):
  return client.get("/autocomplete", query_string={"q": q}, environ_base={"REMOTE_ADDR": ip})

def test_parses_label_and_coordinates(client, photon):
  results = get(client, "1600 penn").get_json()

  assert results == [{
    "label": "Four Penn Center, 1600 John F. Kennedy Boulevard, Philadelphia, Pennsylvania 19103",
    "lat": 39.9535936,
    "lon": -75.1672302,
  }]

def test_geojson_lon_lat_order_is_not_swapped(client, photon):
  # lon and lat here can't be mistaken for each other
  photon["response"] = FakeResponse(data={"features": [feature(-120.5, 35.25, name="Somewhere", state="California")]})

  [result] = get(client, "somewhere").get_json()

  assert result["lat"] == 35.25
  assert result["lon"] == -120.5

def test_sends_user_agent_and_timeout(client, photon):
  get(client, "1600 penn")

  [call] = photon["calls"]
  assert call["headers"]["User-Agent"] == geocode.USER_AGENT
  assert call["timeout"] == 5
  assert call["params"]["q"] == "1600 penn"

def test_filters_out_non_us_results(client, photon):
  photon["response"] = FakeResponse(data={"features": [TORONTO, PHILLY]})

  results = get(client, "penn").get_json()

  assert [r["label"].split(",")[0] for r in results] == ["Four Penn Center"]

def test_skips_malformed_and_duplicate_features(client, photon):
  broken = {"type": "Feature", "properties": {"countrycode": "US", "name": "Broken"}, "geometry": None}
  photon["response"] = FakeResponse(data={"features": [broken, PHILLY, PHILLY]})

  assert len(get(client, "penn").get_json()) == 1

def test_short_queries_do_not_call_photon(client, photon):
  assert get(client, "  ab ").get_json() == []
  assert photon["calls"] == []

def test_normalized_queries_hit_the_cache(client, photon):
  first = get(client, "1600 Penn").get_json()
  second = get(client, "  1600   PENN ").get_json()

  assert first == second
  assert len(photon["calls"]) == 1

@pytest.mark.parametrize("response", [
  FakeResponse(status_code=429),
  FakeResponse(status_code=500),
  FakeResponse(data=ValueError("not json")),
  requests.Timeout(),
  requests.ConnectionError(),
])
def test_photon_failures_return_empty_list_and_are_not_cached(client, photon, response):
  photon["response"] = response

  assert get(client, "1600 penn").get_json() == []

  photon["response"] = FakeResponse(data={"features": [PHILLY]})
  assert len(get(client, "1600 penn").get_json()) == 1
  assert len(photon["calls"]) == 2

def test_per_client_rate_limit(client, photon):
  for _ in range(30):
    assert get(client, "1600 penn").status_code == 200

  assert get(client, "1600 penn").status_code == 429
  # other clients are unaffected
  assert get(client, "1600 penn", ip="5.6.7.8").status_code == 200

def test_throttle_spaces_out_calls(monkeypatch):
  clock = {"now": 100.0}
  waits = []
  monkeypatch.setattr(geocode.time, "monotonic", lambda: clock["now"])
  monkeypatch.setattr(geocode.time, "sleep", waits.append)
  throttle = geocode.Throttle(rate=2, max_wait=1)

  assert [throttle.acquire() for _ in range(4)] == [True, True, True, False]
  assert waits == [0, 0.5, 1.0]

def test_throttled_request_returns_empty_list(client, photon, monkeypatch):
  monkeypatch.setattr(geocode.photon_throttle, "acquire", lambda: False)

  assert get(client, "1600 penn").get_json() == []
  assert photon["calls"] == []
