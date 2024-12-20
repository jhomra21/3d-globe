import { Component, lazy, Suspense } from 'solid-js';

const Globe = lazy(() => import('./components/Globe'));

const LoadingFallback = () => (
  <div class="w-screen h-screen bg-black flex items-center justify-center">
    <div class="flex flex-col items-center gap-4">
      <div class="w-10 h-10 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
      <div class="text-white/80 text-sm font-medium">Loading Globe...</div>
    </div>
  </div>
);

const App: Component = () => {
  return (
    <div class="w-screen h-screen bg-black">
      <Suspense fallback={<LoadingFallback />}>
        <Globe />
      </Suspense>
    </div>
  );
};

export default App; 