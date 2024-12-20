export interface ISSPosition {
  latitude: number;
  longitude: number;
  altitude: number;
  velocity: number;
}

export interface ISSAPIResponse {
  iss_position: {
    latitude: string;
    longitude: string;
  };
  message: string;
  timestamp: number;
} 