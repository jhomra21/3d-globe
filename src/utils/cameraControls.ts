import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { CAMERA } from '../constants/scene';

export class CameraController {
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private animationFrame: number | null = null;
  private targetPosition: THREE.Vector3 | null = null;
  private initialPosition: THREE.Vector3 | null = null;
  private animationStartTime: number = 0;
  private animationDuration: number = 1000; // ms

  constructor(camera: THREE.PerspectiveCamera, controls: OrbitControls) {
    this.camera = camera;
    this.controls = controls;
    this.setupControls();
  }

  private setupControls() {
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.rotateSpeed = 0.5;
    this.controls.minDistance = CAMERA.MIN_DISTANCE;
    this.controls.maxDistance = CAMERA.MAX_DISTANCE;
    this.controls.enablePan = false;
  }

  public focusOnPosition(position: THREE.Vector3, distance: number = 15) {
    this.stopAnimation();
    
    this.initialPosition = this.camera.position.clone();
    this.targetPosition = position.clone().normalize().multiplyScalar(distance);
    this.animationStartTime = performance.now();
    
    this.animate();
  }

  private animate = () => {
    if (!this.targetPosition || !this.initialPosition) return;

    const currentTime = performance.now();
    const elapsed = currentTime - this.animationStartTime;
    const progress = Math.min(elapsed / this.animationDuration, 1);
    
    // Smooth easing function
    const eased = 1 - Math.pow(1 - progress, 3);

    // Interpolate camera position
    this.camera.position.lerpVectors(
      this.initialPosition,
      this.targetPosition,
      eased
    );

    // Look at origin
    this.camera.lookAt(new THREE.Vector3(0, 0, 0));
    this.controls.update();

    if (progress < 1) {
      this.animationFrame = requestAnimationFrame(this.animate);
    } else {
      this.stopAnimation();
    }
  };

  private stopAnimation() {
    if (this.animationFrame !== null) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
  }

  public update() {
    this.controls.update();
  }

  public dispose() {
    this.stopAnimation();
    this.controls.dispose();
  }
} 