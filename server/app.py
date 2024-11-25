from flask import Flask, request, jsonify
from flask_cors import CORS, cross_origin
import math
import cv2
import numpy as np
import os

app = Flask(__name__)
CORS(app)

# Anchorage
known_location_a = {
  "pixelPositionX": 3592,
  "pixelPositionY": 2866,
  "latitude": 61.156913,
  "longitude": -150.074236
}

# Wellington
# -54.801944, -68.303056
known_location_b = {
  "pixelPositionX": 42576,
  "pixelPositionY": 15166,
  "latitude": -41.342718,
  "longitude": 174.821199
}

def remap(sourceFrom: float, sourceTo: float, targetFrom: float, targetTo: float, value: float):
  return targetFrom + (value - sourceFrom) * (targetTo - targetFrom) / (sourceTo - sourceFrom)

def convert_x(longitude: float):
  return remap(known_location_a["longitude"], known_location_b["longitude"], known_location_a["pixelPositionX"], known_location_b["pixelPositionX"], longitude)

def convert_y(latitude: float):
  return remap(known_location_a["latitude"], known_location_b["latitude"], known_location_a["pixelPositionY"], known_location_b["pixelPositionY"], latitude)

def convert_pixel_to_coords(pixel_x: float, pixel_y: float):
  longitude = remap(known_location_a["pixelPositionX"], known_location_b["pixelPositionX"],
          known_location_a["longitude"], known_location_b["longitude"], pixel_x)
  latitude = remap(known_location_a["pixelPositionY"], known_location_b["pixelPositionY"],
          known_location_a["latitude"], known_location_b["latitude"], pixel_y)
  return latitude, longitude

# Load the image using OpenCV
image = cv2.imread("./World_Atlas_2015.png", cv2.IMREAD_GRAYSCALE)

# Formula from http://unihedron.com/projects/darksky/magconv.php and http://unihedron.com/projects/darksky/mpsastocdm2.pdf
def total_brightness_to_mag_arcsec2(total_brightness: float):
  return -2.5 * math.log10((total_brightness / 1000) / 108000)

# https://en.wikipedia.org/wiki/Bortle_scale
def sky_magnitude_to_bortle_class(sky_magnitude: float):
  values = [21.99, 21.89, 21.69, 20.49, 19.50, 18.94, 18.38]
  for i in range(len(values)):
    if sky_magnitude > values[i]:
      return i + 1
  return 9

def get_bortle_class_at_pixel(pixel_x: int, pixel_y: int, size: int = 1) -> int:
  if (pixel_x < 0 or pixel_x >= image.shape[1] or 
    pixel_y < 0 or pixel_y >= image.shape[0]):
    return 9  # Return worst Bortle class for out of bounds

  x_start = max(0, pixel_x - size)
  y_start = max(0, pixel_y - size)
  x_end = min(image.shape[1], pixel_x + size + 1)
  y_end = min(image.shape[0], pixel_y + size + 1)

  area = image[y_start:y_end, x_start:x_end]
  total_brightness = np.mean(area)
  sky_magnitude = total_brightness_to_mag_arcsec2(float(total_brightness))
  return sky_magnitude_to_bortle_class(sky_magnitude)

def find_nearest_dark_location(start_x: int, start_y: int, max_radius: int = 1000) -> tuple:
  """
  Searches in expanding circles for the nearest pixel with Bortle class 3 or lower.
  Returns (x, y, distance, bortle_class) or None if not found within max_radius.
  """
  for radius in range(max_radius):
    # Check points in a circle at current radius
    for angle in range(360):
      rad = math.radians(angle)
      x = int(start_x + radius * math.cos(rad))
      y = int(start_y + radius * math.sin(rad))
      
      bortle_class = get_bortle_class_at_pixel(x, y)
      if bortle_class <= 5:
        distance = math.sqrt((x - start_x)**2 + (y - start_y)**2)
        return (x, y, distance, bortle_class)
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

  pixel_x = math.floor(convert_x(longitude))
  pixel_y = math.floor(convert_y(latitude))

  # Extract a small area of the image
  size = 1
  x_start = max(0, pixel_x - size)
  y_start = max(0, pixel_y - size)
  x_end = min(image.shape[1], pixel_x + size + 1)
  y_end = min(image.shape[0], pixel_y + size + 1)

  area = image[y_start:y_end, x_start:x_end]
  total_brightness = np.mean(area)  # Average brightness of the area

  sky_magnitude = total_brightness_to_mag_arcsec2(float(total_brightness))
  bortle_class = sky_magnitude_to_bortle_class(sky_magnitude)

  return jsonify({
    "totalBrightness": float(total_brightness),
    "skyMagnitude": sky_magnitude,
    "bortleClass": bortle_class
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

  pixel_x = math.floor(convert_x(longitude))
  pixel_y = math.floor(convert_y(latitude))

  result = find_nearest_dark_location(pixel_x, pixel_y)
  
  if result is None:
    return jsonify({
      "error": "No dark sky location found within search radius"
    })

  found_x, found_y, distance_pixels, bortle_class = result
  found_lat, found_lon = convert_pixel_to_coords(found_x, found_y)

  pixel_distance_per_km = (
    math.sqrt(
      (known_location_b["pixelPositionX"] - known_location_a["pixelPositionX"])**2 +
      (known_location_b["pixelPositionY"] - known_location_a["pixelPositionY"])**2
    ) /
    6371 
  )
  distance_km = distance_pixels / pixel_distance_per_km

  return jsonify({
    "latitude": found_lat,
    "longitude": found_lon,
    "distanceKm": round(distance_km, 2),
    "bortleClass": bortle_class
  })

if __name__ == "__main__":
  app.run()

  if __name__ == "__main__":

    app.run(host='0.0.0.0', port=5000)