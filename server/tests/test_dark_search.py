import os
import sys

import numpy as np
import pytest
from rasterio.io import MemoryFile
from affine import Affine

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import app as server  # noqa: E402

RES = 1 / 120  # same 30 arc-second pixels as the real map
SIZE = 401
CENTER = SIZE // 2

@pytest.fixture
def raster(monkeypatch):
  """A small fake map around (0, 0), all bortle 6, that tests paint dark pixels onto."""
  classes = np.full((SIZE, SIZE), 6, dtype=np.uint8)
  transform = Affine(RES, 0, -SIZE / 2 * RES, 0, -RES, SIZE / 2 * RES)

  def use():
    memfile = MemoryFile()
    with memfile.open(driver="GTiff", width=SIZE, height=SIZE, count=1, dtype="uint8", transform=transform, crs="EPSG:4326") as dst:
      dst.write(classes, 1)
    monkeypatch.setattr(server, "dat", memfile.open())

  return classes, use

def search():
  return server.find_nearest_dark_location(0.0, 0.0)

def test_bortle_1_beats_a_bortle_4_at_almost_the_same_distance(raster):
  classes, use = raster
  classes[CENTER, CENTER + 20] = 4   # ~18.5 km east
  classes[CENTER, CENTER - 21] = 1   # ~19.5 km west
  use()

  lat, lon, _, bortle = search()

  assert bortle == "1"
  assert lon < 0

def test_much_closer_bortle_4_still_wins(raster):
  classes, use = raster
  classes[CENTER, CENTER + 5] = 4    # ~4.6 km, more than 30 km closer than the bortle 1
  classes[CENTER, CENTER - 60] = 1   # ~55.6 km
  use()

  _, lon, _, bortle = search()

  assert bortle == "4"
  assert lon > 0

def test_prefers_darker_spot_found_outside_the_first_window(raster):
  # the bortle 4 is inside the first 64 px window, the bortle 1 just outside it but within
  # the penalty margin, so the search has to widen the window before it can trust the hit
  classes, use = raster
  classes[CENTER, CENTER + 60] = 4   # ~55.6 km
  classes[CENTER, CENTER - 70] = 1   # ~64.9 km
  use()

  assert search()[3] == "1"

def options(max_km=250):
  result = server.find_dark_spots(0.0, 0.0, max_km)
  return [(o["bortle"], round(o["distance_km"])) for o in result["options"]], result

def test_returns_the_nearest_spot_for_each_darkness_level(raster):
  classes, use = raster
  classes[CENTER, CENTER + 10] = 4   # ~9 km
  classes[CENTER + 20, CENTER] = 3   # ~19 km
  classes[CENTER, CENTER - 40] = 2   # ~37 km
  classes[CENTER - 80, CENTER] = 1   # ~74 km
  use()

  found, result = options()

  assert found == [(4, 9), (3, 19), (2, 37), (1, 74)]
  assert result["missing"] == []

def test_folds_a_level_into_a_darker_spot_that_is_just_as_close(raster):
  classes, use = raster
  classes[CENTER, CENTER + 30] = 3   # ~28 km
  classes[CENTER, CENTER - 20] = 2   # ~19 km: closer than the 3, so it answers "bortle <= 3" too
  use()

  found, result = options()

  assert found == [(2, 19)]
  assert result["missing"] == [1]

def test_levels_beyond_max_km_are_missing(raster):
  classes, use = raster
  classes[CENTER, CENTER + 10] = 4   # ~9 km
  classes[CENTER, CENTER - 150] = 1  # ~139 km
  use()

  found, result = options(max_km=100)

  assert found == [(4, 9)]
  assert result["missing"] == [1, 2, 3]

def test_falls_back_to_the_nearest_spot_when_nothing_is_in_range(raster):
  classes, use = raster
  classes[CENTER, CENTER + 150] = 3  # ~139 km
  use()

  found, result = options(max_km=100)

  assert found == [(3, 139)]
  assert result["recommended"] == 0

def test_recommends_the_best_weighted_option(raster):
  classes, use = raster
  classes[CENTER, CENTER + 20] = 4   # ~18.5 km: score 48.5
  classes[CENTER, CENTER - 35] = 2   # ~32.4 km: score 42.4
  classes[CENTER - 120, CENTER] = 1  # ~111 km: score 111
  use()

  found, result = options()

  assert found == [(4, 19), (2, 32), (1, 111)]
  assert result["options"][result["recommended"]]["bortle"] == 2
