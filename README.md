# skygazer
 skygazer is a tool to find stargazing sites near you!

 ## How do I use skygazer?
 The process is very simple: type in an address and skygazer will find an optimal skygazing place closest to you! It will try to find places that aren't in the ocean and provides a link to see the location in Google Maps.

 ## How was skygazer created?
 *skygazer was built by [Phaedra Sanon](https://github.com/ph4iry) and [Zoya Hussain](https://github.com/zoya-hussain) at [Ascend](https://ascend.hackclub.com), [Hack Club](https://hackclub.com)'s space-themed hackathon for gender minorities in tech in November 2024.*

### Preface
 Fun fact: there's no actual RESTful light pollution API out there, so the algorithm fetching the light pollution data being used for this project was built from scratch.

 The process of building this was pretty ridiculous, so I advise you to grab a snack before diving in.

 The map data being used for skygazer is from [David Lorenz's 2022 recalculated World Atlas of Artificial Night Sky Brightness](https://djlorenz.github.io/astronomy/lp2022/). Here's what it ends up looking like:

 ![2022 Map](https://djlorenz.github.io/astronomy/lp2022/world2022_low3.png)

 After scouring the internet, we've found some data to work with! Now comes the biggest challenge: figuring out how to read it. I've definitely learned a lot about map projections and geographic data representation through this project, but it took quite a few attempts to finally get it right.

 ### Attempt 1: Use a projection formula to read pixels from the image
 
 [Map projection](https://en.wikipedia.org/wiki/Map_projection) is any set of transformations to represent the curved surface of a globe onto a plane.
 
 *What does any of that mean?* Maps are always gonna be distorted to some degree because its a 2D representation of our 3D spheroid Earth. The projection that most maps use today is the[ *Mercator projection*](https://en.wikipedia.org/wiki/Mercator_projection), but online map services like Google and Bing Maps tend to use the [*Web Mercator projection*](https://en.wikipedia.org/wiki/Web_Mercator_projection). According to Wikipedia:
 > *The Web Mercator uses the spherical formulas at all scales whereas large-scale Mercator maps normally use the ellipsoidal form of the projection.*
 
 If you're curious about the formulas, our applicable formula is represented as
 
 $$ x = \left\lfloor \frac{1}{2\pi} \cdot 2^{\text{zoom level}}(\pi+\lambda) \right\rfloor \text{pixels,}$$
 
 $$ y = \left\lfloor \frac{1}{2\pi} \cdot 2^{\text{zoom level}}(\pi-\ln\left[ \tan(\frac{\pi}{4}+\frac{\varphi}{2}) \right])) \right\rfloor \text{pixels} $$
 
 where $\lambda$ is the longitude in radians and $\varphi$ is geodetic latitude[^1] in radians.

 [^1]: **Geodetic latitude**: The angle between the equatorial plane and the line that is perpendicular to the surface of an ellipsoid at a given point

 This was the plan from the beginning, given that the only open-source APIs with source code available also used this method.


 Problem with this attempt: the formula was yielding some odd results. Some of the variables in the formula I didn't know how to find, so after hours of fumbling in Desmos for a formula that could've been "close enough" and mindlessly googling "web mercator projection formula", I pivoted to a new method in hopes it could work better.

 ### Attempt 2: Use the raw data from the New World Atlas of Night Sky Brightness[^2]
 [^2]: *Falchi, Fabio; Cinzano, Pierantonio; Duriscoe, Dan; Kyba, Christopher C. M.; Elvidge, Christopher D.; Baugh, Kimberly; Portnov, Boris; Rybnikova, Nataliya A.; Furgoni, Riccardo (2016): Supplement to: The New World Atlas of Artificial Night Sky Brightness. V. 1.1. GFZ Data Services. https://doi.org/10.5880/GFZ.1.4.2016.001*

 This method ended up being the most resource consuming. The file format of the original data is a `.kmz` file, which is essentially a glorified `.zip` file with a folder of tilable `.png`s and a text-based `.kml` file that is essentially an XML file with references to the tiled images. Lot's of file formats to work with here!

 The main problem with using this file format is that the tiled images weren't polygons that could be read through the `.kml` file alone; in order to read the data, I'd have to tile all of the images on a globe, such as Google Earth (one of the few services that even supports `.kmz` files), and then re-export it as a GeoTIFF (`.tif`) file.

 What's a GeoTIFF file? Essentially a georeferenced[^3] image where values can be easily referenced using the file's (configurable) coordinate reference system.

 [^3]: **Georeferencing**: The process of assigning geographic coordinates to a digital image or map to align it with a specific location on Earth

 With more research, I found my main task: somehow convert the original PNG above to a georeferenced image, and use some sort of software in Python to fetch the RGB values of a pixel. We're getting somewhere!

 ### Attempt 3: Reproject the image as a GeoTIFF file using geographical information system (GIS) software
 On David Lorenz's recalculated map page, he lists the latitudinal and longitudinal bounds of all of his recalculated maps. In order to georeference the PNG and convert it to a GeoTIFF, I found [QGIS](https://www.qgis.org/)–an open source software that was literally *just* what I needed.

 *After weeks of battling with KMLs, KMZs, GeoJSONs, and GeoTIFFs, the light pollution API whirred to life successfully!*

 ### So now we have a map that can be read by the server. Now what?
 Time to get into the algorithmic bit–which is probably more what you're looking to read about. Just getting the data was a challenge, but reading it was a bit less of an issue.

 Since we can now read the pixel RGB values at a coordinate using Python, fetching the Bortle rating of a location is as simple as classifying the color at the given coordinate.

 But what about finding the nearest stargazing location?

 ### Finding my closest stargazing location

 The first version of the algorithm was pretty simple: draw a circle of radius `n` pixels around the location, sweep around it in 5º steps, and stop at the first pixel with a Bortle scale[^4] value of 4 or less. It worked, but it took several seconds per search, it skipped pixels on big search radii, and it needed the whole 725 MB map loaded into memory.

 [^4]: The [Bortle scale](https://en.wikipedia.org/wiki/Bortle_scale) (also explained on the skygazer site) is a nine-level numeric scale that measures the night sky's brightness of a particular location.

 Now it works in two parts:

 **Preprocessing (done once).** [`server/scripts/build_raster.py`](server/scripts/build_raster.py) turns the raw map into a raster where each pixel already holds its Bortle class, with ocean pixels set to 0. Light pollution comes in big uniform patches, so a tiled, compressed GeoTIFF shrinks the data from 725 MB to about 6 MB (`server/data/bortle.tif`).

 **Searching (every request).**
 1. Read a square window of pixels around the location (starting at ~7 km)
 2. Use NumPy to find every dark (Bortle ≤ 4) land pixel in it, then compute real great-circle distances to the closest candidates
 3. The window is square in degrees, not kilometers, so a hit only counts if it's closer than the window's nearest edge. Otherwise, double the window and try again

 The server only reads the tiles it needs, so a search takes a few milliseconds and the API runs in under 100 MB of memory.

 To rebuild the data from the original map: put `map.tif` in `server/`, `pip install -r requirements-build.txt`, and run `python scripts/build_raster.py`.
