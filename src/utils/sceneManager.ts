import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { CameraController } from './cameraControls';
import { CAMERA, TEXTURES } from '../constants/scene';

export class SceneManager {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  private cameraController: CameraController;
  private disposables: { dispose: () => void }[] = [];
  private textureLoader: THREE.TextureLoader;
  private animationFrameId: number | null = null;

  constructor(container: HTMLElement) {
    this.scene = new THREE.Scene();
    this.camera = this.createCamera();
    this.renderer = this.createRenderer(container);
    this.controls = this.createControls(container);
    this.cameraController = new CameraController(this.camera, this.controls);
    this.textureLoader = new THREE.TextureLoader();

    this.handleResize = this.handleResize.bind(this);
    window.addEventListener('resize', this.handleResize);
  }

  private createCamera(): THREE.PerspectiveCamera {
    const camera = new THREE.PerspectiveCamera(
      CAMERA.FOV,
      window.innerWidth / window.innerHeight,
      CAMERA.NEAR,
      CAMERA.FAR
    );
    camera.position.z = CAMERA.INITIAL_POSITION_Z;
    return camera;
  }

  private createRenderer(container: HTMLElement): THREE.WebGLRenderer {
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);
    return renderer;
  }

  private createControls(container: HTMLElement): OrbitControls {
    const controls = new OrbitControls(this.camera, container);
    
    // Enhanced control settings
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.rotateSpeed = 0.7;
    controls.zoomSpeed = 0.8;
    controls.panSpeed = 0.8;
    
    // Smoother limits
    controls.minDistance = 8;
    controls.maxDistance = 40;
    
    // Better polar angle limits
    controls.minPolarAngle = Math.PI * 0.1; // Prevent viewing from directly above
    controls.maxPolarAngle = Math.PI * 0.9; // Prevent viewing from directly below
    
    // Enhanced damping
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    
    return controls;
  }

  public loadTexture(url: string): Promise<THREE.Texture> {
    return new Promise((resolve, reject) => {
      const texture = this.textureLoader.load(
        url,
        resolve,
        undefined,
        reject
      );
      texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
      this.disposables.push(texture);
      return texture;
    });
  }

  public addToScene(object: THREE.Object3D) {
    this.scene.add(object);
    if ('dispose' in object) {
      this.disposables.push(object as { dispose: () => void });
    }
  }

  public removeFromScene(object: THREE.Object3D) {
    this.scene.remove(object);
    object.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(material => material.dispose());
          } else {
            child.material.dispose();
          }
        }
      }
    });
  }

  public startAnimation(animate: () => void): () => void {
    const animationLoop = () => {
      this.animationFrameId = requestAnimationFrame(animationLoop);
      this.controls.update(); // Update controls in animation loop
      this.cameraController.update();
      animate();
      this.renderer.render(this.scene, this.camera);
    };
    animationLoop();

    return () => {
      if (this.animationFrameId !== null) {
        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = null;
      }
    };
  }

  private handleResize = () => {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  };

  public focusOnPosition(position: THREE.Vector3, distance?: number): void {
    this.cameraController.focusOnPosition(position, distance);
  }

  public dispose(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    window.removeEventListener('resize', this.handleResize);
    
    this.disposables.forEach(item => item.dispose());
    this.disposables = [];

    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        if (object.geometry) object.geometry.dispose();
        if (object.material) {
          if (Array.isArray(object.material)) {
            object.material.forEach(material => material.dispose());
          } else {
            object.material.dispose();
          }
        }
      }
    });

    this.renderer.dispose();
    this.controls.dispose();
    this.cameraController.dispose();
  }

  get Scene(): THREE.Scene {
    return this.scene;
  }

  get Camera(): THREE.PerspectiveCamera {
    return this.camera;
  }

  get Renderer(): THREE.WebGLRenderer {
    return this.renderer;
  }

  get Controls(): OrbitControls {
    return this.controls;
  }
} 