# skygazer
 skygazer is a tool to find stargazing sites near you!

 ## how do i use skygazer?
 the process is very simple: type in an address and skygazer will find an optimal skygazing place closest to you! it will try to find places that aren't in the ocean and provides a link to see the location in google maps.

 ## how was skygazer created?
 *skygazer was built by [phaedra sanon](https://github.com/ph4iry) and [zoya hussain](https://github.com/zoya-hussain) at [ascend](https://ascend.hackclub.com), [hack club](https://hackclub.com)'s space-themed hackathon for gender minorities in tech in november 2024.*

### preface
 fun fact: there's no actual RESTful light pollution API out there, so the algorithm fetching the light pollution data being used for this project was built from scratch.

 the process of building this was pretty ridiculous, so i advise you to grab a snack before diving in.

 the map data being used for skygazer is from [David Lorenz's 2022 recalculated World Atlas of Artificial Night Sky Brightness](https://djlorenz.github.io/astronomy/lp2022/). here's what it ends up looking like:

 ![2022 Map](https://djlorenz.github.io/astronomy/lp2022/world2022_low3.png)

 after scouring the internet, we've found some data to work with! now comes the biggest challenge: figuring out how to read it. i've definitely learned a lot about map projections and geographic data representation through this project, but it took quite a few attempts to finally get it right.

 ### attempt 1: use a projection formula[^1] to read pixels from the image
 [^1]: [map projection](https://en.wikipedia.org/wiki/Map_projection) is any set of transformations to represent the curved surface of a globe onto a plane. if you're curious about the formulas, the web mercator projection (our applicable projection here) has a formula of $$ x = \left\lfloor \frac{1}{2\pi} \cdot 2^{\text{zoom level}}(\pi+\lambda) \right\rfloor $$ pixels and $$ y = \left\lfloor \frac{1}{2\pi} \cdot 2^{\text{zoom level}}(\pi-\ln\left[ \tan(\frac{\pi}{4}+\frac{\varphi}{2}) \right])) \right\rfloor $$ pixels, where $ \lambda $ is the longitude in radians and $ \varphi $ is geodetic latitude in radians.


 this was the plan from the beginning, given that the only "APIs" also used this method.

 *what does any of that mean?* maps are always gonna be distorted to some degree because its a 2D representation of our 3D spheroid earth. the projection that most maps use today is the[ *mercator projection*](https://en.wikipedia.org/wiki/Mercator_projection), but online map services like google and bing maps tend to use the [*web mercator projection*](https://en.wikipedia.org/wiki/Web_Mercator_projection). according to wikipedia:
 > *the web mercator uses the spherical formulas at all scales whereas large-scale mercator maps normally use the ellipsoidal form of the projection.*

 problem with this attempt: the formula was yielding some odd results. some of the variables in the formula i didn't know how to find, so after hours of fumbling in desmos for a formula that could've been "close enough" and mindlessly googling "web mercator projection formula", i pivoted to a new method in hopes it could work better.

 ### attempt 2: use the raw data from the new world atlas of night sky brightness[^2]
 [^2]: *Falchi, Fabio; Cinzano, Pierantonio; Duriscoe, Dan; Kyba, Christopher C. M.; Elvidge, Christopher D.; Baugh, Kimberly; Portnov, Boris; Rybnikova, Nataliya A.; Furgoni, Riccardo (2016): Supplement to: The New World Atlas of Artificial Night Sky Brightness. V. 1.1. GFZ Data Services. https://doi.org/10.5880/GFZ.1.4.2016.001*

 this method ended up being the most resource consuming. the file format of the original data is a `.kmz` file, which is essentially a glorified `.zip` file with a folder of tilable `.png`s and a text-based `.kml` file that is essentially an XML file with references to the tiled images. lot's of file formats to work with here!

 the main problem with using this file format is that the tiled images weren't polygons that could be read through the `.kml` file alone; in order to read the data, i'd have to tile all of the images on a globe, such as google earth (one of the few services that even supports `.kmz` files), and then re-export it as a geotiff (`.tif`) file.

 what's a geotiff file? essentially a georeferenced[^3] image where values can be easily referenced using the file's (configurable) coordinate reference system.

 [^3]: **georeferencing**: the process of assigning geographic coordinates to a digital image or map to align it with a specific location on Earth

 with more research, i found my main task: somehow convert the original png above to a georeferenced image, and use some sort of software in python to fetch the rgb values of a pixel. we're getting somewhere!

 ### attempt 3: reproject the image as a geotiff file using geographical information system (gis) software
 on David Lorenz's website, he lists the latitudinal and longitudinal bounds of all of his recalculated maps. in order to georeference the png and convert it to a geotiff, i found [QGIS](https://www.qgis.org/)–an open source software that was literally *just* what i needed.

 *after weeks of battling with kmls, kmzs, geojsons, and geotiffs, the light pollution api whirred to life successfully!*

 ### so now we have a map that can be read by the server. now what?
 time to get into the algorithmic bit–which is probably more what you're looking to read about. just getting the data was a challenge, but reading it was a bit less of an issue.

 since we can now read the pixel RGB values at a coordinate using Python, fetching the Bortle rating of a location is as simple as classifying the color at the given coordinate.

 but what about finding the nearest stargazing location?

 ### finding my closest stargazing location

 the algorithm ended up being pretty simple (mostly because it would be too much work to overcomplicate things long after the geoprocessing nonsense):
 1. create a circle of radius `n` around the location given
 2. sweep around the center point in 5º increments along the circle
 3. if at any point the pixel being read has a Bortle scale[^4] value of 4 or less, stop

 this is DEFINITELY not the most optimized solution, but it gets the job done and finds a location with a "good-enough" bortle scale.

 [^4]: the [bortle scale](https://en.wikipedia.org/wiki/Bortle_scale) (also explained on the skygazer site) is a nine-level numeric scale that measures the night sky's brightness of a particular location.

 the implementation of this looks very complicated, but this is the core of the API. feel free to check out the source code and how it works!
