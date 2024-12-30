from flask import Flask, request, jsonify
from flask_cors import CORS, cross_origin
import math
import numpy as np
import rasterio
import rasterio.transform
from global_land_mask import globe
from haversine import haversine

app = Flask(__name__)
CORS(app)

dat = rasterio.open(r"./map.tif")
z = dat.read()[0]

def map_location_to_pixel(lat, lon):
  idx = dat.index(lon, lat, precision=1E-6)
  return z[idx]
    
def classify_sqm(rgb): # sqm = sky quality meter, in mag/arcsec^2
  bortle_scale = {
    "1": [0, 1, 2, 3] + list(range(15, 256)),
    "2": [4, 5],
    "3": [6],
    "4": [7],
    "5": [8, 9],
    "6": [10, 11],
    "7": [12],
    "8-9": [13, 14],
  }
  
  for bortle_class, colors in bortle_scale.items():
    for color in colors:
      if np.all(rgb == color):
        return bortle_class

  return None

def find_nearest_dark_location(lat, lon):
  height, width = z.shape
  
  center_idx = dat.index(lon, lat, precision=1E-6)
  center_r, center_c = center_idx
  max_distance = max(height, width)
  
  for radius in range(1, max_distance):
    # sweep around the center px at radius r
    for angle in range(0, 360, 5):
      angle_rad = math.radians(angle)
      d_row = int(radius * math.sin(angle_rad))
      d_col = int(radius * math.cos(angle_rad))
      cur_row = center_r + d_row
      cur_col = center_c + d_col
      
      
      if 0 <= cur_row < height and 0 <= cur_col < width:
        nearest_lon, nearest_lat = dat.xy(cur_row, cur_col)
        if not globe.is_land(nearest_lat, nearest_lon):
          continue
        rgb = np.array([z[cur_row, cur_col]])
        bortle = classify_sqm(rgb)
        if bortle is not None and int(bortle.split("-")[0]) <= 4:
          nearest_lon, nearest_lat = dat.xy(cur_row, cur_col)
          return nearest_lat, nearest_lon, radius, bortle
  
  return None

@app.route("/")
@cross_origin()
def index():
  latitude = request.args.get("lat", type=float)
  if latitude is None:
    return jsonify({"error": "Latitude missing or it is not a number"})
  longitude = request.args.get("lon", type=float)
  if longitude is None:
    return jsonify({"error": "Longitude missing or it is not a number"})
  
  pixel = map_location_to_pixel(latitude, longitude)
  result = classify_sqm(pixel)
  
  if result is None:
    return jsonify({"error": "Location not found"})
  
  return jsonify({
    "bortle": result
  })

@app.route("/nearest")
@cross_origin()
def nearest():
  latitude = request.args.get("lat", type=float)
  if latitude is None:
    return jsonify({"error": "Latitude missing or it is not a number"})
  longitude = request.args.get("lon", type=float)
  if longitude is None:
    return jsonify({"error": "Longitude missing or it is not a number"})
  unit = request.args.get("unit", type=str, default="km")

  try:
    cur_bortle = classify_sqm(map_location_to_pixel(latitude, longitude))
    result = find_nearest_dark_location(latitude, longitude)
    if result is None:
      return jsonify({
        "error": "No dark sky location found within search radius"
      })
      
    nearest_lat, nearest_lon, radius, bortle = result
    
    return jsonify({
      "latitude": nearest_lat,
      "longitude": nearest_lon,
      "distance": haversine((latitude, longitude), (nearest_lat, nearest_lon), unit=unit),
      "bortle": bortle,
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
    
if __name__ == "__main__":
  app.run(debug=True)