import { Component, onCleanup, onMount, createSignal, Show } from 'solid-js';
import * as THREE from 'three';
import * as d3 from 'd3';

// Components
import { EarthInfo, LoadingOverlay, ErrorBoundary } from './';

// Services and Utils
import { LoadingManager } from '../utils/loadingManager';
import { SceneManager } from '../utils/sceneManager';
import { ISSService } from '../services/issService';

// Hooks
import { useErrorHandler } from '../hooks/useErrorHandler';

// Models
import { ISSModel } from '../models/ISSModel';

// Types and Data
import { ISSPosition } from '../types/iss';
import { CountryData, COUNTRIES_GEOJSON_URL } from '../data/countryBorders';

const Globe: Component = () => {
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
    const [isSceneReady, setIsSceneReady] = createSignal(false);
    const [hoverPosition, setHoverPosition] = createSignal<{ x: number; y: number } | null>(null);
    const [currentCountry, setCurrentCountry] = createSignal<string>('Earth');
    const [showEarthInfo, setShowEarthInfo] = createSignal(true);
    const [isCardExpanded, setIsCardExpanded] = createSignal(false);

    interface CardPosition {
        transform: string;
        x: number;
        y: number;
    }

    const getCardPosition = (x?: number, y?: number): CardPosition => {
        if (!x || !y) return {
            transform: 'translate(-50%, -100%)',
            x: 0,
            y: 0
        };

        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const cardWidth = 280; // Maximum card width
        const cardHeight = 400; // Maximum card height
        const margin = 16; // Minimum distance from screen edge

        let transform = '';
        let finalX = x;
        let finalY = y;

        // Horizontal positioning
        if (x + cardWidth / 2 > viewportWidth - margin) {
            // Too close to right edge
            transform = 'translate(-100%, -50%)';
            finalX = viewportWidth - margin;
        } else if (x - cardWidth / 2 < margin) {
            // Too close to left edge
            transform = 'translate(0, -50%)';
            finalX = margin;
        } else {
            // Center horizontally
            transform = 'translate(-50%, -50%)';
        }

        // Vertical positioning
        if (y - cardHeight / 2 < margin) {
            // Too close to top
            finalY = cardHeight / 2 + margin;
        } else if (y + cardHeight / 2 > viewportHeight - margin - 60) {
            // Too close to bottom (accounting for bottom badge)
            finalY = viewportHeight - cardHeight / 2 - margin - 60;
        }

        return { transform, x: finalX, y: finalY };
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

    const validateGeometry = (geometry: THREE.BufferGeometry, context: string) => {
        const positions = geometry.getAttribute('position');
        if (!positions) {
            return false;
        }

        const array = positions.array;
        for (let i = 0; i < array.length; i++) {
            if (isNaN(array[i])) {
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



    const setupInteractions = () => {
        if (!sceneManager || !issMarker || !containerRef) return;

        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2();
        const isMobile = window.matchMedia('(max-width: 768px)').matches;

        // Increase raycaster threshold for mobile
        if (isMobile) {
            raycaster.params.Line!.threshold = 0.1;
            raycaster.params.Points!.threshold = 0.1;
        }

        const handlePointerMove = (event: MouseEvent | TouchEvent) => {
            const rect = containerRef.getBoundingClientRect();
            if (!rect || !sceneManager || !issMarker) return;

            // Get coordinates for both mouse and touch events
            const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX;
            const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY;

            mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
            mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;

            raycaster.setFromCamera(mouse, sceneManager.Camera);
            const intersects = raycaster.intersectObjects(issMarker.children, true);

            // Handle corner box visibility and animation
            const cornerBox = (issMarker as any).cornerBox;
            if (intersects.length > 0) {
                setHoverPosition({ x: clientX, y: clientY });
                if (!isMobile) {
                    containerRef.style.cursor = 'pointer';
                }
                if (cornerBox) {
                    cornerBox.visible = true;
                    cornerBox.traverse((child: THREE.Object3D) => {
                        if (child instanceof THREE.Line) {
                            const material = child.material as THREE.LineBasicMaterial;
                            material.opacity = 0.8;
                        }
                    });

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
                setHoverPosition(null);
                if (!isMobile) {
                    containerRef.style.cursor = 'grab';
                }
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

        const handlePointerUp = (event: MouseEvent | TouchEvent) => {
            const rect = containerRef.getBoundingClientRect();
            if (!rect || !sceneManager || !issMarker) return;

            // Prevent default touch behavior
            if ('touches' in event) {
                event.preventDefault();
            }

            // Get coordinates for both mouse and touch events
            const clientX = 'changedTouches' in event ? event.changedTouches[0].clientX : event.clientX;
            const clientY = 'changedTouches' in event ? event.changedTouches[0].clientY : event.clientY;

            // Check if we clicked on the info card or timezone panel
            const cardElement = containerRef.querySelector('.info-card');
            const timezonePanel = containerRef.querySelector('.timezone-panel');
            if (cardElement?.contains(event.target as Node) ||
                timezonePanel?.contains(event.target as Node)) {
                return;
            }

            mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
            mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;

            raycaster.setFromCamera(mouse, sceneManager.Camera);
            const intersects = raycaster.intersectObjects([issMarker], true);

            if (intersects.length > 0) {
                setIsCardExpanded(!isCardExpanded());
                setHoverPosition({ x: clientX, y: clientY });
            } else {
                setIsCardExpanded(false);
                setShowEarthInfo(false);
            }
        };

        // Add event listeners for both mouse and touch events
        containerRef.addEventListener('mousemove', handlePointerMove);
        containerRef.addEventListener('touchmove', handlePointerMove, { passive: false });
        containerRef.addEventListener('mouseup', handlePointerUp);
        containerRef.addEventListener('touchend', handlePointerUp, { passive: false });

        // Add click handler to the document to close cards when clicking outside
        const onDocumentClick = (event: MouseEvent | TouchEvent) => {
            const cardElement = containerRef.querySelector('.info-card');
            const timezonePanel = containerRef.querySelector('.timezone-panel');

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

        document.addEventListener('click', onDocumentClick);
        document.addEventListener('touchend', onDocumentClick);

        return () => {
            containerRef.removeEventListener('mousemove', handlePointerMove);
            containerRef.removeEventListener('touchmove', handlePointerMove);
            containerRef.removeEventListener('mouseup', handlePointerUp);
            containerRef.removeEventListener('touchend', handlePointerUp);
            document.removeEventListener('click', onDocumentClick);
            document.removeEventListener('touchend', onDocumentClick);
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
    let glowPulse = 0;
    const glowSpeed = 0.03;

    const loadTextures = async (manager: SceneManager) => {
        const textureUrls = {
            day: {
                primary: '/textures/earth/daymap.jpg',
                fallback: '/textures/earth/daymap.jpg'
            }
        };

        const loadTextureWithFallback = async (urls: { primary: string; fallback: string }, textureName: string) => {
            try {
                const texture = await manager.loadTexture(urls.primary);
                texture.minFilter = THREE.LinearFilter;
                texture.magFilter = THREE.LinearFilter;
                texture.colorSpace = THREE.SRGBColorSpace;
                return texture;
            } catch (error: any) {
                throw new Error(`Failed to load ${textureName} texture: ${error?.message || 'Unknown error'}`);
            }
        };

        try {
            const [dayTexture] = await Promise.all([
                loadTextureWithFallback(textureUrls.day, 'day')
            ]);
            return [dayTexture, null, null, null, null];
        } catch (error: any) {
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
            setCurrentCountry('Over Ocean');
            return;
        }

        const point: [number, number] = [lon, lat];

        // Find the country that contains this point
        const country = geoJson.features.find(feature => {
            try {
                return d3.geoContains(feature, point);
            } catch (error) {
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
            setCurrentCountry(country.properties.name || 'Over Ocean');
        } else {
            setCurrentCountry('Over Ocean');
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
            const stars = createStarField();
            sceneManager.addToScene(stars);

            // Load Earth textures
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
                throw new Error(`Texture loading failed: ${error?.message || 'Unknown error'}`);
            }

            // Enhance texture quality
            if (earthDayTexture) {
                earthDayTexture.anisotropy = sceneManager!.Renderer.capabilities.getMaxAnisotropy();
                earthDayTexture.colorSpace = THREE.SRGBColorSpace;
            }

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

            issMarker = ISSModel.create();
            const orbitLine = createOrbitLine();
            sceneManager.addToScene(issMarker);
            sceneManager.addToScene(orbitLine);

            const removeClickHandler = setupInteractions();
            if (removeClickHandler) {
                cleanupFunctions.push(removeClickHandler);
            }

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

            const stopAnimation = sceneManager.startAnimation(() => {
                if (issMarker) {
                    issRotation += rotationSpeed;
                    issMarker.rotation.y = issRotation;

                    // Animate glow effect
                    glowPulse += glowSpeed;
                    const glowOpacity = 0.3 + Math.sin(glowPulse) * 0.2;
                    const ringOpacity = 0.15 + Math.sin(glowPulse) * 0.1;

                    // Update glow materials
                    issMarker.children.forEach((child) => {
                        if (child instanceof THREE.Mesh) {
                            const material = child.material as THREE.MeshBasicMaterial;
                            if (material.opacity !== undefined) {
                                if (child.geometry instanceof THREE.CircleGeometry) {
                                    material.opacity = glowOpacity;
                                } else if (child.geometry instanceof THREE.RingGeometry) {
                                    material.opacity = ringOpacity;
                                }
                            }
                        }
                    });
                }

                if (stars) {
                    stars.rotation.y += 0.0001;
                }
            });
            if (stopAnimation) {
                cleanupFunctions.push(stopAnimation);
            }

        } catch (e) {
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

    return (
        <ErrorBoundary>
            <div ref={containerRef} class="relative w-full h-full">
                <div class="fixed top-8 left-1/2 transform -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-2.5 bg-[rgba(20,20,20,0.66)] backdrop-blur-xl rounded-full border border-white/10 shadow-2xl">
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
                            class="fixed pointer-events-auto bg-[rgba(20,20,20,0.66)] backdrop-blur-xl text-white px-2.5 py-2 rounded-lg text-xs border border-white/10 shadow-2xl transition-all duration-300 ease-out flex flex-col gap-1 select-none info-card hover:bg-[rgba(25,25,25,0.98)]"
                            style={{
                                left: `${getCardPosition(hoverPosition()?.x, hoverPosition()?.y).x}px`,
                                top: `${getCardPosition(hoverPosition()?.x, hoverPosition()?.y).y}px`,
                                transform: getCardPosition(hoverPosition()?.x, hoverPosition()?.y).transform,
                                'backdrop-filter': 'blur(16px) saturate(180%)',
                                width: isCardExpanded() ? 'min(280px, calc(100vw - 32px))' : 'auto',
                                'max-height': isCardExpanded() ? 'min(400px, 70vh)' : 'auto',
                                cursor: 'pointer',
                                opacity: hoverPosition() ? '1' : '0',
                                visibility: hoverPosition() ? 'visible' : 'hidden'
                            }}
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setIsCardExpanded(!isCardExpanded());
                            }}
                        >
                            <div class="flex items-center gap-1.5">
                                <div class="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse shadow-lg shadow-blue-500/50"></div>
                                <span class="font-medium tracking-wide text-[11px]">International Space Station</span>
                            </div>

                            {/*  */}

                            <div
                                class="mt-0.5 flex items-center gap-1.5 text-[10px] text-blue-400/80 transition-opacity duration-300"
                                style={{ opacity: isCardExpanded() ? '0' : '1' }}
                            >
                                <svg class="w-2.5 h-2.5 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                                </svg>
                                <span class="font-medium">Click for more details</span>
                            </div>

                            <div
                                class="overflow-hidden transition-all duration-500 ease-in-out"
                                style={{
                                    'max-height': isCardExpanded() ? '500px' : '0px',
                                    opacity: isCardExpanded() ? '1' : '0'
                                }}
                            >
                                <div class="grid grid-cols-2 gap-2 mt-2">
                                    <div class="flex items-center gap-1">
                                        <svg class="w-2.5 h-2.5 text-blue-400/90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                        </svg>
                                        <span class="text-md text-white/70">Altitude: {issPosition()?.altitude.toFixed(1)} km</span>
                                    </div>
                                    <div class="flex items-center gap-1">
                                        <svg class="w-2.5 h-2.5 text-blue-400/90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                                        </svg>
                                        <span class="text-md text-white/70">Speed: {issPosition()?.velocity.toFixed(1)} km/s</span>
                                    </div>
                                </div>

                                <div class="mt-2 space-y-3 border-t border-white/10 pt-2">
                                    <div class="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3">
                                        <div class="space-y-1">
                                            <div class="text-[9px] uppercase tracking-wider text-emerald-400/90 font-medium">Latitude</div>
                                            <div class="font-mono text-[11px] md:text-xs tabular-nums text-white/90">
                                                {issPosition()?.latitude.toFixed(4)}°
                                            </div>
                                        </div>
                                        <div class="space-y-1">
                                            <div class="text-[9px] uppercase tracking-wider text-violet-400/90 font-medium">Longitude</div>
                                            <div class="font-mono text-[11px] md:text-xs tabular-nums text-white/90">
                                                {issPosition()?.longitude.toFixed(4)}°
                                            </div>
                                        </div>
                                        <div class="space-y-1">
                                            <div class="text-[9px] uppercase tracking-wider text-amber-400/90 font-medium">Current Location</div>
                                            <div class="font-light text-[11px] md:text-xs text-white/90">
                                                {currentCountry()}
                                            </div>
                                        </div>
                                        <div class="space-y-1">
                                            <div class="text-[9px] uppercase tracking-wider text-rose-400/90 font-medium">Orbital Period</div>
                                            <div class="font-light text-[11px] md:text-xs text-white/90">~92 minutes</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Show>
                    <EarthInfo
                        show={showEarthInfo()}
                        onClose={() => setShowEarthInfo(false)}
                    />
                </Show>
                <Show when={issPosition()}>
                    <div class="fixed bottom-8 left-1/2 transform -translate-x-1/2 bg-[rgba(28,28,28,0.66)] backdrop-blur-xl text-white px-4 py-2 rounded-lg text-xs md:text-sm font-medium border border-white/10 shadow-xl select-none pointer-events-none z-40">
                        ISS is currently above: {currentCountry()}
                    </div>
                </Show>
            </div>
        </ErrorBoundary>
    );
};

export default Globe; 