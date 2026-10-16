export interface Location {
  lat: number;
  lng: number;
}

// a public place the spot was moved to (name set), or just a "near ..." label (name null)
export interface Place {
  name: string | null;
  label: string;
  type: string | null;
}

export interface Spot {
  bortle: string;
  latitude: number;
  longitude: number;
  distance: number;
  place: Place | null;
}

// one choice on the darker-but-farther vs closer-but-brighter list
export interface SpotOption extends Spot {
  recommended: boolean;
  // still waiting on /place to move it to a park
  snapping?: boolean;
}

export interface LightPollutionData extends Spot {
  unit: 'mi' | 'km';
  options: SpotOption[];
  // darkness levels with nothing within max_km
  missing: string[];
  max_km: number;
  input: {
    latitude: number;
    longitude: number;
    bortle: number;
  };
}

export interface Suggestion {
  label: string;
  lat: number;
  lon: number;
}
