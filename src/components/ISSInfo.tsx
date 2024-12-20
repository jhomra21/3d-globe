import { Component, Show, createEffect } from 'solid-js';
import { ISSPosition } from '../types/iss';

interface ISSInfoProps {
  position: ISSPosition | null;
  show: boolean;
  onClose: () => void;
}

export const ISSInfo: Component<ISSInfoProps> = (props) => {
  let cardRef: HTMLDivElement | undefined;

  createEffect(() => {
    if (props.show && cardRef) {
      cardRef.style.transform = 'translate(-50%, 0)';
      cardRef.style.opacity = '1';
    } else if (cardRef) {
      cardRef.style.transform = 'translate(-50%, 20px)';
      cardRef.style.opacity = '0';
    }
  });

  const formatValue = (value: number, decimals: number = 4) => {
    return value.toFixed(decimals);
  };

  return (
    <Show when={props.position} fallback={null}>
      {(position) => (
        <div 
          ref={cardRef}
          class="fixed bottom-8 left-1/2 -translate-x-1/2 translate-y-5 opacity-0 bg-[rgba(28,28,28,0.6)] backdrop-blur-2xl text-white p-6 rounded-2xl shadow-2xl border border-[rgba(255,255,255,0.1)] font-mono transition-all duration-500 ease-out hover:bg-[rgba(28,28,28,0.7)] cursor-move"
          style={{
            'pointer-events': props.show ? 'auto' : 'none',
            'will-change': 'transform, opacity',
            'box-shadow': '0 8px 32px rgba(0, 0, 0, 0.4), inset 0 0 0 0.5px rgba(255, 255, 255, 0.1)',
            'backdrop-filter': 'blur(40px) saturate(180%)'
          }}
          draggable={true}
          onDragStart={(e) => {
            const rect = cardRef?.getBoundingClientRect();
            if (rect && e.dataTransfer) {
              e.dataTransfer.setData('text/plain', '');
              e.dataTransfer.effectAllowed = 'move';
            }
          }}
        >
          <div class="space-y-4">
            <div class="flex items-center gap-3">
              <svg class="w-7 h-7 animate-pulse" viewBox="0 0 110 92" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M50.6937 91.8267C78.1831 91.8267 100.387 71.2125 100.387 45.9133C100.387 20.6142 78.1831 0 50.6937 0C23.2043 0 1 20.6142 1 45.9133C1 71.2125 23.2043 91.8267 50.6937 91.8267Z" fill="#0B3D91"/>
                <path class="fill-white" d="M45.9873 16.9741L47.6473 22.5461L53.5396 22.5461L48.8751 26.0761L50.5351 31.6481L45.9873 28.1181L41.3228 31.6481L42.9828 26.0761L38.3183 22.5461L44.2106 22.5461L45.9873 16.9741Z"/>
                <path class="fill-white" d="M75.6733 30.9741L77.3333 36.5461L83.2256 36.5461L78.5611 40.0761L80.2211 45.6481L75.6733 42.1181L71.0088 45.6481L72.6688 40.0761L68.0043 36.5461L73.8966 36.5461L75.6733 30.9741Z"/>
                <path class="fill-white" d="M51.6733 44.9741L53.3333 50.5461L59.2256 50.5461L54.5611 54.0761L56.2211 59.6481L51.6733 56.1181L47.0088 59.6481L48.6688 54.0761L44.0043 50.5461L49.8966 50.5461L51.6733 44.9741Z"/>
                <path class="fill-white" d="M31.6733 37.9741L33.3333 43.5461L39.2256 43.5461L34.5611 47.0761L36.2211 52.6481L31.6733 49.1181L27.0088 52.6481L28.6688 47.0761L24.0043 43.5461L29.8966 43.5461L31.6733 37.9741Z"/>
              </svg>
              <div class="flex items-center justify-between w-full">
                <h2 class="text-xl font-light tracking-wide">ISS Telemetry</h2>
                <div class="flex items-center gap-1.5">
                  <div class="w-1.5 h-1.5 bg-green-400 rounded-full animate-[pulse_2s_ease-in-out_infinite]"></div>
                  <span class="text-[10px] text-green-400 uppercase tracking-wider font-medium">LIVE</span>
                </div>
              </div>
            </div>
            <p class="text-xs text-gray-400 tracking-wide font-medium">International Space Station</p>
            <div class="grid grid-cols-3 gap-4 py-2">
              <div class="transition-all duration-300 hover:bg-white/5 p-3 rounded-xl">
                <div class="text-[10px] uppercase tracking-wider text-gray-400 mb-1 font-medium">Latitude</div>
                <div class="text-sm font-light transition-all duration-300">
                  <span class="tabular-nums">{formatValue(position().latitude)}°</span>
                </div>
              </div>
              <div class="transition-all duration-300 hover:bg-white/5 p-3 rounded-xl">
                <div class="text-[10px] uppercase tracking-wider text-gray-400 mb-1 font-medium">Longitude</div>
                <div class="text-sm font-light transition-all duration-300">
                  <span class="tabular-nums">{formatValue(position().longitude)}°</span>
                </div>
              </div>
              <div class="transition-all duration-300 hover:bg-white/5 p-3 rounded-xl">
                <div class="text-[10px] uppercase tracking-wider text-gray-400 mb-1 font-medium">Altitude</div>
                <div class="text-sm font-light transition-all duration-300">
                  <span class="tabular-nums">{formatValue(position().altitude, 0)} km</span>
                </div>
              </div>
            </div>
            <div class="grid grid-cols-2 gap-4 pt-2 border-t border-white/10">
              <div class="transition-all duration-300 hover:bg-white/5 p-3 rounded-xl">
                <div class="text-[10px] uppercase tracking-wider text-gray-400 mb-1 font-medium">Orbital Speed</div>
                <div class="text-sm font-light">7.66 km/s</div>
              </div>
              <div class="transition-all duration-300 hover:bg-white/5 p-3 rounded-xl">
                <div class="text-[10px] uppercase tracking-wider text-gray-400 mb-1 font-medium">Orbit Period</div>
                <div class="text-sm font-light">92.68 min</div>
              </div>
            </div>
            <button
              onClick={props.onClose}
              class="w-full text-[10px] text-center text-gray-400 pt-2 hover:text-gray-300 transition-colors font-medium"
            >
              Click to close
            </button>
          </div>
        </div>
      )}
    </Show>
  );
}; 