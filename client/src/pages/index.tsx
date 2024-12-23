import { useState } from 'react';
import GoogleMap from '@/components/GoogleMap';
import SearchBar from '@/components/SearchBar';
import LightPollutionInfo from '@/components/LightPollutionInfo';
import { LightPollutionData, Location } from '@/types';
import { APIProvider } from '@vis.gl/react-google-maps';
import Image from 'next/image';
import { AnimatePresence, motion } from 'motion/react';
import InfoCard from '@/components/InfoCard';

export default function Home() {
  const [selectedPlace, setSelectedPlace] = useState<google.maps.places.PlaceResult | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [, setSearchMade] = useState(false);
  const [lightPollutionData, setLightPollutionData] = useState<LightPollutionData | null>(null);
  const [inputLocation, setInputLocation] = useState<Location | null>(null);

  const handlePlaceSelect = async (place: google.maps.places.PlaceResult) => {
    setSelectedPlace(place);
    if (place.geometry?.location) {
      const { lat, lng } = place.geometry.location;
      const location = { lat: lat(), lng: lng() };
      setInputLocation(location);

      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/nearest?lat=${location.lat}&lon=${location.lng}`);
        const data = await response.json();
        setLightPollutionData(data);
        setShowMap(true);
        setSearchMade(true);
      } catch (error) {
        console.error(error);
      }
    }
  }

  const handleReset = () => {
    setShowMap(false);
    setSelectedPlace(null);
    setSearchMade(false);
    setLightPollutionData(null);
    setInputLocation(null);
    const input = document.getElementById('address-input') as HTMLInputElement;
    if (input) {
      input.value = '';
    }
  }

  return (
    <div className="h-screen from-black to-blue-900 overflow-visible inset-0 -z-10 w-full flex flex-col-reverse lg:flex-row justify-center lg:justify-between gap-8 lg:gap-16 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px] absolute items-center px-5 lg:px-20 py-24 [background:radial-gradient(125%_125%_at_50%_10%,#000_40%,#63e_100%)]">
      <InfoCard />
      <div className="lg:w-2/3 py-8 px-4">
        <main className="flex flex-col justify-center text-center">
          <div className="mb-6 transition-all duration-300">
            <h1 className="text-6xl font-serif text-white tracking-tight">skygazer</h1>
            <p className="text-blue-200 text-base mt-3 font-mono">Find your perfect stargazing spot</p>
          </div>

          <AnimatePresence>
            {!showMap && <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-gray-300 font-mono text-sm mb-6">
              <p>Enter your address to find nearby spots with clear views and minimal light pollution.</p>
              <p>Built using the Bortle Scale, the World Atlas of Artificial Night Sky Brightness, and the Google Maps API</p>
            </motion.section>}
          </AnimatePresence>

          <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY!}>
            <form onSubmit={(e) => e.preventDefault()} className="relative w-full max-w-3xl mx-auto mb-4">
              <SearchBar
                onPlaceSelect={handlePlaceSelect}
                onReset={handleReset}
                showMap={showMap}
                selectedPlace={selectedPlace}
              />
            </form>

            <AnimatePresence>
              {showMap && inputLocation && lightPollutionData && (
                <GoogleMap
                  inputLocation={inputLocation!}
                  idealLocation={{ lat: lightPollutionData.latitude, lng: lightPollutionData.longitude }}
                />
              )}
            </AnimatePresence>
            <AnimatePresence>
              {showMap && inputLocation && lightPollutionData && (
                <LightPollutionInfo data={lightPollutionData} />
              )}
            </AnimatePresence>
          </APIProvider>

        </main>
      </div>
    </div>
  )
}