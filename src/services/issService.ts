import { ISSPosition } from '../types/iss';

const ISS_API_URL = 'https://api.open-notify.org/iss-now.json';

export class ISSService {
  private static instance: ISSService;
  private controller: AbortController | null = null;

  private constructor() {}

  public static getInstance(): ISSService {
    if (!ISSService.instance) {
      ISSService.instance = new ISSService();
    }
    return ISSService.instance;
  }

  public async getPosition(): Promise<ISSPosition> {
    try {
      // Cancel any existing request
      this.controller?.abort();
      this.controller = new AbortController();

      const response = await fetch(ISS_API_URL, {
        signal: this.controller.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (!data.iss_position) {
        throw new Error('Invalid response format from ISS API');
      }

      return {
        latitude: parseFloat(data.iss_position.latitude),
        longitude: parseFloat(data.iss_position.longitude),
        altitude: 408, // Average ISS altitude in km
        velocity: 7.66 // Average ISS velocity in km/s
      };
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error('Request was cancelled');
        }
        throw new Error(`Failed to fetch ISS position: ${error.message}`);
      }
      throw new Error('An unknown error occurred while fetching ISS position');
    }
  }

  public cancelRequest(): void {
    this.controller?.abort();
    this.controller = null;
  }

  public async startTracking(
    onUpdate: (position: ISSPosition) => void,
    onError: (error: Error) => void,
    interval: number = 3000
  ): Promise<() => void> {
    let isTracking = true;

    const track = async () => {
      while (isTracking) {
        try {
          const position = await this.getPosition();
          onUpdate(position);
          await new Promise(resolve => setTimeout(resolve, interval));
        } catch (error) {
          if (error instanceof Error) {
            onError(error);
          } else {
            onError(new Error('Unknown error occurred during tracking'));
          }
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, interval));
        }
      }
    };

    track();

    return () => {
      isTracking = false;
      this.cancelRequest();
    };
  }
} 