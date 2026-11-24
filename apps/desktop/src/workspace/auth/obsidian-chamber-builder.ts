import * as THREE from "three";
import { disposeObject3D } from "../../vrm/webgl-utils.js";

export interface ChamberDimensions {
  width: number;
  height: number;
  depth: number;
}

export interface ObsidianChamberInstance {
  root: THREE.Group;
  dimensions: ChamberDimensions;
  companionAnchor: THREE.Vector3;
  contactShadow: THREE.Mesh | null;
  violetStripMat: THREE.MeshBasicMaterial;
  roseStripMat: THREE.MeshBasicMaterial;
  glassBaffles: THREE.Mesh[];
  setCompanionPosition: (x: number, z: number) => void;
  updateAmbient: (elapsed: number, entranceProgress: number) => void;
  dispose: () => void;
}

export const DEFAULT_CHAMBER_DIMENSIONS: ChamberDimensions = {
  width: 4.6,
  height: 2.85,
  depth: 4.8,
};

function createContactShadowTexture(): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const grad = ctx.createRadialGradient(64, 64, 5, 64, 64, 62);
  grad.addColorStop(0, "rgba(2, 3, 6, 0.78)");
  grad.addColorStop(0.5, "rgba(5, 6, 12, 0.34)");
  grad.addColorStop(1, "rgba(5, 6, 12, 0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

/**
 * Builds a genuine 3D rectangular Obsidian Glass Chamber:
 * - Enclosed 3D box room (Floor, Ceiling, Back Wall, Left Smoked Glass Wall, Right Smoked Glass Wall)
 * - Anodized obsidian structural mullions & perspective wireframe seams
 * - Semi-transparent Smoked Glass interior baffles with deterministic renderOrder & depthWrite = false
 * - Shadow-receiving obsidian floor + recessed Smoky Violet (#9185D9) and Dusty Rose (#B9789B) light coves
 */
export function buildObsidianGlassChamber(
  initialCompanionX = 0.78,
  initialCompanionZ = -0.34,
  dims: ChamberDimensions = DEFAULT_CHAMBER_DIMENSIONS,
): ObsidianChamberInstance {
  const root = new THREE.Group();
  root.name = "ObsidianGlassChamber";

  const halfW = dims.width / 2;
  const halfD = dims.depth / 2;
  const H = dims.height;

  // -------------------------------------------------------------------------
  // 1. Deep Exterior Void Shell (gives visible depth behind semi-transparent back glass)
  // -------------------------------------------------------------------------
  const voidBackdropMat = new THREE.MeshBasicMaterial({
    color: 0x040509,
  });
  const voidBackdrop = new THREE.Mesh(
    new THREE.PlaneGeometry(dims.width * 1.8, H * 1.6),
    voidBackdropMat,
  );
  voidBackdrop.name = "ChamberExteriorVoid";
  voidBackdrop.position.set(0, H * 0.5, -halfD - 1.1);
  voidBackdrop.renderOrder = 0;
  root.add(voidBackdrop);

  // Subtle distant structural horizon beam behind the smoked back glass
  const distantBeamMat = new THREE.MeshBasicMaterial({
    color: 0x9185d9,
    transparent: true,
    opacity: 0.14,
    depthWrite: false,
  });
  const distantBeam = new THREE.Mesh(
    new THREE.PlaneGeometry(dims.width * 1.1, 0.025),
    distantBeamMat,
  );
  distantBeam.position.set(0, H * 0.44, -halfD - 0.65);
  distantBeam.renderOrder = 0;
  root.add(distantBeam);

  // -------------------------------------------------------------------------
  // 2. Structural Obsidian Floor (Opaque shadow-receiving base + Smoked Glass reflection glaze)
  // -------------------------------------------------------------------------
  const floorBaseMat = new THREE.MeshStandardMaterial({
    color: 0x07080e,
    roughness: 0.78,
    metalness: 0.22,
  });
  const floorBase = new THREE.Mesh(
    new THREE.PlaneGeometry(dims.width, dims.depth),
    floorBaseMat,
  );
  floorBase.name = "ChamberFloorBase";
  floorBase.rotation.x = -Math.PI / 2;
  floorBase.position.set(0, 0, 0);
  floorBase.receiveShadow = true;
  floorBase.renderOrder = 0;
  root.add(floorBase);

  const floorGlassMat = new THREE.MeshPhysicalMaterial({
    color: 0x0d101b,
    transparent: true,
    opacity: 0.52,
    roughness: 0.12,
    metalness: 0.35,
    clearcoat: 0.85,
    clearcoatRoughness: 0.18,
    depthWrite: false,
  });
  const floorGlass = new THREE.Mesh(
    new THREE.PlaneGeometry(dims.width, dims.depth),
    floorGlassMat,
  );
  floorGlass.name = "ChamberFloorSmokedGlass";
  floorGlass.rotation.x = -Math.PI / 2;
  floorGlass.position.set(0, 0.0015, 0);
  floorGlass.renderOrder = 1;
  root.add(floorGlass);

  // Perspective floor tile seams (converging toward back wall)
  const gridPoints: THREE.Vector3[] = [];
  const xDivs = 6;
  const zDivs = 6;
  for (let i = 1; i < xDivs; i++) {
    const x = -halfW + (dims.width * i) / xDivs;
    gridPoints.push(
      new THREE.Vector3(x, 0.0025, -halfD),
      new THREE.Vector3(x, 0.0025, halfD),
    );
  }
  for (let j = 1; j < zDivs; j++) {
    const z = -halfD + (dims.depth * j) / zDivs;
    gridPoints.push(
      new THREE.Vector3(-halfW, 0.0025, z),
      new THREE.Vector3(halfW, 0.0025, z),
    );
  }
  const gridGeo = new THREE.BufferGeometry().setFromPoints(gridPoints);
  const gridMat = new THREE.LineBasicMaterial({
    color: 0x23263a,
    transparent: true,
    opacity: 0.34,
    depthWrite: false,
  });
  const floorGrid = new THREE.LineSegments(gridGeo, gridMat);
  floorGrid.name = "ChamberFloorPerspectiveGrid";
  floorGrid.renderOrder = 1;
  root.add(floorGrid);

  // -------------------------------------------------------------------------
  // 3. Smoked Obsidian Ceiling + Recessed Linear Light Coves
  // -------------------------------------------------------------------------
  const ceilingMat = new THREE.MeshStandardMaterial({
    color: 0x080a12,
    roughness: 0.32,
    metalness: 0.45,
  });
  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(dims.width, dims.depth),
    ceilingMat,
  );
  ceiling.name = "ChamberCeiling";
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(0, H, 0);
  ceiling.renderOrder = 0;
  root.add(ceiling);

  const violetStripMat = new THREE.MeshBasicMaterial({
    color: 0x9185d9,
    transparent: true,
    opacity: 0.48,
  });
  const roseStripMat = new THREE.MeshBasicMaterial({
    color: 0xb9789b,
    transparent: true,
    opacity: 0.38,
  });

  const stripGeo = new THREE.PlaneGeometry(0.028, dims.depth * 0.88);
  const rightCeilingCove = new THREE.Mesh(stripGeo, violetStripMat);
  rightCeilingCove.name = "CeilingVioletCove";
  rightCeilingCove.rotation.x = Math.PI / 2;
  rightCeilingCove.position.set(halfW - 0.32, H - 0.004, 0);
  root.add(rightCeilingCove);

  const leftCeilingCove = new THREE.Mesh(stripGeo, roseStripMat);
  leftCeilingCove.name = "CeilingRoseCove";
  leftCeilingCove.rotation.x = Math.PI / 2;
  leftCeilingCove.position.set(-halfW + 0.32, H - 0.004, 0);
  root.add(leftCeilingCove);

  // -------------------------------------------------------------------------
  // 4. Smoked Obsidian Glass Walls (Back, Left, Right) — Semi-Transparent 3D Box
  // -------------------------------------------------------------------------
  const backWallMat = new THREE.MeshPhysicalMaterial({
    color: 0x0b0d16,
    transparent: true,
    opacity: 0.76,
    roughness: 0.18,
    metalness: 0.3,
    clearcoat: 0.7,
    depthWrite: false,
  });
  const backWall = new THREE.Mesh(
    new THREE.PlaneGeometry(dims.width, H),
    backWallMat,
  );
  backWall.name = "ChamberBackGlassWall";
  backWall.position.set(0, H / 2, -halfD);
  backWall.receiveShadow = true;
  backWall.renderOrder = 1;
  root.add(backWall);

  const sideWallMat = new THREE.MeshPhysicalMaterial({
    color: 0x0a0c15,
    transparent: true,
    opacity: 0.68,
    roughness: 0.15,
    metalness: 0.35,
    clearcoat: 0.8,
    depthWrite: false,
  });

  const leftWall = new THREE.Mesh(
    new THREE.PlaneGeometry(dims.depth, H),
    sideWallMat,
  );
  leftWall.name = "ChamberLeftGlassWall";
  leftWall.rotation.y = Math.PI / 2;
  leftWall.position.set(-halfW, H / 2, 0);
  leftWall.receiveShadow = true;
  leftWall.renderOrder = 2;
  root.add(leftWall);

  const rightWall = new THREE.Mesh(
    new THREE.PlaneGeometry(dims.depth, H),
    sideWallMat,
  );
  rightWall.name = "ChamberRightGlassWall";
  rightWall.rotation.y = -Math.PI / 2;
  rightWall.position.set(halfW, H / 2, 0);
  rightWall.receiveShadow = true;
  rightWall.renderOrder = 2;
  root.add(rightWall);

  // -------------------------------------------------------------------------
  // 5. 3D Box Perimeter Seams & Anodized Obsidian Mullion Ribs
  // -------------------------------------------------------------------------
  const boxEdgesGeo = new THREE.EdgesGeometry(
    new THREE.BoxGeometry(dims.width - 0.01, H - 0.01, dims.depth - 0.01),
  );
  const boxEdgesMat = new THREE.LineBasicMaterial({
    color: 0x323654,
    transparent: true,
    opacity: 0.62,
  });
  const chamberWireframe = new THREE.LineSegments(boxEdgesGeo, boxEdgesMat);
  chamberWireframe.name = "ChamberBoxEdges";
  chamberWireframe.position.set(0, H / 2, 0);
  chamberWireframe.renderOrder = 2;
  root.add(chamberWireframe);

  const mullionMat = new THREE.MeshStandardMaterial({
    color: 0x121522,
    roughness: 0.42,
    metalness: 0.68,
  });
  const sideMullionGeo = new THREE.BoxGeometry(0.035, H, 0.045);
  for (const zPos of [-1.2, 0.0, 1.2]) {
    const leftRib = new THREE.Mesh(sideMullionGeo, mullionMat);
    leftRib.position.set(-halfW + 0.018, H / 2, zPos);
    leftRib.castShadow = true;
    leftRib.receiveShadow = true;
    root.add(leftRib);

    const rightRib = new THREE.Mesh(sideMullionGeo, mullionMat);
    rightRib.position.set(halfW - 0.018, H / 2, zPos);
    rightRib.castShadow = true;
    rightRib.receiveShadow = true;
    root.add(rightRib);
  }

  const backMullionGeo = new THREE.BoxGeometry(0.04, H, 0.04);
  for (const xPos of [-1.15, 0.0, 1.15]) {
    const backRib = new THREE.Mesh(backMullionGeo, mullionMat);
    backRib.position.set(xPos, H / 2, -halfD + 0.02);
    backRib.receiveShadow = true;
    root.add(backRib);
  }

  // -------------------------------------------------------------------------
  // 6. Interior Smoked Glass Baffles (Multi-plane translucent depth behind Panel & VRM)
  // -------------------------------------------------------------------------
  const baffleGlassMat = new THREE.MeshPhysicalMaterial({
    color: 0x121524,
    transparent: true,
    opacity: 0.32,
    roughness: 0.1,
    metalness: 0.25,
    clearcoat: 1.0,
    clearcoatRoughness: 0.1,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  const baffleEdgeVioletMat = new THREE.LineBasicMaterial({
    color: 0x9185d9,
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
  });
  const baffleEdgeRoseMat = new THREE.LineBasicMaterial({
    color: 0xb9789b,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
  });

  // Left interior smoked glass fin (visible in the left perspective wing of the chamber)
  const leftBaffleGeo = new THREE.BoxGeometry(0.86, 2.28, 0.022);
  const leftBaffle = new THREE.Mesh(leftBaffleGeo, baffleGlassMat);
  leftBaffle.name = "LeftSmokedGlassBaffle";
  leftBaffle.position.set(-1.28, 1.14, -1.05);
  leftBaffle.rotation.y = 0.14;
  leftBaffle.renderOrder = 3;
  leftBaffle.add(
    new THREE.LineSegments(
      new THREE.EdgesGeometry(leftBaffleGeo),
      baffleEdgeRoseMat,
    ),
  );
  root.add(leftBaffle);

  // Right companion alcove smoked glass backdrop (frames VRM inside the chamber)
  const rightBaffleGeo = new THREE.BoxGeometry(1.18, 2.38, 0.024);
  const rightBaffle = new THREE.Mesh(rightBaffleGeo, baffleGlassMat);
  rightBaffle.name = "CompanionSmokedGlassAlcove";
  rightBaffle.position.set(initialCompanionX + 0.06, 1.19, -1.18);
  rightBaffle.rotation.y = -0.12;
  rightBaffle.renderOrder = 3;
  rightBaffle.add(
    new THREE.LineSegments(
      new THREE.EdgesGeometry(rightBaffleGeo),
      baffleEdgeVioletMat,
    ),
  );
  root.add(rightBaffle);

  // -------------------------------------------------------------------------
  // 7. Companion Ground Contact Shadow & Plinth Seam
  // -------------------------------------------------------------------------
  const shadowTexture = createContactShadowTexture();
  let contactShadow: THREE.Mesh | null = null;
  if (shadowTexture) {
    const shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTexture,
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
    });
    contactShadow = new THREE.Mesh(
      new THREE.PlaneGeometry(0.98, 0.98),
      shadowMat,
    );
    contactShadow.name = "CompanionContactShadow";
    contactShadow.rotation.x = -Math.PI / 2;
    contactShadow.position.set(initialCompanionX, 0.003, initialCompanionZ);
    contactShadow.renderOrder = 2;
    root.add(contactShadow);
  }

  const plinthRingMat = new THREE.MeshBasicMaterial({
    color: 0x9185d9,
    transparent: true,
    opacity: 0.22,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const plinthRing = new THREE.Mesh(
    new THREE.RingGeometry(0.46, 0.472, 64),
    plinthRingMat,
  );
  plinthRing.name = "CompanionPlinthSeam";
  plinthRing.rotation.x = -Math.PI / 2;
  plinthRing.position.set(initialCompanionX, 0.004, initialCompanionZ);
  plinthRing.renderOrder = 2;
  root.add(plinthRing);

  const companionAnchor = new THREE.Vector3(
    initialCompanionX,
    0,
    initialCompanionZ,
  );

  function setCompanionPosition(x: number, z: number) {
    companionAnchor.set(x, 0, z);
    if (contactShadow) {
      contactShadow.position.set(x, 0.003, z);
    }
    plinthRing.position.set(x, 0.004, z);
    rightBaffle.position.x = x + 0.06;
  }

  function updateAmbient(elapsed: number, entranceProgress: number) {
    const e = THREE.MathUtils.clamp(entranceProgress, 0, 1);
    violetStripMat.opacity = (0.36 + Math.sin(elapsed * 0.9) * 0.06) * e;
    roseStripMat.opacity = (0.28 + Math.cos(elapsed * 0.75) * 0.05) * e;
    plinthRing.rotation.z = elapsed * 0.035;
  }

  function dispose() {
    if (shadowTexture) {
      shadowTexture.dispose();
    }
    disposeObject3D(root);
    // Also dispose LineSegments / Non-Mesh geometries explicitly
    root.traverse((obj) => {
      const anyObj = obj as {
        geometry?: THREE.BufferGeometry;
        material?: THREE.Material | THREE.Material[];
      };
      anyObj.geometry?.dispose();
      if (anyObj.material) {
        const mats = Array.isArray(anyObj.material)
          ? anyObj.material
          : [anyObj.material];
        for (const m of mats) {
          m.dispose();
        }
      }
    });
  }

  return {
    root,
    dimensions: dims,
    companionAnchor,
    contactShadow,
    violetStripMat,
    roseStripMat,
    glassBaffles: [leftBaffle, rightBaffle],
    setCompanionPosition,
    updateAmbient,
    dispose,
  };
}
