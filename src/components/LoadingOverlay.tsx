import { Component, Show } from 'solid-js';

interface LoadingOverlayProps {
  isLoading: boolean;
  progress: number;
  error: string | null;
  onRetry?: () => void;
}

export const LoadingOverlay: Component<LoadingOverlayProps> = (props) => {
  return (
    <Show when={props.isLoading || props.error}>
      <div class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
        <div class="bg-black/50 p-8 rounded-2xl border border-white/10 max-w-md w-full mx-4">
          <Show
            when={!props.error}
            fallback={
              <div class="space-y-4">
                <div class="text-red-500 text-center">
                  <svg class="w-12 h-12 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <h3 class="text-xl font-medium mb-2">Error Loading</h3>
                  <p class="text-red-400/80">{props.error}</p>
                </div>
                <Show when={props.onRetry}>
                  <button
                    onClick={() => props.onRetry?.()}
                    class="w-full py-2 px-4 bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 rounded-lg transition-colors"
                  >
                    Retry
                  </button>
                </Show>
              </div>
            }
          >
            <div class="space-y-4">
              <div class="flex justify-center mb-4">
                <div class="w-12 h-12 border-4 border-white/20 border-t-white/80 rounded-full animate-spin" />
              </div>
              <div class="space-y-2">
                <div class="h-2 bg-white/20 rounded-full overflow-hidden">
                  <div 
                    class="h-full bg-white/80 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${props.progress}%` }}
                  />
                </div>
                <div class="text-center space-y-1">
                  <p class="text-white/60 text-sm">
                    Loading... {Math.round(props.progress)}%
                  </p>
                  <p class="text-white/40 text-xs">
                    {props.progress === 0 ? 'Initializing...' :
                     props.progress < 33 ? 'Loading Earth textures...' :
                     props.progress < 66 ? 'Creating 3D models...' :
                     props.progress < 100 ? 'Setting up scene...' :
                     'Almost ready...'}
                  </p>
                </div>
              </div>
            </div>
          </Show>
        </div>
      </div>
    </Show>
  );
}; 