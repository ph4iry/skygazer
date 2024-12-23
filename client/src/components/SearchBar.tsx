import { useRef, useEffect } from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';

interface SearchBarProps {
  onPlaceSelect: (place: google.maps.places.PlaceResult) => void;
  onReset: () => void;
  showMap: boolean;
  selectedPlace: google.maps.places.PlaceResult | null;
}

export default function SearchBar({ onPlaceSelect, onReset, showMap, selectedPlace }: SearchBarProps) {
  
  const placesLib = useMapsLibrary('places');
  
  const autoCompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  useEffect(() => {
    if (!placesLib) return;

    const input = document.getElementById('address-input') as HTMLInputElement;
    if (!input) return;

    const options = {
      componentRestrictions: { country: "us" },
      fields: ["address_components", "geometry", "name", "formatted_address"],
    };

    autoCompleteRef.current = new placesLib.Autocomplete(input, options);
    const listener = autoCompleteRef.current.addListener("place_changed", () => {
      const place = autoCompleteRef.current?.getPlace();
      if (place && place.geometry) {
        onPlaceSelect(place);
      }
    });

    return () => {
      if (listener) {
        listener.remove();
      }
      if (autoCompleteRef.current) {
        autoCompleteRef.current = null;
      }
    };
  }, [placesLib, onPlaceSelect]);

  return (
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
            onClick={onReset}
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
  );
}