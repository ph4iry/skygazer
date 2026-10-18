import { useCallback, useRef, useState } from 'react';
import { IoInformationCircleOutline } from 'react-icons/io5';
import { FaGithub } from 'react-icons/fa6';
import dynamic from 'next/dynamic';
import SearchBar from '@/components/SearchBar';
import LightPollutionInfo from '@/components/LightPollutionInfo';
import SpotOptions from '@/components/SpotOptions';
import LoadingDivider from '@/components/LoadingDivider';
import { LightPollutionData, Location, Spot, Suggestion } from '@/types';
import { AnimatePresence, motion } from 'motion/react';
import InfoCard from '@/components/InfoCard';

// leaflet needs `window`, so only load the map in the browser
const ResultMap = dynamic(() => import('@/components/ResultMap'), { ssr: false });

const API_URL = process.env.NEXT_PUBLIC_API_URL;
const DEFAULT_MAX_KM = 250;
// frosted-glass pill used for the links under the tagline
const GLASS_PILL = "inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 font-body text-sm text-indigo-100 shadow-md shadow-black/20 backdrop-blur-md transition-colors hover:bg-white/20 hover:border-white/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500";

export default function Home() {
  const [selectedPlace, setSelectedPlace] = useState<Suggestion | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [, setSearchMade] = useState(false);
  const [lightPollutionData, setLightPollutionData] = useState<LightPollutionData | null>(null);
  const [inputLocation, setInputLocation] = useState<Location | null>(null);
  const [maxKm, setMaxKm] = useState(DEFAULT_MAX_KM);
  const [selectedOption, setSelectedOption] = useState(0);
  // bumped for every new address so the results remount and replay their animations;
  // changing the range for the same address keeps it and just updates the values
  const [searchId, setSearchId] = useState(0);
  const [aboutOpen, setAboutOpen] = useState(false);
  // stable so the modal's focus and keyboard effect only runs when it opens or closes
  const closeAbout = useCallback(() => setAboutOpen(false), []);
  const [loading, setLoading] = useState(false);
  // cancels the current search and its /place lookups when a new search starts or on reset
  const requestRef = useRef<AbortController | null>(null);

  const fetchNearest = async (location: Location, km: number) => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/nearest?lat=${location.lat}&lon=${location.lng}&max_km=${km}`, { signal: controller.signal });
      const data = await response.json();
      if (!response.ok || data.error || !data.options?.length) {
        console.error(data.error ?? `nearest failed with ${response.status}`);
        return;
      }

      const recommended = data.options.findIndex((o: { recommended: boolean }) => o.recommended);
      data.options = data.options.map((o: { recommended: boolean }) => ({ ...o, snapping: !o.recommended }));
      setLightPollutionData(data);
      setSelectedOption(Math.max(recommended, 0));
      setShowMap(true);
      setSearchMade(true);
      setLoading(false);
      await snapOptions(data, location, controller.signal);
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        console.error(error);
      }
    } finally {
      if (requestRef.current === controller) {
        setLoading(false);
      }
    }
  }

  // move the other options to parks one at a time, so rows fill in without flooding the API
  const snapOptions = async (data: LightPollutionData, location: Location, signal: AbortSignal) => {
    for (const [i, option] of data.options.entries()) {
      if (!option.snapping) continue;
      let snapped: Partial<Spot> = {};
      try {
        const params = new URLSearchParams({
          lat: `${option.latitude}`, lon: `${option.longitude}`, from_lat: `${location.lat}`, from_lon: `${location.lng}`,
        });
        const response = await fetch(`${API_URL}/place?${params}`, { signal });
        const result = await response.json();
        if (response.ok && !result.error) {
          snapped = result;
        }
      } catch (error) {
        if ((error as Error).name === 'AbortError') return;
      }
      setLightPollutionData((current) => current && {
        ...current,
        options: current.options.map((o, j) => (j === i ? { ...o, ...snapped, snapping: false } : o)),
      });
    }
  }

  const handlePlaceSelect = (place: Suggestion) => {
    // hide the old results while the new ones load, so they animate out and back in
    setShowMap(false);
    setSearchId((id) => id + 1);
    setSelectedPlace(place);
    const location: Location = { lat: place.lat, lng: place.lon };
    setInputLocation(location);
    fetchNearest(location, maxKm);
  }

  const handleRangeChange = (km: number) => {
    setMaxKm(km);
    if (inputLocation) {
      fetchNearest(inputLocation, km);
    }
  }

  const handleReset = () => {
    requestRef.current?.abort();
    requestRef.current = null;
    setLoading(false);
    setSelectedOption(0);
    setShowMap(false);
    setSelectedPlace(null);
    setSearchMade(false);
    setLightPollutionData(null);
    setInputLocation(null);
  }

  return (
    <div className="min-h-screen from-black to-blue-900 overflow-visible inset-x-0 top-0 -z-10 w-full flex flex-col-reverse lg:flex-row justify-center gap-8 lg:gap-16 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px] absolute items-center px-5 lg:px-20 py-24 [background:radial-gradient(125%_125%_at_50%_10%,#000_40%,#63e_100%)]">
      <InfoCard open={aboutOpen} onClose={closeAbout} />
      <div className="lg:w-2/3 py-8 px-4">
        <main className="flex flex-col justify-center text-center">
          <div className="mb-6 transition-all duration-300">
            <h1 className="text-6xl font-display text-white tracking-tight">skygazer</h1>
            <p className="text-blue-200 text-base mt-3 font-body">Find your perfect stargazing spot</p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setAboutOpen(true)}
                aria-haspopup="dialog"
                className={GLASS_PILL}
              >
                <IoInformationCircleOutline className="size-4" />
                {/* shorter labels on phones so both pills fit on one row */}
                <span className="sm:hidden">bortle scale?</span>
                <span className="hidden sm:inline">what&apos;s the bortle scale?</span>
              </button>
              <a
                href="https://github.com/ph4iry/skygazer"
                target="_blank"
                rel="noreferrer noopener"
                className={GLASS_PILL}
              >
                <FaGithub className="size-4" />
                <span className="sm:hidden">github</span>
                <span className="hidden sm:inline">ph4iry/skygazer</span>
              </a>
            </div>
          </div>

          <AnimatePresence>
            {!showMap && <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-gray-300 font-body text-sm mb-6">
              <p>Enter your address to find nearby spots with clear views and minimal light pollution.</p>
              <p>Built using the Bortle Scale, the World Atlas of Artificial Night Sky Brightness, and OpenStreetMap</p>
            </motion.section>}
          </AnimatePresence>

          <form onSubmit={(e) => e.preventDefault()} className="relative w-full max-w-3xl mx-auto mb-4">
            <SearchBar
              onPlaceSelect={handlePlaceSelect}
              onReset={handleReset}
              showMap={showMap}
              selectedPlace={selectedPlace}
            />
          </form>

          {/* the loading divider shares this slot with the map, so it only appears once the old
              results have left and leaves again before the new ones come in */}
          <AnimatePresence mode="wait">
            {showMap && inputLocation && lightPollutionData ? (
              <ResultMap
                key={searchId}
                inputLocation={inputLocation!}
                options={lightPollutionData.options}
                selectedIndex={selectedOption}
                onSelect={setSelectedOption}
              />
            ) : loading && (
              <LoadingDivider key="loading" />
            )}
          </AnimatePresence>
          <AnimatePresence mode="wait">
            {showMap && inputLocation && lightPollutionData && (
              <SpotOptions
                key={searchId}
                options={lightPollutionData.options}
                missing={lightPollutionData.missing}
                maxKm={lightPollutionData.max_km}
                selectedIndex={selectedOption}
                loading={loading}
                onSelect={setSelectedOption}
                onRangeChange={handleRangeChange}
              />
            )}
          </AnimatePresence>
          <AnimatePresence mode="wait">
            {showMap && inputLocation && lightPollutionData && (
              <LightPollutionInfo key={searchId} data={lightPollutionData} spot={lightPollutionData.options[selectedOption]} />
            )}
          </AnimatePresence>

        </main>
      </div>
    </div>
  )
}