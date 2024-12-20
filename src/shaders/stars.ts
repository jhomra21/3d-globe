export const starsVertexShader = `
  attribute float size;
  attribute float randomness;
  attribute vec3 customColor;
  
  varying vec3 vColor;
  varying float vRandomness;
  varying float vDistance;
  
  uniform float time;
  uniform float pixelRatio;
  
  void main() {
    vColor = customColor;
    vRandomness = randomness;
    
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vDistance = -mvPosition.z;
    
    // Complex twinkling effect with multiple frequencies
    float twinkle = sin(time * (0.5 + randomness) + position.x * 0.3)
                  * sin(time * 0.7 + position.y * 0.2)
                  * sin(time * 0.9 + position.z * 0.1);
    twinkle = pow(0.5 + 0.5 * twinkle, 2.0);
    
    // Add subtle pulsing based on distance
    float pulse = sin(time * (0.2 + randomness * 0.3) + vDistance * 0.01) * 0.15 + 0.85;
    
    // Size attenuation with distance and effects
    float distanceAttenuation = 400.0 / vDistance;
    
    gl_PointSize = size * twinkle * pulse * distanceAttenuation * pixelRatio;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

export const starsFragmentShader = `
  varying vec3 vColor;
  varying float vRandomness;
  varying float vDistance;
  
  void main() {
    // Enhanced circular point shape
    vec2 center = gl_PointCoord - vec2(0.5);
    float dist = length(center);
    
    // Smooth edge falloff with distance-based adjustment
    float distanceFactor = clamp(vDistance / 1000.0, 0.0, 1.0);
    float edgeSoftness = mix(0.45, 0.35, distanceFactor);
    float alpha = 1.0 - smoothstep(edgeSoftness, 0.5, dist);
    
    // Enhanced color variation based on distance and randomness
    vec3 color = vColor;
    color += vec3(vRandomness * 0.2) * (1.0 - distanceFactor);
    
    // Add atmospheric scattering effect
    vec3 atmosphericColor = vec3(0.8, 0.9, 1.0);
    color = mix(color, atmosphericColor, distanceFactor * 0.3);
    
    // Enhanced glow effect
    float glow = exp(-3.0 * dist);
    color += 0.2 * glow * vec3(1.0, 0.8, 0.6);
    
    // Brightness adjustment based on distance
    float brightness = mix(1.0, 0.7, distanceFactor);
    color *= brightness;
    
    gl_FragColor = vec4(color, alpha);
  }
`; 