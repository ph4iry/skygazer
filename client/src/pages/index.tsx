import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import SearchBar from '@/components/SearchBar';
import LightPollutionInfo from '@/components/LightPollutionInfo';
import SpotOptions from '@/components/SpotOptions';
import LoadingDivider from '@/components/LoadingDivider';
import HeaderLinks from '@/components/HeaderLinks';
import { LightPollutionData, Location, Spot, SpotOption, Suggestion } from '@/types';
import { DEFAULT_RANGE, DEFAULT_UNIT, DistanceUnit, loadUnit, saveUnit, toKm } from '@/utils/units';
import { AnimatePresence, motion } from 'motion/react';
import InfoCard from '@/components/InfoCard';
import StarrySky from '@/components/StarrySky';

// leaflet needs `window`, so only load the map in the browser
const ResultMap = dynamic(() => import('@/components/ResultMap'), { ssr: false });

const API_URL = process.env.NEXT_PUBLIC_API_URL;

const spotKey = (spot: Spot) => `${spot.latitude},${spot.longitude}`;

// the background sky before any search: a nice rural sky
const LANDING_SKY_BORTLE = 3;
// how long the sky shows the user's own location before easing to the chosen spot, roughly when
// the info card moves from "your location" to "the ideal location"
const INPUT_SKY_MS = 2200;

// bortle labels are "1".."7" or "8-9"; water or unknown locations get a bright suburban sky
const bortleLevel = (label: string | number | null | undefined) => {
  const level = parseInt(`${label ?? ''}`, 10);
  return Number.isFinite(level) ? level : 5;
};

export default function Home() {
  const [selectedPlace, setSelectedPlace] = useState<Suggestion | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [, setSearchMade] = useState(false);
  const [lightPollutionData, setLightPollutionData] = useState<LightPollutionData | null>(null);
  const [inputLocation, setInputLocation] = useState<Location | null>(null);
  // the selected range pill, in `unit`; the API always gets km
  const [range, setRange] = useState(DEFAULT_RANGE);
  const [unit, setUnit] = useState<DistanceUnit>(DEFAULT_UNIT);
  const [selectedOption, setSelectedOption] = useState(0);
  // bumped for every new address so the results remount and replay their animations;
  // changing the range for the same address keeps it and just updates the values
  const [searchId, setSearchId] = useState(0);
  // after each new search the sky shows the user's location first, then the selected spot
  const [skyShowsInput, setSkyShowsInput] = useState(false);
  // from the moment an address is picked until reset, the big header gives way to the topbar
  const compactHeader = selectedPlace !== null;
  const [aboutOpen, setAboutOpen] = useState(false);
  // stable so the modal's focus and keyboard effect only runs when it opens or closes
  const closeAbout = useCallback(() => setAboutOpen(false), []);
  const [loading, setLoading] = useState(false);
  // cancels the current search and its /place lookups when a new search starts or on reset
  const requestRef = useRef<AbortController | null>(null);
  // /place results for the current address, keyed by the raw dark spot. Changing the range or unit
  // searches again and mostly returns the same spots, so this keeps their park names from
  // flashing back to coordinates while they're looked up a second time
  const snapCacheRef = useRef(new Map<string, Partial<Spot>>());
  // the right-hand results column; the map matches its height on md+
  const columnRef = useRef<HTMLDivElement>(null);
  const [columnHeight, setColumnHeight] = useState<number | null>(null);

  useEffect(() => {
    const column = columnRef.current;
    if (!column) return;
    const observer = new ResizeObserver(([entry]) => setColumnHeight(Math.round(entry.contentRect.height)));
    observer.observe(column);
    return () => observer.disconnect();
  }, []);

  // read the saved unit after mount, since the server render can't see localStorage
  useEffect(() => {
    setUnit(loadUnit());
  }, []);

  useEffect(() => {
    if (!showMap) return;
    setSkyShowsInput(true);
    const timer = setTimeout(() => setSkyShowsInput(false), INPUT_SKY_MS);
    return () => clearTimeout(timer);
  }, [searchId, showMap]);

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
      data.options = (data.options as SpotOption[]).map((o) => {
        // the recommended spot arrives already moved to a park by /nearest
        if (o.recommended) return { ...o, snapping: false };
        const cached = snapCacheRef.current.get(spotKey(o));
        return cached ? { ...o, ...cached, snapping: false } : { ...o, snapping: true };
      });
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
          snapCacheRef.current.set(spotKey(option), result);
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
    // park lookups are measured from the old address, so they don't carry over
    snapCacheRef.current.clear();
    // hide the old results while the new ones load, so they animate out and back in
    setShowMap(false);
    setSearchId((id) => id + 1);
    setSelectedPlace(place);
    const location: Location = { lat: place.lat, lng: place.lon };
    setInputLocation(location);
    fetchNearest(location, toKm(range, unit));
  }

  const handleRangeChange = (choice: number) => {
    setRange(choice);
    if (inputLocation) {
      fetchNearest(inputLocation, toKm(choice, unit));
    }
  }

  // "250 mi" and "250 km" are different searches, so switching units searches again
  const handleUnitChange = (next: DistanceUnit) => {
    if (next === unit) return;
    setUnit(next);
    saveUnit(next);
    if (inputLocation) {
      fetchNearest(inputLocation, toKm(range, next));
    }
  }

  const handleReset = () => {
    snapCacheRef.current.clear();
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

  const selectedSpot = lightPollutionData?.options[selectedOption];
  // while a new search loads, the old results are still in state, so the sky holds steady
  const skyBortle = !lightPollutionData
    ? LANDING_SKY_BORTLE
    : bortleLevel(skyShowsInput ? lightPollutionData.input.bortle : selectedSpot?.bortle);

  return (
    <div className="min-h-screen from-black to-blue-900 overflow-visible inset-x-0 top-0 -z-10 w-full flex flex-col-reverse lg:flex-row justify-center gap-8 lg:gap-16 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px] absolute items-center px-5 lg:px-8 py-24 [background:radial-gradient(125%_125%_at_50%_10%,#000_40%,#63e_100%)]">
      <StarrySky bortle={skyBortle} />
      <InfoCard open={aboutOpen} onClose={closeAbout} />
      <div className="w-full max-w-5xl lg:max-w-7xl py-8 px-4">
        <main className="flex flex-col justify-center text-center">
          {/* once a search starts, the hero header collapses to nothing and comes back as a glass
              topbar; reset reverses it. `initial={false}` skips the animation on first load */}
          <AnimatePresence mode="wait" initial={false}>
            {compactHeader ? (
              <motion.header
                key="topbar"
                initial={{ opacity: 0, y: -12 }}
                // title -> topbar is slow; topbar -> title (reset) is quicker
                animate={{ opacity: 1, y: 0, transition: { duration: 0.7, ease: 'easeOut' } }}
                exit={{ opacity: 0, y: -12, transition: { duration: 0.25, ease: 'easeIn' } }}
                // under the about modal (z-2000), over leaflet's map panes (up to z-1000)
                className="fixed inset-x-0 top-0 z-[1500] border-b border-white/10 bg-white/5 shadow-lg shadow-black/20 backdrop-blur-xl"
              >
                <div className="mx-auto flex max-w-5xl lg:max-w-7xl items-center justify-between gap-3 px-5 py-3 lg:px-12">
                  <span className="font-display text-2xl text-white tracking-tight">skygazer</span>
                  <div className="flex items-center gap-2">
                    <HeaderLinks onAbout={() => setAboutOpen(true)} compact />
                  </div>
                </div>
              </motion.header>
            ) : (
              <motion.div
                key="hero"
                initial={{ opacity: 0, height: 0 }}
                // on the way back the space opens first, then the title fades into it
                animate={{
                  opacity: 1,
                  height: 'auto',
                  transition: {
                    height: { duration: 0.4, ease: 'easeOut' },
                    opacity: { delay: 0.2, duration: 0.5, ease: 'easeOut' },
                  },
                }}
                exit={{ opacity: 0, height: 0, transition: { duration: 0.8, ease: 'easeInOut' } }}
                className="overflow-hidden"
              >
                <div className="pb-6">
                  <h1 className="text-6xl font-display text-white tracking-tight">skygazer</h1>
                  <p className="text-base mt-3 font-body">Find your perfect stargazing spot</p>
                  <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                    <HeaderLinks onAbout={() => setAboutOpen(true)} />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {!showMap && <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-gray-300 font-body text-sm mb-6">
              <p>Enter an address to find nearby spots with clear views and minimal light pollution.</p>
              {/* <p>Built using the Bortle Scale, the World Atlas of Artificial Night Sky Brightness, and OpenStreetMap</p> */}
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

          {/* map and ranked spots stack on phones and sit side by side from md up */}
          <div className="w-full max-w-3xl md:max-w-none mx-auto md:grid md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] md:items-start md:gap-6">
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
                  unit={unit}
                  besideHeight={columnHeight}
                />
              ) : loading && (
                <LoadingDivider key="loading" />
              )}
            </AnimatePresence>
            {/* the right column on md+: ranked spots with the light pollution info under them */}
            <div ref={columnRef} className="flex min-w-0 flex-col">
              <AnimatePresence mode="wait">
                {showMap && inputLocation && lightPollutionData && (
                  <SpotOptions
                    key={searchId}
                    options={lightPollutionData.options}
                    missing={lightPollutionData.missing}
                    maxKm={lightPollutionData.max_km}
                    range={range}
                    unit={unit}
                    selectedIndex={selectedOption}
                    loading={loading}
                    onSelect={setSelectedOption}
                    onRangeChange={handleRangeChange}
                    onUnitChange={handleUnitChange}
                  />
                )}
              </AnimatePresence>
              <AnimatePresence mode="wait">
                {showMap && inputLocation && lightPollutionData && (
                  <LightPollutionInfo key={searchId} data={lightPollutionData} spot={lightPollutionData.options[selectedOption]} />
                )}
              </AnimatePresence>
            </div>
          </div>

        </main>
      </div>
    </div>
  )
}