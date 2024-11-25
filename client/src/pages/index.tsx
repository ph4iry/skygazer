/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useRef, FormEvent } from "react";

export default function Home() {
  const [selectedPlace, setSelectedPlace] = useState<google.maps.places.PlaceResult | null>(null);
  const [showMap, setShowMap] = useState(false);

  //44.167102, -73.247038
  const [latitude, setLatitude] = useState(44.167102);
  const [longitude, setLongitude] = useState(-73.247038);

  const [idealLatitude, setIdealLatitude] = useState(0);
  const [idealLongitude, setIdealLongitude] = useState(0);

  const [searchMade, setSearchMade] = useState(false); // New state to track if a search was made
  const mapRef = useRef<google.maps.Map | null>(null);
  const autoCompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const scriptLoaded = useRef(false);

  useEffect(() => {
    if (!scriptLoaded.current) {
      scriptLoaded.current = true;

      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY}&libraries=places&callback=initMap`;
      script.async = true;
      script.defer = true;
      window.initMap = initMap;
      document.head.appendChild(script);

      return () => {
        if (autoCompleteRef.current) {
          google.maps.event.clearInstanceListeners(autoCompleteRef.current);
        }
        const existingScript = document.querySelector(
          'script[src*="maps.googleapis.com"]'
        );
        if (existingScript) existingScript.remove();
      };
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const initMap = () => {
    const input = document.getElementById("address-input") as HTMLInputElement;
    if (!input) return;
    const options = {
      componentRestrictions: { country: "us" },
      fields: ["address_components", "geometry", "name", "formatted_address"],
    };

    autoCompleteRef.current = new google.maps.places.Autocomplete(input, options);
    autoCompleteRef.current.addListener("place_changed", handlePlaceSelect);
  };

  const handlePlaceSelect = () => {
    const place = autoCompleteRef.current?.getPlace();
    if (place && place.geometry) {
      setSelectedPlace(place);
    }
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedPlace) return;

    setSearchMade(true); // Mark that a search has been made
    setShowMap(true);

    setTimeout(() => {
      const location = {
        lat: selectedPlace.geometry!.location.lat(),
        lng: selectedPlace.geometry!.location.lng(),
      };

      fetch(`${process.env.NEXT_PUBLIC_API_URL}/nearest?lat=${location.lat}&lon=${location.lng}`)
      .then((res) => res.json())
      .then((data) => {
        const mapContainer = document.getElementById("map");
        if (!mapContainer) return;

        const idealLocation = {
          lat: data.latitude,
          lng: data.longitude,
        }
        
        setLatitude(location.lat);
        setLongitude(location.lng);

        setIdealLatitude(data.latitude);
        setIdealLongitude(data.longitude);
  
        if (!mapRef.current && mapRef) {
          mapRef.current = new google.maps.Map(mapContainer, {
            zoom: 15,
            center: location,
            mapTypeControl: true,
            fullscreenControl: true,
            streetViewControl: true,
            zoomControl: true,
          });
  
          new google.maps.Marker({
            map: mapRef.current!,
            position: location,
            animation: google.maps.Animation.DROP,
          });
          new google.maps.Marker({
            map: mapRef.current!,
            position: idealLocation,
            animation: google.maps.Animation.DROP,
          });
        } else {
          mapRef.current!.setCenter(location);
          mapRef.current!.setZoom(15);
        }
      }).catch(() => {});
    }, 100);
  };

  const LightPollution = ({ lat, long }:{ lat: number | null, long: number | null }) => {
    const [pinLightPollution, setPinLightPollution] = useState<{
      "bortleClass": number,
      "skyMagnitude": number,
      "totalBrightness": number
    }>(null!);

    const [idealPinLightPollution, setIdealPinLightPollution] = useState<{
      "bortleClass": number,
      "latitude": number,
      "longitude": number,
      "distanceKm": number,
    }>(null!);

    useEffect(() => {
      if (lat !== null && long !== null) {
        fetch(`http://127.0.0.1:5000?lat=${lat}&lon=${long}`)
          .then((res) => res.json())
          .then((data) => setPinLightPollution(data))
          .catch(() => {});

        fetch(`http://127.0.0.1:5000/nearest?lat=${lat}&lon=${long}`)
        .then((res) => res.json())
        .then((data) => setIdealPinLightPollution(data))
        .catch(() => {});
      }
    }, [lat, long]);

    if (!pinLightPollution) {
      return null;
    }

    return (
      <div>
        <div>
          <div className="div p-6 py-8 px-4 left-align text-blue-200">
            Bortle Class: {pinLightPollution?.bortleClass}
            <br />
            Ideal stargazing spot at: {idealPinLightPollution?.latitude} °N, {idealPinLightPollution?.longitude} °W
            <br />
           {idealPinLightPollution?.distanceKm} km away
            </div>
        </div>
      </div>
    )
  };

  const handleReset = () => {
    setShowMap(false);
    setSelectedPlace(null);
    setSearchMade(false); // Reset search state
    const input = document.getElementById("address-input") as HTMLInputElement;
    if (input) input.value = "";
    if (mapRef.current) {
      mapRef.current = null;
    }
  };

  return (
    <div className="h-screen from-black to-blue-900 overflow-hidden inset-0 -z-10 w-full flex gap-8 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px] absolute items-center px-5 py-24 [background:radial-gradient(125%_125%_at_50%_10%,#000_40%,#63e_100%)]">
      {/* <div>bortle scale info</div> */}
      <div className="h-full container mx-auto py-8 px-4">
        <main className="h-full flex flex-col justify-center mx-auto text-center">
          <div
            className={`mb-6 transition-all duration-300 ${
              showMap ? "transform -translate-y-20" : ""
            }`}
          >
            <h1 className="text-6xl font-serif text-white tracking-tight">skygazer</h1>
            <p className="text-blue-200 text-base mt-3 font-mono">
              Find your perfect stargazing spot
            </p>
          </div>

          {!showMap && (
            <p className="text-gray-300 font-mono text-sm mb-6">
              Enter your address to find nearby spots with clear views and minimal light pollution. 
              Built using the Bortle Scale, World Atlas of Artificial Night Sky Brightness, and Google Maps API
            </p>
          )}

            

          <form onSubmit={handleSubmit} className="relative w-full max-w-3xl mx-auto mb-4">
            <div className="relative">
              <input
                id="address-input"
                type="text"
                placeholder="Enter your address..."
                className="w-full px-6 py-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-2">
                {showMap && (
                  <button
                    type="button"
                    onClick={handleReset}
                    className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-full transition-colors"
                  >
                    Reset
                  </button>
                )}
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-full flex items-center gap-2 transition-colors"
                  disabled={!selectedPlace}
                >
                  <span>Search</span>
                </button>
              </div>
            </div>
          </form>

          <div
            id="map"
            className={`w-full max-w-3xl mx-auto rounded-xl transition-all duration-500 ${
              showMap ? "h-96 opacity-100" : "h-0 opacity-0"
            }`}
          />

          {/* Conditionally render LightPollution only if searchMade is true */}
          {searchMade && <LightPollution lat={latitude} long={longitude} />}
        </main>
      </div>
    </div>
  );
}
