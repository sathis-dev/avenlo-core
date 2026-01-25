// ====================================
// FRACTURE VERTEX SHADER
// Crystalline displacement with heat-based fracturing
// ====================================

export const fractureVertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uHeat;
  uniform float uFracture;
  uniform float uNoiseScale;
  uniform float uDisplacement;
  
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying float vDisplacement;
  varying float vHeat;
  
  // Simplex 3D noise
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
  
  float snoise(vec3 v) {
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    
    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    
    i = mod289(i);
    vec4 p = permute(permute(permute(
      i.z + vec4(0.0, i1.z, i2.z, 1.0))
      + i.y + vec4(0.0, i1.y, i2.y, 1.0))
      + i.x + vec4(0.0, i1.x, i2.x, 1.0));
      
    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;
    
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    
    vec4 x = x_ *ns.x + ns.yyyy;
    vec4 y = y_ *ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    
    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    
    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
    
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;
    
    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
  }
  
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vHeat = uHeat;
    
    // Create fracture displacement based on heat
    float noise = snoise(position * uNoiseScale + uTime * 0.5);
    float fracture = noise * uFracture * uHeat * 0.01;
    
    // Add vibration at high heat levels
    float vibration = 0.0;
    if (uHeat > 70.0) {
      vibration = sin(uTime * 20.0 + position.x * 10.0) * (uHeat - 70.0) * 0.001;
    }
    
    // Displacement along normal
    vec3 displaced = position + normal * (fracture + vibration) * uDisplacement;
    
    vDisplacement = fracture;
    vPosition = displaced;
    
    gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
  }
`;

// ====================================
// FRACTURE FRAGMENT SHADER
// Heat-based color gradient with crystalline effect
// ====================================

export const fractureFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uHeat;
  uniform vec3 uBaseColor;
  uniform vec3 uHotColor;
  uniform vec3 uCriticalColor;
  
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying float vDisplacement;
  varying float vHeat;
  
  void main() {
    // Fresnel effect for crystalline edges
    vec3 viewDirection = normalize(cameraPosition - vPosition);
    float fresnel = pow(1.0 - max(dot(viewDirection, vNormal), 0.0), 3.0);
    
    // Heat-based color interpolation
    vec3 color;
    if (vHeat < 50.0) {
      color = mix(uBaseColor, uHotColor, vHeat / 50.0);
    } else {
      color = mix(uHotColor, uCriticalColor, (vHeat - 50.0) / 50.0);
    }
    
    // Add crystalline shimmer
    float shimmer = sin(vPosition.x * 20.0 + uTime) * 
                    sin(vPosition.y * 20.0 + uTime * 1.3) * 
                    sin(vPosition.z * 20.0 + uTime * 0.7);
    shimmer = shimmer * 0.1 + 0.9;
    
    // Fracture glow at displacement areas
    float fractureGlow = smoothstep(0.0, 0.1, abs(vDisplacement)) * 0.5;
    
    // Combine effects
    vec3 finalColor = color * shimmer;
    finalColor += vec3(1.0, 0.5, 0.2) * fractureGlow * (vHeat / 100.0);
    finalColor += fresnel * color * 0.3;
    
    // Opacity based on heat (more opaque when hot)
    float opacity = 0.3 + (vHeat / 100.0) * 0.5 + fresnel * 0.2;
    
    gl_FragColor = vec4(finalColor, opacity);
  }
`;

// ====================================
// PARTICLE VERTEX SHADER
// Heat particle emission
// ====================================

export const particleVertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uHeat;
  
  attribute float aScale;
  attribute float aLife;
  attribute vec3 aVelocity;
  
  varying float vLife;
  varying float vHeat;
  
  void main() {
    vLife = aLife;
    vHeat = uHeat;
    
    // Animate particles based on life and velocity
    float life = mod(aLife + uTime * 0.5, 1.0);
    vec3 pos = position + aVelocity * life * 2.0;
    
    // Rise and fade
    pos.y += life * 1.5;
    
    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    
    // Size decreases with life
    float size = aScale * (1.0 - life) * 30.0 * (uHeat / 100.0);
    
    gl_PointSize = size * (300.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

// ====================================
// PARTICLE FRAGMENT SHADER
// ====================================

export const particleFragmentShader = /* glsl */ `
  uniform vec3 uColor;
  
  varying float vLife;
  varying float vHeat;
  
  void main() {
    // Circular particle
    float dist = length(gl_PointCoord - vec2(0.5));
    if (dist > 0.5) discard;
    
    // Soft edges
    float alpha = 1.0 - smoothstep(0.3, 0.5, dist);
    alpha *= (1.0 - vLife);
    
    // Color intensity based on heat
    vec3 color = uColor * (0.5 + vHeat / 200.0);
    
    gl_FragColor = vec4(color, alpha * 0.8);
  }
`;

// ====================================
// GLOW RING SHADER
// Orbital reputation visualization
// ====================================

export const glowRingVertexShader = /* glsl */ `
  varying vec2 vUv;
  
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const glowRingFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uIntensity;
  uniform vec3 uColor;
  uniform float uPulseSpeed;
  
  varying vec2 vUv;
  
  void main() {
    vec2 center = vec2(0.5, 0.5);
    float dist = distance(vUv, center);
    
    // Ring effect
    float ring = smoothstep(0.4, 0.45, dist) * smoothstep(0.55, 0.5, dist);
    
    // Pulse animation
    float pulse = sin(uTime * uPulseSpeed) * 0.2 + 0.8;
    
    // Gradient along ring
    float angle = atan(vUv.y - 0.5, vUv.x - 0.5);
    float gradient = (sin(angle * 3.0 + uTime) * 0.5 + 0.5) * 0.3 + 0.7;
    
    vec3 color = uColor * ring * pulse * gradient * uIntensity;
    float alpha = ring * pulse * uIntensity;
    
    gl_FragColor = vec4(color, alpha);
  }
`;

// ====================================
// WAVEFORM SHADER
// For ForensicScrubber visualization
// ====================================

export const waveformVertexShader = /* glsl */ `
  attribute float aAmplitude;
  attribute float aSentiment;
  
  varying float vAmplitude;
  varying float vSentiment;
  varying vec2 vUv;
  
  void main() {
    vAmplitude = aAmplitude;
    vSentiment = aSentiment;
    vUv = uv;
    
    vec3 pos = position;
    pos.y += aAmplitude * 0.5;
    
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

export const waveformFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform vec3 uPositiveColor;
  uniform vec3 uNegativeColor;
  uniform vec3 uNeutralColor;
  
  varying float vAmplitude;
  varying float vSentiment;
  varying vec2 vUv;
  
  void main() {
    // Color based on sentiment
    vec3 color;
    if (vSentiment > 0.2) {
      color = mix(uNeutralColor, uPositiveColor, vSentiment);
    } else if (vSentiment < -0.2) {
      color = mix(uNeutralColor, uNegativeColor, -vSentiment);
    } else {
      color = uNeutralColor;
    }
    
    // Intensity based on amplitude (heat)
    float intensity = 0.5 + vAmplitude * 0.5;
    
    // Glow effect at peaks
    float glow = smoothstep(0.7, 1.0, vAmplitude) * 0.5;
    
    vec3 finalColor = color * intensity + vec3(1.0) * glow;
    
    gl_FragColor = vec4(finalColor, 0.9);
  }
`;
