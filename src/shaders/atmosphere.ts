export const atmosphereVertexShader = `
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec2 vUv;

  void main() {
    vNormal = normalize(normalMatrix * normal);
    vPosition = (modelMatrix * vec4(position, 1.0)).xyz;
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const atmosphereFragmentShader = `
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec2 vUv;
  
  uniform vec3 sunPosition;
  uniform vec3 atmosphereColor;
  uniform float time;
  
  void main() {
    vec3 sunDir = normalize(sunPosition - vPosition);
    float intensity = pow(0.65 - dot(vNormal, sunDir), 4.0);
    
    // Enhanced height gradient
    float heightGradient = pow(1.0 - abs(vUv.y - 0.5) * 2.0, 0.8);
    
    // More dynamic time variation
    float timeVariation = sin(time * 0.15 + vPosition.x * 2.0 + vPosition.z) * 0.08 + 0.92;
    
    // Enhanced rim lighting
    float rimLight = pow(1.0 - abs(dot(vNormal, normalize(vPosition))), 5.0);
    
    // Combine effects with better balance
    float alpha = pow(intensity * heightGradient * timeVariation, 1.5) + rimLight * 0.4;
    
    // More vibrant color variation
    vec3 baseColor = mix(
      atmosphereColor,
      vec3(0.7, 0.9, 1.0),
      heightGradient * 0.4
    );
    
    vec3 finalColor = mix(
      baseColor,
      vec3(0.9, 0.95, 1.0),
      rimLight * 0.6
    );
    
    gl_FragColor = vec4(finalColor, alpha * 0.85) * intensity;
  }
`; 