import { Component, ErrorBoundary as SolidErrorBoundary } from 'solid-js';

interface ErrorFallbackProps {
  error: Error;
  resetError: () => void;
}

const ErrorFallback: Component<ErrorFallbackProps> = (props) => {
  return (
    <div class="fixed inset-0 bg-black/90 flex items-center justify-center p-4">
      <div class="bg-black/50 p-8 rounded-2xl border border-red-500/20 max-w-2xl w-full space-y-6">
        <div class="text-red-500 flex items-start gap-4">
          <svg class="w-8 h-8 flex-shrink-0 mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <h2 class="text-xl font-semibold mb-2">Something went wrong</h2>
            <div class="space-y-2">
              <p class="text-red-400/80">{props.error.message}</p>
              <pre class="text-xs text-red-400/60 bg-red-500/5 p-4 rounded-lg overflow-auto">
                {props.error.stack}
              </pre>
            </div>
          </div>
        </div>
        <div class="flex justify-end gap-4">
          <button
            onClick={() => window.location.reload()}
            class="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-lg transition-colors"
          >
            Reload Page
          </button>
          <button
            onClick={() => props.resetError()}
            class="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 rounded-lg transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    </div>
  );
};

interface ErrorBoundaryProps {
  children: any;
  fallback?: Component<ErrorFallbackProps>;
}

export const ErrorBoundary: Component<ErrorBoundaryProps> = (props) => {
  return (
    <SolidErrorBoundary fallback={(error, reset) => {
      const Fallback = props.fallback || ErrorFallback;
      return <Fallback error={error} resetError={reset} />;
    }}>
      {props.children}
    </SolidErrorBoundary>
  );
}; 