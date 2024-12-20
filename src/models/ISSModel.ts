import * as THREE from 'three';

export class ISSModel {
  private static createBodyMaterial(): THREE.MeshPhongMaterial {
    return new THREE.MeshPhongMaterial({ 
      color: 0xffffff,
      specular: 0x888888,
      shininess: 100,
      emissive: 0x444444,
      emissiveIntensity: 0.4
    });
  }

  private static createSolarPanelMaterial(): THREE.MeshPhongMaterial {
    return new THREE.MeshPhongMaterial({
      color: 0x1a4b8a,
      specular: 0x666666,
      shininess: 120,
      emissive: 0x112244,
      emissiveIntensity: 0.5
    });
  }

  private static createLabModule(position: THREE.Vector3, scale: THREE.Vector3, bodyMaterial: THREE.MeshPhongMaterial): THREE.Mesh {
    const module = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.1, 0.3, 16),
      bodyMaterial
    );
    module.position.copy(position);
    module.scale.copy(scale);
    module.rotation.z = Math.PI / 2;
    return module;
  }

  private static createSolarArray(position: THREE.Vector3, rotation: THREE.Euler, bodyMaterial: THREE.MeshPhongMaterial): THREE.Group {
    const array = new THREE.Group();
    
    // Main panel
    const panel = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.2, 0.01),
      this.createSolarPanelMaterial()
    );
    
    // Solar cells detail
    const cellSize = 0.04;
    const cellGeometry = new THREE.BoxGeometry(cellSize, cellSize, 0.002);
    const cellMaterial = new THREE.MeshPhongMaterial({
      color: 0x0a2d5a,
      specular: 0x222222,
      shininess: 80,
      emissive: 0x112244,
      emissiveIntensity: 0.2
    });

    // Create grid of cells
    for (let i = 0; i < 12; i++) {
      for (let j = 0; j < 4; j++) {
        const cell = new THREE.Mesh(cellGeometry, cellMaterial);
        cell.position.set(
          (i - 5.5) * (cellSize + 0.002),
          (j - 1.5) * (cellSize + 0.002),
          0.006
        );
        panel.add(cell);
      }
    }

    // Support structure
    const support = new THREE.Mesh(
      new THREE.BoxGeometry(0.03, 0.22, 0.02),
      bodyMaterial
    );

    array.add(panel);
    array.add(support);
    array.position.copy(position);
    array.setRotationFromEuler(rotation);
    return array;
  }

  private static createRadiator(position: THREE.Vector3): THREE.Mesh {
    const radiator = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.01, 0.15),
      new THREE.MeshPhongMaterial({
        color: 0xcccccc,
        specular: 0x666666,
        shininess: 60
      })
    );
    radiator.position.copy(position);
    return radiator;
  }

  public static create(): THREE.Group {
    const group = new THREE.Group();
    
    // Invisible click target
    const clickTarget = new THREE.Mesh(
      new THREE.SphereGeometry(0.4),
      new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide
      })
    );
    group.add(clickTarget);

    const bodyMaterial = this.createBodyMaterial();

    // Main central truss (integrated truss structure)
    const mainTruss = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.1, 0.1),
      bodyMaterial
    );
    group.add(mainTruss);

    // Pressurized modules group
    const modulesGroup = new THREE.Group();

    // Main habitation module (Zvezda)
    const mainModule = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.12, 0.4, 16),
      bodyMaterial
    );
    mainModule.rotation.z = Math.PI / 2;
    modulesGroup.add(mainModule);

    // Add various modules
    modulesGroup.add(this.createLabModule(new THREE.Vector3(-0.35, 0, 0), new THREE.Vector3(1, 1, 1), bodyMaterial)); // Destiny
    modulesGroup.add(this.createLabModule(new THREE.Vector3(0.35, 0, 0), new THREE.Vector3(1, 1, 1), bodyMaterial)); // Zarya
    modulesGroup.add(this.createLabModule(new THREE.Vector3(0, 0, 0.2), new THREE.Vector3(0.8, 0.8, 0.8), bodyMaterial)); // Columbus
    modulesGroup.add(this.createLabModule(new THREE.Vector3(0, 0, -0.2), new THREE.Vector3(0.8, 0.8, 0.8), bodyMaterial)); // Kibo

    group.add(modulesGroup);

    // Add solar arrays
    const solarArraysGroup = new THREE.Group();
    
    // Port side arrays
    solarArraysGroup.add(this.createSolarArray(
      new THREE.Vector3(-0.6, 0, 0.3),
      new THREE.Euler(0, 0, 0),
      bodyMaterial
    ));
    solarArraysGroup.add(this.createSolarArray(
      new THREE.Vector3(-0.6, 0, -0.3),
      new THREE.Euler(0, 0, 0),
      bodyMaterial
    ));

    // Starboard side arrays
    solarArraysGroup.add(this.createSolarArray(
      new THREE.Vector3(0.6, 0, 0.3),
      new THREE.Euler(0, 0, 0),
      bodyMaterial
    ));
    solarArraysGroup.add(this.createSolarArray(
      new THREE.Vector3(0.6, 0, -0.3),
      new THREE.Euler(0, 0, 0),
      bodyMaterial
    ));

    group.add(solarArraysGroup);

    // Add radiators
    group.add(this.createRadiator(new THREE.Vector3(0.4, 0.1, 0)));
    group.add(this.createRadiator(new THREE.Vector3(-0.4, 0.1, 0)));

    // Add lighting
    const issLight = new THREE.PointLight(0xffffff, 0.8, 2);
    issLight.position.set(0, 0, 0);
    group.add(issLight);

    // Scale the entire model
    group.scale.setScalar(0.4);

    return group;
  }
} 