import { AdvancedMarker, AdvancedMarkerAnchorPoint, Map } from '@vis.gl/react-google-maps';
import { Location } from '../types';
import { IoTelescope } from 'react-icons/io5';
import { FaHouse } from "react-icons/fa6";
import { motion } from 'motion/react';

interface GMapProps {
  inputLocation: Location;
  idealLocation: Location;
}

export default function GoogleMap({ inputLocation, idealLocation }: GMapProps) {
  const center = {
    lat: (inputLocation.lat + idealLocation.lat) / 2,
    lng: (inputLocation.lng + idealLocation.lng) / 2,
  };

  return (
    <motion.div initial={{ minHeight: 0, opacity: 0, height: 0 }} animate={{ minHeight: '10rem', height: '15rem', opacity: 1 }} exit={{ opacity: 0, minHeight: 0, height: 0 }} className="w-full max-w-3xl mx-auto rounded-xl overflow-hidden">
      <Map
        defaultZoom={8}
        defaultCenter={center}
        fullscreenControl
        zoomControl
        mapId={process.env.NEXT_PUBLIC_GOOGLE_MAP_ID!}
        className="w-full h-full"
      >
        <AdvancedMarker position={inputLocation} anchorPoint={AdvancedMarkerAnchorPoint.CENTER}>
          <div className="p-1 rounded-full bg-blue-500 text-white">
            <FaHouse className="size-5" />
          </div>
        </AdvancedMarker>
        <AdvancedMarker position={idealLocation} anchorPoint={AdvancedMarkerAnchorPoint.CENTER}>
          <div className="p-1 rounded-full bg-blue-500 text-white">
            <IoTelescope className="size-5" />
          </div>
        </AdvancedMarker>
      </Map>
    </motion.div>
  )
}