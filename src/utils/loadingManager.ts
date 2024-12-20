import { createSignal } from 'solid-js';
import * as THREE from 'three';

export class LoadingManager {
  private manager: THREE.LoadingManager;
  private setProgress: (value: number) => void;
  private getProgress: () => number;
  private setIsLoading: (value: boolean) => void;
  private getIsLoading: () => boolean;
  private setError: (value: string | null) => void;
  private getError: () => string | null;
  private itemsTotal: number = 0;
  private itemsLoaded: number = 0;

  constructor() {
    const [progress, setProgress] = createSignal<number>(0);
    const [isLoading, setIsLoading] = createSignal<boolean>(true);
    const [error, setError] = createSignal<string | null>(null);

    this.getProgress = progress;
    this.setProgress = setProgress;
    this.getIsLoading = isLoading;
    this.setIsLoading = setIsLoading;
    this.getError = error;
    this.setError = setError;

    this.manager = new THREE.LoadingManager(
      // onLoad
      () => {
        console.log('Loading complete');
        this.setIsLoading(false);
        this.setError(null);
      },
      // onProgress
      (url, itemsLoaded, itemsTotal) => {
        console.log(`Loading file: ${url} (${itemsLoaded}/${itemsTotal})`);
        this.itemsLoaded = itemsLoaded;
        this.itemsTotal = itemsTotal;
        const progress = itemsTotal > 0 ? (itemsLoaded / itemsTotal) * 100 : 0;
        this.setProgress(progress);
      },
      // onError
      (url) => {
        console.error(`Error loading ${url}`);
        this.setError(`Failed to load ${url}`);
        this.setIsLoading(false);
      }
    );
  }

  public get progress(): number {
    return this.getProgress();
  }

  public get isLoading(): boolean {
    return this.getIsLoading();
  }

  public get error(): string | null {
    return this.getError();
  }

  public get instance(): THREE.LoadingManager {
    return this.manager;
  }

  public startLoading(): void {
    console.log('Starting loading process');
    this.itemsLoaded = 0;
    this.itemsTotal = 0;
    this.setIsLoading(true);
    this.setError(null);
    this.setProgress(0);
  }

  public setLoadingError(message: string): void {
    console.error('Loading error:', message);
    this.setError(message);
    this.setIsLoading(false);
  }

  public forceComplete(): void {
    console.log('Force completing loading');
    this.setIsLoading(false);
    this.setError(null);
    this.setProgress(100);
  }
} 