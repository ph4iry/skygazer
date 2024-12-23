export interface Location {
  lat: number;
  lng: number;
}

export interface LightPollutionData {
  bortle: number | string;
  latitude: number;
  longitude: number;
  distance: number;
  unit: 'mi' | 'km';
  input: {
    latitude: number;
    longitude: number;
    bortle: number;
  };
}