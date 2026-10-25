# Avatar Stage & VRM Rendering Architecture

## 1. Overview
The Avatar Stage is an independent, frameless, transparent native window designed to render 3D VRM avatars seamlessly on the user's desktop. It operates alongside the Workspace or independently after the Workspace is closed.

## 2. Rendering Pipeline
- **Three.js Engine**: Uses `THREE.WebGLRenderer` configured with:
  - `alpha: true`
  - `antialias: true`
  - `powerPreference: "high-performance"`
  - `premultipliedAlpha: false`
- **Lighting**:
  - `THREE.AmbientLight` (intensity: 0.85)
  - Key `THREE.DirectionalLight` (intensity: 1.4)
  - Blue rim `THREE.DirectionalLight` (intensity: 0.5)

## 3. Procedural Holographic Mannequin Fallback
To provide immediate visual feedback before any external VRM model is chosen or while loading:
- A stylized, geometric holographic mannequin is procedurally constructed using Three.js standard geometries (head, glowing cyan eye visor, torso, shoulder ring, and floating base pedestal).
- When a valid user VRM is loaded, the mannequin is automatically hidden (`fallbackGroup.visible = false`).
- If VRM loading fails or the file is removed, the mannequin becomes active again.

## 4. VRM 3D Loading & Animation
- **Loader**: `GLTFLoader` with registered `VRMLoaderPlugin(parser)`.
- **Idle Motion Engine**:
  - **Breathing**: Procedural harmonic oscillation of the `spine` bone (`Math.sin(elapsed * 1.8) * 0.02`).
  - **Head Sway**: Gentle micro-movements on the `head` bone synchronized with breathing.
  - **Blinking**: Natural periodic eye blinks via VRM expression manager (`vrm.expressionManager.setValue("blink", ...)`).
- **Scale**: Real-time scale adjustments (from 0.5x to 2.0x) applied uniformly to the VRM scene root.

## 5. Strict Resource Management (`disposeHierarchy`)
To prevent memory leaks during long-running desktop sessions or when switching avatar models:
```ts
function disposeHierarchy(obj: THREE.Object3D) {
  obj.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      if (mesh.material) {
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((m) => m.dispose());
        } else {
          mesh.material.dispose();
        }
      }
    }
  });
}
```
Whenever a new model is loaded, the previous model is detached from the scene, its entire geometry and material hierarchy is disposed, and references are cleared for garbage collection.
