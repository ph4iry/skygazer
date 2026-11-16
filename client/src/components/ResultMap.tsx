import { MapContainer, Marker, TileLayer, useMap } from 'react-leaflet';
import { divIcon, DivIcon, latLngBounds, LatLngBounds } from 'leaflet';
import { renderToStaticMarkup } from 'react-dom/server';
import { ReactNode, useEffect, useMemo, useSyncExternalStore } from 'react';
import { Location, SpotOption } from '../types';
import { skyAccent } from '@/utils/bortle';
import { DistanceUnit, formatDistance } from '@/utils/units';
import { IoTelescope } from 'react-icons/io5';
import { FaHouse } from "react-icons/fa6";
import { motion } from 'motion/react';
import 'leaflet/dist/leaflet.css';

interface ResultMapProps {
  inputLocation: Location;
  options: SpotOption[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  unit: DistanceUnit;
  // height of the column beside the map on md+, so the map can grow to match it
  besideHeight?: number | null;
}

const MIN_HEIGHT_PX = 400; // 25rem
// md: the breakpoint where the map and the ranked spots sit side by side
const WIDE_QUERY = '(min-width: 768px)';

function subscribeToWidth(onChange: () => void) {
  const media = window.matchMedia(WIDE_QUERY);
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}

function useWideLayout() {
  return useSyncExternalStore(subscribeToWidth, () => window.matchMedia(WIDE_QUERY).matches, () => false);
}

function markerIcon(icon: ReactNode) {
  return divIcon({
    html: renderToStaticMarkup(
      <div className="p-1 rounded-full bg-blue-500 text-white">{icon}</div>
    ),
    className: '',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

const homeIcon = markerIcon(<FaHouse className="size-5" />);

// stargazing spots are telescopes in their bortle accent color: full size when selected,
// smaller otherwise. Icons are built once per class and size and reused across renders.
const spotIcons = new Map<string, DivIcon>();

function spotIcon(bortle: string, selected: boolean) {
  const key = `${bortle}-${selected}`;
  let icon = spotIcons.get(key);
  if (!icon) {
    const { color, ink } = skyAccent(bortle);
    const size = selected ? 32 : 22;
    icon = divIcon({
      html: renderToStaticMarkup(
        <div
          className="flex items-center justify-center rounded-full"
          // the white border and shadow keep the darkest accent visible on dark map areas
          style={{ width: size, height: size, backgroundColor: color, color: ink, border: '2px solid #fff', boxShadow: '0 1px 4px rgba(0, 0, 0, 0.45)' }}
        >
          <IoTelescope style={{ width: size * 0.55, height: size * 0.55 }} />
        </div>
      ),
      className: '',
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
    });
    spotIcons.set(key, icon);
  }
  return icon;
}

const FIT_OPTIONS = { padding: [40, 40] as [number, number], maxZoom: 10 };

// the container grows from 0 height while it animates in, so refit once it has a real size
function FitBounds({ bounds }: { bounds: LatLngBounds }) {
  const map = useMap();

  useEffect(() => {
    const observer = new ResizeObserver(() => {
      map.invalidateSize();
      // no zoom animation: overlapping animated fits during the resize leave the map at the wrong zoom
      map.fitBounds(bounds, { ...FIT_OPTIONS, animate: false });
    });
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map, bounds]);

  return null;
}

export default function ResultMap({ inputLocation, options, selectedIndex, onSelect, unit, besideHeight }: ResultMapProps) {
  // side by side, the map stretches to the column next to it so there's no empty space under it;
  // stacked on phones it keeps a fixed height
  const wide = useWideLayout();
  const height = wide && besideHeight ? Math.max(besideHeight, MIN_HEIGHT_PX) : MIN_HEIGHT_PX;
  const selected = options[selectedIndex];
  const idealLocation = { lat: selected.latitude, lng: selected.longitude };

  // depend on the numbers, not the objects, which are recreated on every render
  const { lat: homeLat, lng: homeLng } = inputLocation;
  const { lat: idealLat, lng: idealLng } = idealLocation;
  const bounds = useMemo(
    () => latLngBounds([[homeLat, homeLng], [idealLat, idealLng]]),
    [homeLat, homeLng, idealLat, idealLng],
  );

  return (
    <motion.div initial={{ minHeight: 0, opacity: 0, height: 0 }} animate={{ minHeight: '10rem', height, opacity: 1 }} exit={{ opacity: 0, minHeight: 0, height: 0 }} className="w-full max-w-3xl mx-auto rounded-xl overflow-hidden">
      <MapContainer
        bounds={bounds}
        boundsOptions={FIT_OPTIONS}
        scrollWheelZoom={false}
        className="w-full h-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={inputLocation} icon={homeIcon} />
        {options.map((option, i) => i !== selectedIndex && (
          <Marker
            key={`${option.bortle}-${i}`}
            position={{ lat: option.latitude, lng: option.longitude }}
            icon={spotIcon(option.bortle, false)}
            title={`Bortle ${option.bortle}, ${formatDistance(option.distance, unit)}`}
            eventHandlers={{ click: () => onSelect(i) }}
          />
        ))}
        <Marker position={idealLocation} icon={spotIcon(selected.bortle, true)} zIndexOffset={1000} />
        <FitBounds bounds={bounds} />
      </MapContainer>
    </motion.div>
  )
}
