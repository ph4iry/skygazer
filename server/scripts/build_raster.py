"""
Convert the raw light pollution map (map.tif, ~725 MB) into a small, tiled,
compressed Bortle class raster (data/bortle.tif) that the API reads on demand.

Pixel values in the output:
  0     = water / no data
  1..8  = Bortle class (8 stands for "8-9")

Needs requirements-build.txt.
Usage: python scripts/build_raster.py [input.tif] [output.tif]
"""
import os
import sys
import numpy as np
import rasterio
from rasterio.windows import Window
from global_land_mask import globe

SRC = sys.argv[1] if len(sys.argv) > 1 else "map.tif"
DST = sys.argv[2] if len(sys.argv) > 2 else "data/bortle.tif"
STRIP = 512  # rows per pass, matches the output tile size

# raw palette value -> bortle class (same mapping the old classify_sqm used)
LUT = np.ones(256, dtype=np.uint8)
for value, bortle in {4: 2, 5: 2, 6: 3, 7: 4, 8: 5, 9: 5, 10: 6, 11: 6, 12: 7, 13: 8, 14: 8}.items():
  LUT[value] = bortle

def build():
  os.makedirs(os.path.dirname(DST) or ".", exist_ok=True)

  with rasterio.open(SRC) as src:
    profile = {
      "driver": "GTiff",
      "dtype": "uint8",
      "count": 1,
      "width": src.width,
      "height": src.height,
      # the source is labelled EPSG:3857 but its transform is in degrees
      "crs": "EPSG:4326",
      "transform": src.transform,
      "nodata": 0,
      "tiled": True,
      "blockxsize": 512,
      "blockysize": 512,
      "compress": "DEFLATE",
      "predictor": 2,
      "zlevel": 9,
    }

    t = src.transform
    lons = t.c + (np.arange(src.width) + 0.5) * t.a

    with rasterio.open(DST, "w", **profile) as dst:
      for row in range(0, src.height, STRIP):
        n = min(STRIP, src.height - row)
        window = Window(0, row, src.width, n)
        classes = LUT[src.read(1, window=window)]

        lats = t.f + (np.arange(row, row + n) + 0.5) * t.e
        lat_grid, lon_grid = np.meshgrid(lats, lons, indexing="ij")
        classes[~globe.is_land(lat_grid, lon_grid)] = 0

        dst.write(classes, 1, window=window)
        print(f"\r{row + n}/{src.height} rows", end="", flush=True)

  print(f"\nwrote {DST}: {os.path.getsize(DST) / 1e6:.1f} MB")

def spot_check():
  points = [(42.36, -71.06), (40.71, -74.01), (39.74, -104.99), (51.51, -0.13), (35.68, 139.69), (44.43, -110.59)]
  with rasterio.open(SRC) as src, rasterio.open(DST) as dst:
    for lat, lon in points:
      raw = next(src.sample([(lon, lat)]))[0]
      out = next(dst.sample([(lon, lat)]))[0]
      status = "ok" if LUT[raw] == out or out == 0 else "MISMATCH"
      print(f"({lat}, {lon}) raw={raw} expected={LUT[raw]} got={out} {status}")

if __name__ == "__main__":
  build()
  spot_check()
