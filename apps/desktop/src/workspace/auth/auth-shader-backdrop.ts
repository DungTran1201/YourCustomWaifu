import * as THREE from "three";

export interface AuthShaderBackdrop {
  mesh: THREE.Mesh;
  setTheme: (theme: "light" | "dark") => void;
  setPointer: (nx: number, ny: number) => void;
  update: (elapsed: number, delta: number, reducedMotion: boolean) => void;
  dispose: () => void;
}

const VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/**
 * Pure pattern-free, borderless translucent light-refraction shader whisper.
 * Leaves the underlying Windows Acrylic blur visible while adding a soft
 * floating highlight halo behind the centered Auth card.
 */
const FRAGMENT_SHADER = /* glsl */ `
  uniform float uTime;
  uniform float uThemeMix;
  uniform vec2 uPointer;
  varying vec2 vUv;

  void main() {
    vec2 uv = vUv;
    vec2 center = vec2(0.5, 0.48) + uPointer * 0.045;
    float dCenter = length((uv - center) * vec2(1.25, 1.0));

    // Gentle breathing halo centered around the floating auth card — zero stripes or grid patterns
    float breathe = 0.5 + 0.5 * sin(uTime * 0.45);
    float coreGlow = exp(-dCenter * dCenter * (5.2 - breathe * 0.45));

    // Subtle pointer specular sheen
    vec2 cursorPos = vec2(0.5, 0.5) + uPointer * 0.24;
    float dCursor = length(uv - cursorPos);
    float cursorSheen = exp(-dCursor * dCursor * 7.5);

    vec3 lightColor = mix(vec3(1.0, 1.0, 1.0), vec3(0.96, 0.96, 0.98), cursorSheen * 0.45);
    vec3 darkColor = mix(vec3(0.02, 0.02, 0.03), vec3(0.16, 0.16, 0.18), cursorSheen * 0.55);
    vec3 color = mix(lightColor, darkColor, uThemeMix);

    float lightAlpha = coreGlow * 0.08 + cursorSheen * 0.05;
    float darkAlpha = coreGlow * 0.1 + cursorSheen * 0.06;
    float alpha = mix(lightAlpha, darkAlpha, uThemeMix);

    gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.12));
  }
`;

/**
 * Creates a minimal, pattern-free translucent WebGL ambient sheen behind Auth dialogs
 * so the native OS blurred acrylic desktop shines cleanly underneath.
 */
export function buildAuthShaderBackdrop(
  initialTheme: "light" | "dark" = "light",
): AuthShaderBackdrop {
  let targetThemeMix = initialTheme === "dark" ? 1 : 0;
  const targetPointer = new THREE.Vector2(0, 0);

  const uniforms = {
    uTime: { value: 0 },
    uThemeMix: { value: targetThemeMix },
    uPointer: { value: new THREE.Vector2(0, 0) },
  };

  const geometry = new THREE.PlaneGeometry(2, 2);
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    fog: false,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = "AuthShaderBackdrop";
  mesh.renderOrder = 0;

  return {
    mesh,
    setTheme(theme: "light" | "dark") {
      targetThemeMix = theme === "dark" ? 1 : 0;
    },
    setPointer(nx: number, ny: number) {
      targetPointer.set(
        THREE.MathUtils.clamp(nx, -1, 1),
        THREE.MathUtils.clamp(ny, -1, 1),
      );
    },
    update(elapsed: number, delta: number, reducedMotion: boolean) {
      uniforms.uTime.value = reducedMotion ? 0.0 : elapsed;
      const alpha = reducedMotion ? 1 : 1 - Math.exp(-6.0 * delta);
      uniforms.uThemeMix.value = THREE.MathUtils.lerp(
        uniforms.uThemeMix.value,
        targetThemeMix,
        alpha,
      );
      uniforms.uPointer.value.lerp(targetPointer, alpha);
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
