import { Component, onCleanup, onMount, createSignal, Show } from 'solid-js';
import * as THREE from 'three';
import { LoadingManager } from '../utils/loadingManager';
import { SceneManager } from '../utils/sceneManager';
import { useErrorHandler } from '../hooks/useErrorHandler';
import { LoadingOverlay } from './LoadingOverlay';
import { ErrorBoundary } from './ErrorBoundary';
import { ISSService } from '../services/issService';
import { ISSPosition } from '../types/iss';
import { ISSInfo } from './ISSInfo';
import { atmosphereVertexShader, atmosphereFragmentShader } from '../shaders/atmosphere';
import * as d3 from 'd3';
import { CountryData, COUNTRIES_GEOJSON_URL } from '../data/countryBorders';
import { EarthInfo } from './EarthInfo';

export const Globe: Component = () => {
  let containerRef: HTMLDivElement | undefined;
  let sceneManager: SceneManager | undefined;
  let issMarker: THREE.Group | undefined;
  let countryLines: THREE.Group | undefined;
  let orbitPoints: THREE.Vector3[] = [];
  let cleanupFunctions: (() => void)[] = [];
  const MAX_TRAIL_LENGTH = 100;
  const FUTURE_POINTS = 200;
  
  const loadingManager = new LoadingManager();
  const issService = ISSService.getInstance();
  const { error, handleError, clearError } = useErrorHandler();
  const [issPosition, setIssPosition] = createSignal<ISSPosition | null>(null);
  const [showInfo, setShowInfo] = createSignal(false);
  const [isSceneReady, setIsSceneReady] = createSignal(false);
  const [hoverPosition, setHoverPosition] = createSignal<{ x: number; y: number } | null>(null);
  const [currentCountry, setCurrentCountry] = createSignal<string>('');
  const [showEarthInfo, setShowEarthInfo] = createSignal(true);
  const [isCardExpanded, setIsCardExpanded] = createSignal(false);

  const getCardPosition = (x?: number, y?: number) => {
    if (!x || !y) return 'translate(-50%, -100%)';
    
    const margin = 20; // Minimum distance from screen edge
    const cardWidth = isCardExpanded() ? 320 : 200; // Approximate collapsed width
    const cardHeight = isCardExpanded() ? 300 : 100; // Approximate heights
    
    let transform = 'translate(-50%, -100%)';
    
    // Check horizontal bounds
    if (x - (cardWidth / 2) < margin) {
      transform = 'translate(0, -100%)';
    } else if (x + (cardWidth / 2) > window.innerWidth - margin) {
      transform = 'translate(-100%, -100%)';
    }
    
    // Check vertical bounds
    if (y - cardHeight < margin) {
      transform = transform.replace('-100%)', '0%)');
    }
    
    return transform;
  };

  const cleanupResources = () => {
    // Clean up all registered cleanup functions
    cleanupFunctions.forEach(fn => fn());
    cleanupFunctions = [];

    // Dispose of Three.js resources
    if (issMarker) {
      issMarker.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach(material => material.dispose());
          } else {
            child.material.dispose();
          }
        }
      });
    }

    // Clear orbit points
    orbitPoints = [];

    // Dispose scene manager
    if (sceneManager) {
      sceneManager.dispose();
      sceneManager = undefined;
    }
    issMarker = undefined;

    // Clean up country lines
    if (countryLines) {
      countryLines.traverse((child) => {
        if (child instanceof THREE.Line) {
          child.geometry.dispose();
          if (child.material instanceof THREE.Material) {
            child.material.dispose();
          }
        }
      });
      countryLines = undefined;
    }
  };

  const createISSModel = () => {
    const group = new THREE.Group();
    
    // Increase the invisible click target
    const clickTarget = new THREE.Mesh(
      new THREE.SphereGeometry(0.4), // Increased from typical 0.1-0.2
      new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide
      })
    );
    group.add(clickTarget);

    // Remove or comment out the orbit circle creation
    // const orbitGeometry = new THREE.RingGeometry(0.3, 0.31, 32);
    // const orbitMaterial = new THREE.MeshBasicMaterial({
    //   color: COLORS.ORBIT_LINE,
    //   side: THREE.DoubleSide,
    //   transparent: true,
    //   opacity: 0.5
    // });
    // const orbitCircle = new THREE.Mesh(orbitGeometry, orbitMaterial);
    // group.add(orbitCircle);

    // Refined materials with better visibility
    const bodyMaterial = new THREE.MeshPhongMaterial({ 
      color: 0xeeeeee, // Brighter color
      specular: 0x888888,
      shininess: 100,
      emissive: 0x444444,
      emissiveIntensity: 0.4
    });

    const solarPanelMaterial = new THREE.MeshPhongMaterial({
      color: 0x2266ff, // More vibrant blue
      specular: 0x666666,
      shininess: 120,
      emissive: 0x112244,
      emissiveIntensity: 0.5
    });

    // Brighter ISS light
    const issLight = new THREE.PointLight(0xffffff, 0.8, 2);
    issLight.position.set(0, 0, 0);
    group.add(issLight);

    // Main body - more detailed with segments
    const bodyGeometry = new THREE.CylinderGeometry(0.06, 0.06, 0.25, 12);
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.rotation.z = Math.PI / 2;
    group.add(body);

    // Add detail rings to the body
    const ring1 = new THREE.Mesh(
      new THREE.TorusGeometry(0.07, 0.01, 8, 24),
      bodyMaterial
    );
    ring1.rotation.y = Math.PI / 2;
    ring1.position.x = 0.1;
    body.add(ring1);

    const ring2 = ring1.clone();
    ring2.position.x = -0.1;
    body.add(ring2);

    // Solar panels with improved detail
    const createSolarPanel = (x: number) => {
      const panel = new THREE.Group();
      
      // Thinner panel base
      const baseGeometry = new THREE.BoxGeometry(0.5, 0.15, 0.005);
      const base = new THREE.Mesh(baseGeometry, solarPanelMaterial);
      
      // Add panel frame
      const frameGeometry = new THREE.BoxGeometry(0.52, 0.17, 0.01);
      const frameMaterial = new THREE.MeshPhongMaterial({
        color: 0x666666,
        specular: 0x222222,
        shininess: 60
      });
      const frame = new THREE.Mesh(frameGeometry, frameMaterial);
      frame.position.z = -0.005;
      
      // Solar cells with subtle detail
      const cellSize = 0.04;
      const cellGeometry = new THREE.BoxGeometry(cellSize, cellSize, 0.002);
      const cellMaterial = new THREE.MeshPhongMaterial({
        color: 0x1a4b8a,
        specular: 0x222222,
        shininess: 80,
        emissive: 0x112244,
        emissiveIntensity: 0.2
      });
      
      for (let i = 0; i < 10; i++) {
        for (let j = 0; j < 3; j++) {
          const cell = new THREE.Mesh(cellGeometry, cellMaterial);
          cell.position.set(
            (i - 4.5) * (cellSize + 0.002),
            (j - 1) * (cellSize + 0.002),
            0.004
          );
          base.add(cell);
        }
      }
      
      panel.add(frame);
      panel.add(base);
      panel.position.set(x, 0, 0);
      return panel;
    };

    group.add(createSolarPanel(-0.35));
    group.add(createSolarPanel(0.35));

    // Create corner box with refined appearance
    const createCornerBox = () => {
      const cornerGroup = new THREE.Group();
      const boxSize = { width: 1.3, height: 0.6, depth: 0.6 };
      const cornerLength = 0.12;
      const cornerPositions = [
        [-1, -1, 1], [1, -1, 1], [-1, 1, 1], [1, 1, 1],
        [-1, -1, -1], [1, -1, -1], [-1, 1, -1], [1, 1, -1]
      ];

      cornerPositions.forEach(([x, y, z]) => {
        const segments = createCornerSegments([x, y, z]);
        const corner = new THREE.Group();
        segments.forEach(segment => corner.add(segment));
        corner.position.set(
          (x * boxSize.width) / 2,
          (y * boxSize.height) / 2,
          (z * boxSize.depth) / 2
        );
        cornerGroup.add(corner);
      });

      cornerGroup.visible = false;
      cornerGroup.scale.multiplyScalar(0.3);
      return cornerGroup;
    };

    const cornerBox = createCornerBox();
    group.add(cornerBox);
    (group as any).cornerBox = cornerBox;

    // Subtle highlight ring
    const ringGeometry = new THREE.RingGeometry(0.3, 0.31, 48);
    const ringMaterial = new THREE.MeshBasicMaterial({ 
      color: 0x4facfe,
      transparent: true,
      opacity: 0.2,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending
    });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.rotation.x = Math.PI / 2;
    group.add(ring);

    // Refined glow effect for ISS
    const glowGeometry = new THREE.SphereGeometry(0.35, 32, 32);
    const glowVertexShader = `
      varying vec3 vNormal;
      varying vec3 vPosition;
      
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;

    const glowFragmentShader = `
      uniform vec3 color;
      varying vec3 vNormal;
      varying vec3 vPosition;
      
      void main() {
        float intensity = pow(0.6 - dot(vNormal, normalize(vPosition)), 2.0);
        gl_FragColor = vec4(color, 1.0) * intensity * 0.15;
      }
    `;

    const glowMaterial = new THREE.ShaderMaterial({
      uniforms: {
        color: { value: new THREE.Color(0x4facfe) }
      },
      vertexShader: glowVertexShader,
      fragmentShader: glowFragmentShader,
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide
    });

    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    glow.scale.multiplyScalar(1.1); // Slightly reduced glow size

    return group;
  };

  const validateGeometry = (geometry: THREE.BufferGeometry, context: string) => {
    const positions = geometry.getAttribute('position');
    if (!positions) {
      console.warn(`No position attribute in geometry: ${context}`);
      return false;
    }

    const array = positions.array;
    for (let i = 0; i < array.length; i++) {
      if (isNaN(array[i])) {
        console.warn(`Found NaN at index ${i} in geometry: ${context}`);
        return false;
      }
    }
    return true;
  };

  const createOrbitLine = () => {
    const group = new THREE.Group();
    
    // Past path line - neon tactical green
    const pastGeometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0)]);
    const pastMaterial = new THREE.LineBasicMaterial({
      color: 0x39ff14, // Neon tactical green
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending
    });
    const pastLine = new THREE.Line(pastGeometry, pastMaterial);
    
    // Future path line (dotted) - same color but more transparent
    const futureGeometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0)]);
    const futureMaterial = new THREE.LineDashedMaterial({
      color: 0x39ff14, // Matching neon tactical green
      transparent: true,
      opacity: 0.4,
      dashSize: 0.3,
      gapSize: 0.2,
      blending: THREE.AdditiveBlending
    });
    const futureLine = new THREE.Line(futureGeometry, futureMaterial);
    futureLine.computeLineDistances();
    
    group.add(pastLine);
    group.add(futureLine);
    
    return group;
  };

  const updateOrbitLine = (orbitGroup: THREE.Group, position: THREE.Vector3) => {
    // Validate position before adding to orbit points
    if (isNaN(position.x) || isNaN(position.y) || isNaN(position.z)) {
      console.warn('Invalid position detected:', position);
      return;
    }

    // Ensure orbitPoints is initialized
    if (!Array.isArray(orbitPoints)) {
      orbitPoints = [];
    }

    const newPoint = position.clone();
    orbitPoints.push(newPoint);
    
    if (orbitPoints.length > MAX_TRAIL_LENGTH) {
      orbitPoints.shift(); // Remove oldest point
    }

    // Filter out any invalid points
    const validPoints = orbitPoints.filter(p => 
      p && !isNaN(p.x) && !isNaN(p.y) && !isNaN(p.z)
    );

    if (validPoints.length === 0) {
      console.warn('No valid points for orbit line');
      return;
    }

    // Create future points by extrapolating the orbit with orbital mechanics
    const futurePoints: THREE.Vector3[] = [];
    if (validPoints.length >= 2) {
      const lastPoint = validPoints[validPoints.length - 1];
      const secondLastPoint = validPoints[validPoints.length - 2];
      
      // Calculate orbital parameters
      const velocity = new THREE.Vector3().subVectors(lastPoint, secondLastPoint);
      const orbitalPlaneNormal = new THREE.Vector3().crossVectors(lastPoint, velocity).normalize();
      const radius = lastPoint.length();
      
      // Create points along the orbital path
      for (let i = 1; i <= FUTURE_POINTS; i++) {
        // Calculate angle for this point (based on approximate ISS orbital period)
        const angle = (i / FUTURE_POINTS) * Math.PI / 2; // Show 1/4 of orbit ahead
        
        // Create rotation matrix for this point
        const rotationMatrix = new THREE.Matrix4();
        rotationMatrix.makeRotationAxis(orbitalPlaneNormal, angle);
        
        // Create the future point by rotating the current position
        const futurePoint = lastPoint.clone();
        futurePoint.applyMatrix4(rotationMatrix);
        
        // Ensure constant radius
        futurePoint.normalize().multiplyScalar(radius);
        futurePoints.push(futurePoint);
      }
    }

    // Update past line geometry
    const pastLine = orbitGroup.children[0] as THREE.Line;
    if (pastLine && pastLine.geometry) {
      pastLine.geometry.dispose();
      pastLine.geometry = new THREE.BufferGeometry().setFromPoints(validPoints);
    }

    // Update future line geometry
    const futureLine = orbitGroup.children[1] as THREE.Line;
    if (futureLine && futureLine.geometry) {
      futureLine.geometry.dispose();
      futureLine.geometry = new THREE.BufferGeometry().setFromPoints(futurePoints);
      (futureLine as THREE.Line).computeLineDistances(); // Required for dashed lines
    }
  };

  const createCornerSegments = (pos: number[]): THREE.Line[] => {
    const segments: THREE.Line[] = [];
    const [px, py, pz] = pos;
    const cornerLength = 0.15;
    
    const lines = [
      [[0, 0, 0], [cornerLength * px, 0, 0]],
      [[0, 0, 0], [0, cornerLength * py, 0]],
      [[0, 0, 0], [0, 0, cornerLength * pz]]
    ];

    lines.forEach(([[x1, y1, z1], [x2, y2, z2]]) => {
      const points = [
        new THREE.Vector3(x1, y1, z1),
        new THREE.Vector3(x2, y2, z2)
      ];
      
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      
      if (!validateGeometry(geometry, 'corner segment')) {
        console.error('Invalid corner segment geometry');
        return;
      }

      const material = new THREE.LineBasicMaterial({
        color: 0x4facfe,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending
      });
      
      segments.push(new THREE.Line(geometry, material));
    });
    
    return segments;
  };

  const setupInteractions = () => {
    if (!sceneManager || !issMarker || !containerRef) return;

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const onMouseMove = (event: MouseEvent) => {
      const rect = containerRef.getBoundingClientRect();
      if (!rect || !sceneManager || !issMarker) return;

      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, sceneManager.Camera);
      const intersects = raycaster.intersectObjects(issMarker.children, true);

      // Handle corner box visibility and animation
      const cornerBox = (issMarker as any).cornerBox;
      if (intersects.length > 0) {
        setHoverPosition({ x: event.clientX, y: event.clientY });
        containerRef.style.cursor = 'pointer';
        if (cornerBox) {
          cornerBox.visible = true;
          // Enhanced hover effects
          cornerBox.traverse((child: THREE.Object3D) => {
            if (child instanceof THREE.Line) {
              const material = child.material as THREE.LineBasicMaterial;
              material.opacity = 0.8;
            }
          });
          
          // Add slight hover animation to ISS model
          issMarker.scale.setScalar(1.1);
          issMarker.children.forEach((child: THREE.Object3D) => {
            if (child instanceof THREE.Mesh) {
              if (child.material instanceof THREE.MeshPhongMaterial) {
                child.material.emissiveIntensity *= 1.5;
              }
            }
          });
        }
      } else if (!isCardExpanded()) {
        // Only hide hover card if it's not expanded
        setHoverPosition(null);
        containerRef.style.cursor = 'grab';
        if (cornerBox) {
          cornerBox.traverse((child: THREE.Object3D) => {
            if (child instanceof THREE.Line) {
              (child.material as THREE.LineBasicMaterial).opacity = 0;
            }
          });
          cornerBox.visible = false;
          
          issMarker.scale.setScalar(1.0);
          issMarker.children.forEach((child: THREE.Object3D) => {
            if (child instanceof THREE.Mesh) {
              if (child.material instanceof THREE.MeshPhongMaterial) {
                child.material.emissiveIntensity /= 1.5;
              }
            }
          });
        }
      }
    };

    const onClick = (event: MouseEvent) => {
      const rect = containerRef.getBoundingClientRect();
      if (!rect || !sceneManager || !issMarker) return;

      // Check if we clicked on the info card or timezone panel
      const cardElement = containerRef.querySelector('.info-card');
      const timezonePanel = containerRef.querySelector('.timezone-panel');
      if (cardElement?.contains(event.target as Node) || 
          timezonePanel?.contains(event.target as Node)) {
        return; // Don't process globe clicks if we clicked the card or timezone panel
      }

      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, sceneManager.Camera);
      const intersects = raycaster.intersectObjects([issMarker], true);

      if (intersects.length > 0) {
        setIsCardExpanded(!isCardExpanded());
        setHoverPosition({ x: event.clientX, y: event.clientY });
      } else {
        // Close both cards when clicking on the globe
        setIsCardExpanded(false);
        setShowEarthInfo(false);
      }
    };

    const onMouseDown = () => {
      if (containerRef && !isCardExpanded()) {
        containerRef.style.cursor = 'grabbing';
      }
    };

    const onMouseUp = () => {
      if (containerRef && !isCardExpanded()) {
        containerRef.style.cursor = 'grab';
      }
    };

    // Add click handler to the document to close cards when clicking outside
    const onDocumentClick = (event: MouseEvent) => {
      const cardElement = containerRef.querySelector('.info-card');
      const timezonePanel = containerRef.querySelector('.timezone-panel');
      
      // Only close cards if we clicked outside both cards and not on the ISS
      if (!cardElement?.contains(event.target as Node) && 
          !timezonePanel?.contains(event.target as Node) &&
          !issMarker?.children.some(child => {
            const intersects = raycaster.intersectObject(child, true);
            return intersects.length > 0;
          })) {
        setIsCardExpanded(false);
        setShowEarthInfo(false);
      }
    };

    containerRef.addEventListener('mousemove', onMouseMove);
    containerRef.addEventListener('click', onClick);
    containerRef.addEventListener('mousedown', onMouseDown);
    containerRef.addEventListener('mouseup', onMouseUp);
    document.addEventListener('click', onDocumentClick);

    return () => {
      containerRef.removeEventListener('mousemove', onMouseMove);
      containerRef.removeEventListener('click', onClick);
      containerRef.removeEventListener('mousedown', onMouseDown);
      containerRef.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('click', onDocumentClick);
    };
  };

  const createStarField = () => {
    const starsGeometry = new THREE.BufferGeometry();
    const starsCount = 12000;
    const positions = new Float32Array(starsCount * 3);
    const colors = new Float32Array(starsCount * 3);
    const sizes = new Float32Array(starsCount);

    // Enhanced star colors
    const starColors = [
      new THREE.Color(0xffffff), // Pure white
      new THREE.Color(0xffffee), // Warm white
      new THREE.Color(0xeef6ff), // Cool white
      new THREE.Color(0x00a8ff), // Blue tint
      new THREE.Color(0xffeedd), // Warm tint
    ];

    for (let i = 0; i < starsCount; i++) {
      const i3 = i * 3;
      
      // Create stars in a larger sphere
      const radius = 50 + Math.random() * 250;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      positions[i3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i3 + 2] = radius * Math.cos(phi);

      // More varied star colors
      const color = starColors[Math.floor(Math.pow(Math.random(), 2) * starColors.length)];
      const brightness = 0.7 + Math.random() * 0.3;
      colors[i3] = color.r * brightness;
      colors[i3 + 1] = color.g * brightness;
      colors[i3 + 2] = color.b * brightness;

      // More varied star sizes
      sizes[i] = Math.pow(Math.random(), 2.5) * 2 + 0.1;
    }

    starsGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    starsGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    starsGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const starsMaterial = new THREE.PointsMaterial({
      size: 1,
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      fog: false,
      map: createStarTexture()
    });

    const stars = new THREE.Points(starsGeometry, starsMaterial);
    return stars;
  };

  const createStarTexture = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d')!;

    // Softer gradient for modern look
    const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.4, 'rgba(255, 255, 255, 0.4)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

    // Draw gradient
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 32, 32);

    const texture = new THREE.Texture(canvas);
    texture.needsUpdate = true;
    return texture;
  };

  let issRotation = 0;
  const rotationSpeed = 0.01;

  const loadTextures = async (manager: SceneManager) => {
    const textureUrls = {
      day: {
        primary: '/textures/earth/daymap.jpg',
        fallback: '/textures/earth/daymap.jpg'
      }
    };

    const loadTextureWithFallback = async (urls: { primary: string; fallback: string }, textureName: string) => {
      try {
        console.log(`Loading ${textureName} texture from: ${urls.primary}`);
        const texture = await manager.loadTexture(urls.primary);
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.colorSpace = THREE.SRGBColorSpace;
        console.log(`Successfully loaded ${textureName} texture`);
        return texture;
      } catch (error: any) {
        console.error(`Failed to load ${textureName} texture:`, error);
        throw new Error(`Failed to load ${textureName} texture: ${error?.message || 'Unknown error'}`);
      }
    };

    try {
      const [dayTexture] = await Promise.all([
        loadTextureWithFallback(textureUrls.day, 'day')
      ]);
      console.log('All textures loaded successfully');
      return [dayTexture, null, null, null, null];
    } catch (error: any) {
      console.error('Error loading textures:', error);
      throw error;
    }
  };

  const createCountryBorders = async () => {
    const response = await fetch(COUNTRIES_GEOJSON_URL);
    const geoJson: CountryData = await response.json();
    
    const group = new THREE.Group();
    
    // Create lines for each country
    geoJson.features.forEach(feature => {
      feature.geometry.coordinates.forEach(coords => {
        if (!coords || coords.length < 2) return; // Skip invalid coordinates
        
        const points: THREE.Vector3[] = [];
        
        coords.forEach(coord => {
          if (!Array.isArray(coord) || coord.length < 2) return; // Skip invalid coordinates
          
          const [lon, lat] = coord;
          if (typeof lon !== 'number' || typeof lat !== 'number' || isNaN(lon) || isNaN(lat)) return;
          
          const phi = (90 - lat) * (Math.PI / 180);
          const theta = (lon + 180) * (Math.PI / 180);
          const radius = 5.01; // Slightly above Earth's surface
          
          const x = -radius * Math.sin(phi) * Math.cos(theta);
          const y = radius * Math.cos(phi);
          const z = radius * Math.sin(phi) * Math.sin(theta);
          
          if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
            points.push(new THREE.Vector3(x, y, z));
          }
        });
        
        if (points.length < 2) return; // Skip if not enough valid points
        
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        
        // Validate geometry before creating the line
        if (!validateGeometry(geometry, 'country border')) {
          console.warn('Invalid country border geometry detected');
          return;
        }
        
        const material = new THREE.LineBasicMaterial({
          color: 0xffffff, // Changed to white
          transparent: true,
          opacity: 0.2, // Reduced opacity
          blending: THREE.AdditiveBlending
        });
        
        const line = new THREE.Line(geometry, material);
        group.add(line);
      });
    });
    
    return { group, geoJson };
  };

  const highlightCountry = (lat: number, lon: number, geoJson: CountryData) => {
    if (isNaN(lat) || isNaN(lon)) {
      console.warn('Invalid coordinates for country highlight:', { lat, lon });
      return;
    }

    const point: [number, number] = [lon, lat];
    
    // Find the country that contains this point
    const country = geoJson.features.find(feature => {
      try {
        return d3.geoContains(feature, point);
      } catch (error) {
        console.warn('Error in geoContains:', error);
        return false;
      }
    });
    
    if (country && countryLines) {
      // Reset all country lines to default color
      countryLines.traverse((object: THREE.Object3D) => {
        if (object instanceof THREE.Line) {
          (object.material as THREE.LineBasicMaterial).color.setHex(0xffffff);
          (object.material as THREE.LineBasicMaterial).opacity = 0.2;
        }
      });
      
      // Highlight the country under ISS
      country.geometry.coordinates.forEach((coords, index) => {
        if (!coords || !countryLines) return;
        
        const line = countryLines.children[index] as THREE.Line;
        if (line && line instanceof THREE.Line) {
          (line.material as THREE.LineBasicMaterial).color.setHex(0x4facfe);
          (line.material as THREE.LineBasicMaterial).opacity = 0.8;
        }
      });
      
      // Update country name display
      setCurrentCountry(country.properties.name || 'Unknown');
    }
  };

  const initScene = async () => {
    if (!containerRef) return;

    try {
      cleanupResources();
      loadingManager.startLoading();
      setIsSceneReady(false);
      sceneManager = new SceneManager(containerRef);

      // Create background
      const backgroundColor = new THREE.Color(0x000000);
      sceneManager.Scene.background = backgroundColor;

      // Add stars first
      console.log('Creating star field...');
      const stars = createStarField();
      sceneManager.addToScene(stars);

      // Load Earth textures
      console.log('Loading Earth textures...');
      if (!sceneManager) throw new Error('Scene manager not initialized');
      
      let earthDayTexture, earthNormalMap, earthSpecularMap, earthCloudTexture, earthNightTexture;
      try {
        [
          earthDayTexture,
          earthNormalMap,
          earthSpecularMap,
          earthCloudTexture,
          earthNightTexture
        ] = await loadTextures(sceneManager);
      } catch (error: any) {
        console.error('Failed to load textures:', error);
        throw new Error(`Texture loading failed: ${error?.message || 'Unknown error'}`);
      }

      // Enhance texture quality
      if (earthDayTexture) {
        earthDayTexture.anisotropy = sceneManager!.Renderer.capabilities.getMaxAnisotropy();
        earthDayTexture.colorSpace = THREE.SRGBColorSpace;
      }

      console.log('Creating Earth mesh...');
      // Create Earth
      const earthGeometry = new THREE.SphereGeometry(5, 256, 256);
      const earthMaterial = new THREE.MeshPhongMaterial({
        map: earthDayTexture,
        color: 0xffffff,
        shininess: 15
      });

      // Adjust lighting for better visibility
      const ambientLight = new THREE.AmbientLight(0x333333, 1);
      sceneManager.addToScene(ambientLight);

      // Main directional light (sun)
      const directionalLight = new THREE.DirectionalLight(0xffffff, 2.5);
      directionalLight.position.set(5, 3, 5);
      sceneManager.addToScene(directionalLight);

      // Subtle hemisphere light for better ambient illumination
      const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.8);
      sceneManager.addToScene(hemisphereLight);

      // Create Earth mesh
      const earthMesh = new THREE.Mesh(earthGeometry, earthMaterial);

      // Add Earth mesh to the scene
      sceneManager.addToScene(earthMesh);

      console.log('Creating ISS model...');
      issMarker = createISSModel();
      const orbitLine = createOrbitLine();
      sceneManager.addToScene(issMarker);
      sceneManager.addToScene(orbitLine);

      const removeClickHandler = setupInteractions();
      if (removeClickHandler) {
        cleanupFunctions.push(removeClickHandler);
      }

      console.log('Starting ISS tracking...');
      const { group: countryLinesGroup, geoJson } = await createCountryBorders();
      countryLines = countryLinesGroup;
      sceneManager.addToScene(countryLines);

      const stopTracking = await issService.startTracking(
        (position) => {
          setIssPosition(position);
          updateISSPosition(position, orbitLine);
          highlightCountry(position.latitude, position.longitude, geoJson);
        },
        handleError
      );
      cleanupFunctions.push(stopTracking);

      loadingManager.forceComplete();
      setIsSceneReady(true);

      console.log('Starting animation loop...');
      const stopAnimation = sceneManager.startAnimation(() => {
        if (issMarker) {
          issRotation += rotationSpeed;
          issMarker.rotation.y = issRotation;
        }
        
        if (stars) {
          stars.rotation.y += 0.0001;
        }
      });
      if (stopAnimation) {
        cleanupFunctions.push(stopAnimation);
      }

    } catch (e) {
      console.error('Error initializing scene:', e);
      handleError(e);
      loadingManager.setLoadingError(e instanceof Error ? e.message : 'Unknown error');
    }
  };

  const updateISSPosition = (position: ISSPosition, orbitLine: THREE.Group) => {
    if (!sceneManager || !issMarker) return;

    const phi = (90 - position.latitude) * (Math.PI / 180);
    const theta = (position.longitude + 180) * (Math.PI / 180);
    const radius = 5.2;

    const newPosition = new THREE.Vector3(
      -radius * Math.sin(phi) * Math.cos(theta),
      radius * Math.cos(phi),
      radius * Math.sin(phi) * Math.sin(theta)
    );

    // Validate new position
    if (isNaN(newPosition.x) || isNaN(newPosition.y) || isNaN(newPosition.z)) {
      console.warn('Invalid ISS position calculated:', { phi, theta, radius, newPosition });
      return;
    }

    issMarker.position.copy(newPosition);
    issMarker.lookAt(new THREE.Vector3(0, 0, 0));
    issMarker.rotateOnAxis(new THREE.Vector3(1, 0, 0), Math.PI / 2);
    issMarker.rotation.y = issRotation;

    updateOrbitLine(orbitLine, newPosition);
  };

  const handleRetry = () => {
    clearError();
    initScene();
  };

  onMount(() => {
    initScene().catch(handleError);
  });

  onCleanup(cleanupResources);

  // Add particle trail behind ISS
  const createISSParticles = () => {
    const particlesGeometry = new THREE.BufferGeometry();
    const particleCount = 100;
    const positions = new Float32Array(particleCount * 3);
    const alphas = new Float32Array(particleCount);
    
    particlesGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particlesGeometry.setAttribute('alpha', new THREE.BufferAttribute(alphas, 1));
    
    const particlesMaterial = new THREE.PointsMaterial({
      color: 0x4facfe,
      size: 0.05,
      transparent: true,
      blending: THREE.AdditiveBlending
    });
    
    return new THREE.Points(particlesGeometry, particlesMaterial);
  };

  return (
    <ErrorBoundary>
      <div ref={containerRef} class="relative w-full h-full">
        <div class="fixed top-8 left-1/2 transform -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-2.5 bg-[rgba(20,20,20,0.95)] backdrop-blur-2xl rounded-full border border-white/10 shadow-2xl">
          <div class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-lg shadow-emerald-500/50"></div>
          <span class="text-white/90 font-medium tracking-wide text-sm">ISS Tracker</span>
        </div>

        <div 
          class="absolute inset-0 transition-opacity duration-1000"
          classList={{
            'opacity-0': !isSceneReady(),
            'opacity-100': isSceneReady()
          }}
        />
        <LoadingOverlay
          isLoading={loadingManager.isLoading}
          progress={loadingManager.progress}
          error={error()?.message || null}
          onRetry={handleRetry}
        />
        <Show when={isSceneReady()}>
          <Show when={hoverPosition() && issPosition()}>
            <div
              class="fixed pointer-events-auto bg-[rgba(20,20,20,0.95)] backdrop-blur-2xl text-white px-5 py-4 rounded-xl text-sm border border-white/10 shadow-2xl transition-all duration-500 ease-in-out flex flex-col gap-3 select-none info-card"
              style={{
                left: `${hoverPosition()?.x || 0}px`,
                top: `${(hoverPosition()?.y || 0) - 40}px`,
                transform: getCardPosition(hoverPosition()?.x, hoverPosition()?.y),
                'backdrop-filter': 'blur(16px) saturate(180%)',
                width: isCardExpanded() ? '320px' : 'auto',
                cursor: 'pointer'
              }}
              ref={(el) => {
                // Ensure card stays within viewport bounds
                if (el) {
                  const rect = el.getBoundingClientRect();
                  const viewportWidth = window.innerWidth;
                  const viewportHeight = window.innerHeight;
                  
                  if (rect.right > viewportWidth) {
                    el.style.left = `${viewportWidth - rect.width - 20}px`;
                    el.style.transform = 'none';
                  }
                  if (rect.left < 0) {
                    el.style.left = '20px';
                    el.style.transform = 'none';
                  }
                  if (rect.top < 0) {
                    el.style.top = '20px';
                    el.style.transform = 'none';
                  }
                  if (rect.bottom > viewportHeight) {
                    el.style.top = `${viewportHeight - rect.height - 20}px`;
                    el.style.transform = 'none';
                  }
                }
              }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsCardExpanded(!isCardExpanded());
              }}
            >
              <div class="flex items-center gap-2.5">
                <div class="w-2 h-2 rounded-full bg-blue-500 animate-pulse shadow-lg shadow-blue-500/50"></div>
                <span class="font-medium tracking-wide">International Space Station</span>
              </div>
              
              <div class="text-white/80 text-xs flex flex-col gap-1.5 font-light">
                <div class="flex items-center gap-1">
                  <svg class="w-3 h-3 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                  <span>Altitude: {issPosition()?.altitude.toFixed(1)} km</span>
                </div>
                <div class="flex items-center gap-1">
                  <svg class="w-3 h-3 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span>Speed: {issPosition()?.velocity.toFixed(1)} km/s</span>
                </div>
              </div>

              <div 
                class="overflow-hidden transition-all duration-500 ease-in-out"
                style={{
                  'max-height': isCardExpanded() ? '500px' : '0px',
                  opacity: isCardExpanded() ? '1' : '0'
                }}
              >
                <div class="mt-2 space-y-4 border-t border-white/10 pt-4">
                  <div class="grid grid-cols-2 gap-6">
                    <div class="space-y-1.5">
                      <div class="text-[10px] uppercase tracking-wider text-emerald-400/90 font-medium">Latitude</div>
                      <div class="font-mono text-sm tabular-nums text-white/90 transition-all duration-500">
                        {issPosition()?.latitude.toFixed(4)}°
                      </div>
                    </div>
                    <div class="space-y-1.5">
                      <div class="text-[10px] uppercase tracking-wider text-violet-400/90 font-medium">Longitude</div>
                      <div class="font-mono text-sm tabular-nums text-white/90 transition-all duration-500">
                        {issPosition()?.longitude.toFixed(4)}°
                      </div>
                    </div>
                  </div>

                  <div class="grid grid-cols-2 gap-6">
                    <div class="space-y-1.5">
                      <div class="text-[10px] uppercase tracking-wider text-amber-400/90 font-medium">Current Location</div>
                      <div class="font-light text-white/90 transition-all duration-500 blur-[0.2px]">
                        {currentCountry() || 'Over Ocean'}
                      </div>
                    </div>
                    <div class="space-y-1.5">
                      <div class="text-[10px] uppercase tracking-wider text-rose-400/90 font-medium">Orbital Period</div>
                      <div class="font-light text-white/90">~92 minutes</div>
                    </div>
                  </div>
                </div>
              </div>

              <div 
                class="mt-1 flex items-center gap-2 text-xs text-blue-400/90 transition-opacity duration-300"
                style={{ opacity: isCardExpanded() ? '0' : '1' }}
              >
                <svg class="w-4 h-4 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                </svg>
                <span class="font-medium">Click for more details</span>
              </div>
            </div>
          </Show>
          <EarthInfo
            show={showEarthInfo()}
            onClose={() => setShowEarthInfo(false)}
          />
        </Show>
        <Show when={issPosition()}>
          <div class="fixed bottom-8 left-1/2 transform -translate-x-1/2 bg-[rgba(28,28,28,0.8)] backdrop-blur-xl text-white px-4 py-2 rounded-lg text-sm font-medium border border-white/10 shadow-xl select-none pointer-events-none">
            ISS is currently above: {currentCountry() || 'Earth'}
          </div>
        </Show>
      </div>
    </ErrorBoundary>
  );
}; 