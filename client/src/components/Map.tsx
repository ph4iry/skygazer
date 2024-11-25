import React, { useEffect, useRef } from 'react';

interface MapComponentProps {
  latitude?: number;
  longitude?: number;
  zoom?: number;
  onMapClick?: (event: google.maps.MouseEvent) => void;
  onMapLoad?: (map: google.maps.Map) => void;
}

interface GoogleMapWindow extends Window {
  google?: typeof google;
}

declare const window: GoogleMapWindow;

const MapComponent: React.FC<MapComponentProps> = ({
  latitude = 37.7749,
  longitude = -122.4194,
  zoom = 12,
  onMapClick,
  onMapLoad
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);

  useEffect(() => {
    // Load the Google Maps JavaScript API script
    const loadGoogleMapsScript = (): void => {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY}`;
      script.async = true;
      script.defer = true;
      script.addEventListener('load', initializeMap);
      document.head.appendChild(script);
    };

    // Initialize the map
    const initializeMap = (): void => {
      if (!mapRef.current || mapInstanceRef.current) return;

      const mapOptions: google.maps.MapOptions = {
        center: { lat: latitude, lng: longitude },
        zoom: zoom,
        mapTypeId: google.maps.MapTypeId.ROADMAP,
        mapTypeControl: true,
        streetViewControl: true,
        fullscreenControl: true,
      };

      const map = new google.maps.Map(mapRef.current, mapOptions);
      mapInstanceRef.current = map;

      // Add click event listener if callback provided
      if (onMapClick) {
        map.addListener('click', (event: google.maps.MouseEvent) => {
          onMapClick(event);
        });
      }

      // Call onMapLoad callback if provided
      if (onMapLoad) {
        onMapLoad(map);
      }

      // Add a marker at the specified location
      const marker = new google.maps.Marker({
        position: { lat: latitude, lng: longitude },
        map: map,
        animation: google.maps.Animation.DROP,
      });

      markersRef.current = [marker];
    };

    // Update map when coordinates change
    if (mapInstanceRef.current && window.google) {
      const center = new google.maps.LatLng(latitude, longitude);
      mapInstanceRef.current.setCenter(center);
      
      // Update marker position
      markersRef.current.forEach(marker => marker.setMap(null));
      
      const newMarker = new google.maps.Marker({
        position: { lat: latitude, lng: longitude },
        map: mapInstanceRef.current,
        animation: google.maps.Animation.DROP,
      });

      markersRef.current = [newMarker];
    } else {
      loadGoogleMapsScript();
    }

    // Cleanup
    return () => {
      if (markersRef.current) {
        markersRef.current.forEach(marker => marker.setMap(null));
      }
      const script = document.querySelector('script[src*="maps.googleapis.com/maps/api"]');
      if (script) {
        script.remove();
      }
    };
  }, [latitude, longitude, zoom, onMapClick, onMapLoad]);

  return (
    <div 
      ref={mapRef}
      style={{ 
        width: '100%', 
        height: '400px', 
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }} 
    />
  );
};

export default MapComponent;