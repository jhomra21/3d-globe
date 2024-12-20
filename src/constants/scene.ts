export const EARTH_RADIUS = 5;
export const EARTH_SEGMENTS = 128;
export const ISS_ORBIT_HEIGHT = 0.2; // Relative to Earth radius
export const MAX_TRAIL_LENGTH = 50;

export const CAMERA = {
  FOV: 75,
  NEAR: 0.1,
  FAR: 1000,
  MIN_DISTANCE: 7,
  MAX_DISTANCE: 25,
  INITIAL_POSITION_Z: 15
};

export const TEXTURES = {
  EARTH: 'https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg',
  TOPOLOGY: 'https://unpkg.com/three-globe/example/img/earth-topology.png',
  WATER: 'https://unpkg.com/three-globe/example/img/earth-water.png'
};

export const COLORS = {
  AMBIENT_LIGHT: 0x404040,
  SUN_LIGHT: 0xffffff,
  FILL_LIGHT: 0x404040,
  NIGHT_SIDE: 0x000033,
  ORBIT_LINE: 0x00ff88,
  ATMOSPHERE: {
    BASE: new Float32Array([0.3, 0.6, 1.0, 1.0])
  }
};

export const MATERIAL_PROPS = {
  EARTH: {
    BUMP_SCALE: 0.15,
    SHININESS: 50,
    SPECULAR: 0x888888
  },
  ATMOSPHERE: {
    OPACITY: 0.2
  },
  NIGHT_SIDE: {
    OPACITY: 0.4
  }
};

export const UPDATE_INTERVAL = 3000; // ms
export const STAR_COUNT = 4000; 