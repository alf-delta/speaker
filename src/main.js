import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { EnvironmentManager } from './environments.js';
import { CONFIG, DRV, PAD } from './config.js';

import { createMaterials } from './materials.js';

const frontZ = CONFIG.box.d / 2;
const listenerPos = new THREE.Vector3(
    CONFIG.listener.x,
    CONFIG.listener.y,
    frontZ + CONFIG.listenerDist
);

function yawToListener(x, z = frontZ) {
    const dx = listenerPos.x - x;
    const dz = listenerPos.z - z;
    return THREE.MathUtils.radToDeg(Math.atan2(dx, dz));
}

function distanceToListener(x, z = frontZ) {
    const dx = listenerPos.x - x;
    const dz = listenerPos.z - z;
    return Math.hypot(dx, dz);
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function computeLayout() {
    const halfW = CONFIG.box.w / 2;
    const halfH = CONFIG.box.h / 2;
    const edge = CONFIG.edgeClearance;
    const partitionOuter = CONFIG.bassChamberWidth / 2 + CONFIG.partition;

    const midPadHalfW = PAD.mid.w / 2;
    const midPadHalfH = PAD.mid.h / 2;
    const tweetPadHalfW = PAD.tweeter.w / 2;
    const tweetPadHalfH = PAD.tweeter.h / 2;

    const midRange = {
        min: -halfW + edge + midPadHalfW,
        max: -partitionOuter - midPadHalfW
    };

    const midX = clamp(midRange.max, midRange.min, midRange.max);

    // Position relative to internal walls (10mm margin)
    // Mid (Bottom): -halfH + wall + 10mm + radius
    const midY = -halfH + CONFIG.wall + 10 + DRV.mid.od / 2;

    // Tweeter (Top): halfH - wall - 10mm - halfHeight
    const tweetY = halfH - CONFIG.wall - 10 - DRV.tweeter.h / 2;

    const ambX = -halfW + CONFIG.wall + CONFIG.ambientEdgeGap + PAD.ambient.w / 2;
    const ambY = 0;
    const ambZ = frontZ - CONFIG.baffleInset;

    const left = {
        mid: { x: midX, y: midY },
        tweeter: { x: midX, y: tweetY },
        ambient: { x: ambX, y: ambY, z: ambZ }
    };

    const right = {
        mid: { x: -left.mid.x, y: left.mid.y },
        tweeter: { x: -left.tweeter.x, y: left.tweeter.y },
        ambient: { x: -left.ambient.x, y: left.ambient.y, z: left.ambient.z }
    };

    return { left, right };
}

const LAYOUT = computeLayout();

// === SCENE SETUP ===
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xdddddd);
scene.fog = new THREE.Fog(0xdddddd, 2000, 5000);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 10, 10000);
camera.position.set(0, 400, 900);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio || 1);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.toneMappingExposure = 1.1;
renderer.physicallyCorrectLights = true;
document.body.appendChild(renderer.domElement);

// --- LABEL RENDERER (CSS2D) ---
const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(window.innerWidth, window.innerHeight);
labelRenderer.domElement.style.position = 'absolute';
labelRenderer.domElement.style.top = '0px';
labelRenderer.domElement.style.pointerEvents = 'none'; // Cliks pass through
document.body.appendChild(labelRenderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.maxDistance = 4000;
controls.minDistance = 400;

const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.25,
    0.6,
    0.85
);
composer.addPass(bloomPass);

const fxaaPass = new ShaderPass(FXAAShader);
composer.addPass(fxaaPass);

function updateComposerSize() {
    const pixelRatio = renderer.getPixelRatio();
    composer.setSize(window.innerWidth, window.innerHeight);
    fxaaPass.material.uniforms['resolution'].value.set(
        1 / (window.innerWidth * pixelRatio),
        1 / (window.innerHeight * pixelRatio)
    );
}
updateComposerSize();

// === LIGHTING ===
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const ambientLight = new THREE.AmbientLight(0xffffff, 0.35);
scene.add(ambientLight);

const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
keyLight.position.set(600, 900, 1200);
keyLight.castShadow = true;
keyLight.shadow.mapSize.width = 2048;
keyLight.shadow.mapSize.height = 2048;
keyLight.shadow.camera.near = 200;
keyLight.shadow.camera.far = 3000;
keyLight.shadow.camera.left = -800;
keyLight.shadow.camera.right = 800;
keyLight.shadow.camera.top = 800;
keyLight.shadow.camera.bottom = -800;
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0xffffff, 0.8);
fillLight.position.set(-900, 600, 500);
scene.add(fillLight);

const bottomLight = new THREE.PointLight(0xffffff, 0.7);
bottomLight.position.set(0, -220, 0);
scene.add(bottomLight);

import { createSubRSS210, createMidRS125, createTweeterRST28, createCoaxCX120, createPRDS315, makeWindowBrace } from './drivers.js';

// ... (retain materials and scene setup)

// === MATERIALS ===
const materials = createMaterials(THREE);
const {
    matCabinet,
    matRubber,
    matConeBlack,
    matConeAlum,
    matPhasePlug,
    matMetal,
    matFabric,
    matFastener,
    matAccent,
    matPartition,
    matPad,
    matGrille,
    matFrame,
    matWall
} = materials;

// Move makeWindowBrace to helpers if needed, or keeping local if unique to box. 
// Actually makeWindowBrace is used for assembly, not generic driver. Keep it here or move to drivers/helpers if shared.
// For now I will keep local assembly helpers unless they conflict.

// Need to remove old HELPERS and DRIVERS sections from here.

function makeCurvedPanel(width, depth, sagitta, thickness, mat) {
    // ... (Keep this local as it's box specific)
    const halfW = width / 2;
    const frontZ = depth / 2;
    const backZ = -depth / 2;
    const radius = (width * width) / (8 * sagitta) + sagitta / 2;
    const angle = Math.asin(halfW / radius);
    const centerZ = frontZ - (radius - sagitta);

    const shape = new THREE.Shape();
    shape.moveTo(-halfW, backZ);
    shape.lineTo(halfW, backZ);
    shape.lineTo(halfW, frontZ);
    shape.absarc(0, centerZ, radius, Math.PI / 2 - angle, Math.PI / 2 + angle, false);
    shape.lineTo(-halfW, backZ);

    const geo = new THREE.ExtrudeGeometry(shape, {
        depth: thickness,
        bevelEnabled: false,
        curveSegments: 64
    });
    geo.translate(0, 0, -thickness / 2);
    geo.rotateX(Math.PI / 2);
    return new THREE.Mesh(geo, mat);
}

function makeBeveledSideWall(side, bevelDepth, mat) {
    // ... (Keep local)
    const geo = new THREE.BoxGeometry(CONFIG.wall, CONFIG.box.h, CONFIG.box.d);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const z = pos.getZ(i);
        const isFront = z > 0;
        const isOuter = side === 'left' ? x < 0 : x > 0;
        if (isFront && isOuter) {
            pos.setZ(i, z - bevelDepth);
        }
    }
    geo.computeVertexNormals();
    return new THREE.Mesh(geo, mat);
}

// === ASSEMBLY ===
const assembly = new THREE.Group();
scene.add(assembly);

const cabGeo = new RoundedBoxGeometry(CONFIG.box.w, CONFIG.box.h, CONFIG.box.d, 6, 12);
const cabinet = new THREE.Mesh(cabGeo, matCabinet);
cabinet.visible = false;
assembly.add(cabinet);

const frontRadius = (CONFIG.box.w * CONFIG.box.w) / (8 * CONFIG.frontSagitta) + CONFIG.frontSagitta / 2;
const frontAngle = 2 * Math.asin((CONFIG.box.w / 2) / frontRadius);
const frontZCenter = frontZ - (frontRadius - CONFIG.frontSagitta);

// Curved front shell (round face)
const shellThickness = CONFIG.wall;
const shellOuter = frontRadius + shellThickness;
const shellGeo = new THREE.CylinderGeometry(
    shellOuter,
    shellOuter,
    CONFIG.box.h,
    80,
    1,
    true,
    Math.PI / 2 - frontAngle / 2,
    frontAngle
);
const shell = new THREE.Mesh(shellGeo, matCabinet);
shell.position.set(0, 0, frontZCenter);
shell.castShadow = true;
shell.receiveShadow = true;
shell.visible = CONFIG.showFrontShell;
assembly.add(shell);

const frameGeo = new THREE.CylinderGeometry(
    frontRadius + CONFIG.frontFrameThickness,
    frontRadius + CONFIG.frontFrameThickness,
    CONFIG.box.h,
    80,
    1,
    true,
    Math.PI / 2 - frontAngle / 2,
    frontAngle
);
const frame = new THREE.Mesh(frameGeo, matFrame);
frame.position.set(0, 0, frontZCenter);
frame.castShadow = true;
frame.receiveShadow = true;
assembly.add(frame);

const grilleGeo = new THREE.CylinderGeometry(
    frontRadius + CONFIG.frontFrameThickness + CONFIG.grilleThickness,
    frontRadius + CONFIG.frontFrameThickness + CONFIG.grilleThickness,
    CONFIG.box.h - 6,
    80,
    1,
    true,
    Math.PI / 2 - frontAngle / 2,
    frontAngle
);
const grille = new THREE.Mesh(grilleGeo, matGrille);
grille.position.set(0, 0, frontZCenter + 4);
grille.castShadow = true;
grille.receiveShadow = true;
grille.visible = CONFIG.showGrille;
assembly.add(grille);

const internalW = CONFIG.box.w - 2 * CONFIG.wall;
const internalH = CONFIG.box.h - 2 * CONFIG.wall;
const internalD = CONFIG.box.d - 2 * CONFIG.wall;

// Mitered Panel Generator (Trapezoidal Thickness)
// growDir: 1 = grows to Right (Positive X), -1 = grows to Left (Negative X)
function makeTrapezoidalPanel(width, height, thickness, holes, mat, miterOffset, growDir) {
    const shape = new THREE.Shape();
    // Origin is at the Hinge Edge (Vertical X=0).
    const w = width * growDir;
    const halfH = height / 2;

    // Front Face (Rectangle)
    // Points: (0, -h/2), (w, -h/2), (w, h/2), (0, h/2)
    shape.moveTo(0, -halfH);
    shape.lineTo(w, -halfH);
    shape.lineTo(w, halfH);
    shape.lineTo(0, halfH);
    shape.closePath();

    holes.forEach(blob => {
        const holePath = new THREE.Path();
        const r = blob.r;
        // Holes are currently centered relative to panel geometric center.
        // We need to shift them to be relative to the Hinge.
        // If growDir=1 (Right), CenterX = width/2.
        // If growDir=-1 (Left), CenterX = -width/2.
        // But hole configs in main.js assume X=0 is center. 
        // So HoleX_local = CenterX + blob.x
        const centerX = (width / 2) * growDir;
        const x = centerX + (blob.x || 0);
        const y = blob.y || 0;
        holePath.absarc(x, y, r, 0, Math.PI * 2, true);
        shape.holes.push(holePath);
    });

    const geo = new THREE.ExtrudeGeometry(shape, {
        depth: thickness,
        bevelEnabled: false,
        curveSegments: 64
    });
    // Extrude creates Z=0 to Z=thickness.
    // We want Back Face to be at Z=thickness. Front at Z=0. 
    // Wait, usually we center extrusion? But user said "Use Hinge as (0,0)".
    // Let's keep Z=0 as Front Face.

    // Vertex Modification for Miter
    const posAttribute = geo.attributes.position;
    const posCount = posAttribute.count;
    const vertex = new THREE.Vector3();

    for (let i = 0; i < posCount; i++) {
        vertex.fromBufferAttribute(posAttribute, i);
        // Check if Vertex is on Back Face (Z approx thickness)
        if (Math.abs(vertex.z - thickness) < 0.1) {
            // Check if Vertex is on Hinge Edge (X approx 0)
            if (Math.abs(vertex.x) < 0.1) {
                // Apply Offset
                // If growDir=1 (Right), shift Right (+).
                // If growDir=-1 (Left), shift Left (-).
                vertex.x += miterOffset * growDir;
                posAttribute.setX(i, vertex.x);
            }
        }
    }

    geo.computeVertexNormals();
    return new THREE.Mesh(geo, mat);
}

// Carcass panels (butt joints with dados for partitions)
const panelGroup = new THREE.Group();
const wallX = CONFIG.box.w / 2 - CONFIG.wall / 2;
const wallY = CONFIG.box.h / 2 - CONFIG.wall / 2;
const wallZ = CONFIG.box.d / 2 - CONFIG.wall / 2;

const halfInternalW = internalW / 2;
const arcRadius = (internalW * internalW) / (8 * CONFIG.topBottomSagitta) + CONFIG.topBottomSagitta / 2;
const slopeAtEdge = halfInternalW / Math.sqrt(arcRadius * arcRadius - halfInternalW * halfInternalW);
const autoBevelDepth = CONFIG.wall * slopeAtEdge;
const bevelDepth = Math.min(CONFIG.sideBevelDepth, autoBevelDepth);

const leftWall = makeBeveledSideWall('left', bevelDepth, matWall);
leftWall.position.set(-wallX, 0, 0);
panelGroup.add(leftWall);

const rightWall = makeBeveledSideWall('right', bevelDepth, matWall);
rightWall.position.set(wallX, 0, 0);
panelGroup.add(rightWall);

const topPanel = makeCurvedPanel(internalW, CONFIG.box.d, CONFIG.topBottomSagitta, CONFIG.wall, matWall);
topPanel.position.set(0, wallY, 0);
panelGroup.add(topPanel);

const bottomPanel = makeCurvedPanel(internalW, CONFIG.box.d, CONFIG.topBottomSagitta, CONFIG.wall, matWall);
bottomPanel.position.set(0, -wallY, 0);
panelGroup.add(bottomPanel);

const backWall = new THREE.Mesh(new THREE.BoxGeometry(internalW, internalH, CONFIG.wall), matWall);
backWall.position.set(0, 0, -wallZ);
panelGroup.add(backWall);

const baffleZ = frontZ - CONFIG.baffleInset - CONFIG.wall / 2;
const partitionOuterEdge = CONFIG.bassChamberWidth / 2 + CONFIG.partition;
const centerBaffleW = CONFIG.bassChamberWidth + 2 * CONFIG.partition;
// --- SUBWOOFER CUTOUT FIX ---
// The subwoofer was inside the solid block. We now create a hole.
const centerHoles = [{ y: 0, r: DRV.sub.cutout / 2 }];
// Center Baffle uses standard perforated panel (no miter needed, or simple)
// Let's restore simple helper if needed, or use Trapezoid with offset 0.
const centerBaffle = makeTrapezoidalPanel(centerBaffleW, internalH, CONFIG.wall, centerHoles, matWall, 0, 1);
// Centering: Origin is Left Edge. Position X = -Width/2.
centerBaffle.position.set(-centerBaffleW / 2, 0, baffleZ);
panelGroup.add(centerBaffle);

const splitLeftX = (LAYOUT.left.mid.x + LAYOUT.left.ambient.x) / 2;
const splitRightX = (LAYOUT.right.mid.x + LAYOUT.right.ambient.x) / 2;
const leftLeadW = Math.abs(splitLeftX + partitionOuterEdge);
const leftAmbW = Math.abs(-internalW / 2 - splitLeftX);
const rightLeadW = Math.abs(splitRightX - partitionOuterEdge);
const rightAmbW = Math.abs(internalW / 2 - splitRightX);

const leftLeadYaw = yawToListener(LAYOUT.left.mid.x, frontZ);
const rightLeadYaw = yawToListener(LAYOUT.right.mid.x, frontZ);
const leftAmbientYaw = -CONFIG.ambientOutDeg;
const rightAmbientYaw = CONFIG.ambientOutDeg;

const leftLeadHoles = [
    { y: LAYOUT.left.mid.y, r: DRV.mid.cutout / 2 },
    { y: LAYOUT.left.tweeter.y, r: DRV.tweeter.cutout / 2 } // Tweeter cutout
];
const leftAmbientHoles = [{ y: 0, r: DRV.ambient.cutout / 2 }];

const rightLeadHoles = [
    { y: LAYOUT.right.mid.y, r: DRV.mid.cutout / 2 },
    { y: LAYOUT.right.tweeter.y, r: DRV.tweeter.cutout / 2 }
];
const rightAmbientHoles = [{ y: 0, r: DRV.ambient.cutout / 2 }];

// --- MITER CALCULATION ---
const refYaw = Math.abs(leftLeadYaw); // approx 6 deg
const ambYaw = Math.abs(leftAmbientYaw); // approx 12-20 deg
const angleDiff = Math.abs(refYaw - ambYaw);
const halfAngle = THREE.MathUtils.degToRad(angleDiff / 2);
const miterOffset = CONFIG.wall * Math.tan(halfAngle);

// LEFT SIDE
// Split Point X is the Hinge
const hingeLeftX = splitLeftX;
// Left Lead: Grows Right (from hinge towards center). Rotated by leftLeadYaw.
const leftLeadBaffle = makeTrapezoidalPanel(leftLeadW, internalH, CONFIG.wall, leftLeadHoles, matWall, miterOffset, 1);
leftLeadBaffle.position.set(hingeLeftX, 0, baffleZ);
leftLeadBaffle.rotation.y = THREE.MathUtils.degToRad(leftLeadYaw);
panelGroup.add(leftLeadBaffle);

// Left Ambient: Grows Left (from hinge towards edge). Rotated by leftAmbientYaw.
const leftAmbientBaffle = makeTrapezoidalPanel(leftAmbW, internalH, CONFIG.wall, leftAmbientHoles, matWall, miterOffset, -1);
leftAmbientBaffle.position.set(hingeLeftX, 0, baffleZ);
leftAmbientBaffle.rotation.y = THREE.MathUtils.degToRad(leftAmbientYaw);
panelGroup.add(leftAmbientBaffle);

// RIGHT SIDE
// Split Point X is the Hinge
const hingeRightX = splitRightX;

// Right Lead: Grows Left (from hinge towards center). Rotated by rightLeadYaw.
// Hinge is at its RIGHT edge. GrowDir = -1.
// Miter Offset: moves Back Hinge Left (-).
const rightLeadBaffle = makeTrapezoidalPanel(rightLeadW, internalH, CONFIG.wall, rightLeadHoles, matWall, miterOffset, -1);
rightLeadBaffle.position.set(hingeRightX, 0, baffleZ);
rightLeadBaffle.rotation.y = THREE.MathUtils.degToRad(rightLeadYaw);
panelGroup.add(rightLeadBaffle);

// Right Ambient: Grows Right (from hinge towards edge). Rotated by rightAmbientYaw.
const rightAmbientBaffle = makeTrapezoidalPanel(rightAmbW, internalH, CONFIG.wall, rightAmbientHoles, matWall, miterOffset, 1);
rightAmbientBaffle.position.set(hingeRightX, 0, baffleZ);
rightAmbientBaffle.rotation.y = THREE.MathUtils.degToRad(rightAmbientYaw);
panelGroup.add(rightAmbientBaffle);

panelGroup.traverse((child) => {
    if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
    }
});
assembly.add(panelGroup);

// Front "balcony" rails (top/bottom) for grille mounting
// REMOVED: Caused Z-fighting with TopPanel and occluded Tweeter when moved down.
//The Top/Bottom panels already provide the necessary structure.
/*
const railDepth = CONFIG.wall;
const railHeight = 28;
const railWidth = internalW - 20;
const railZ = frontZ - railDepth / 2;
const topRail = new THREE.Mesh(new THREE.BoxGeometry(railWidth, railHeight, railDepth), matFrame);
topRail.position.set(0, CONFIG.box.h / 2 - CONFIG.wall - railHeight / 2, railZ);
assembly.add(topRail);

const bottomRail = new THREE.Mesh(new THREE.BoxGeometry(railWidth, railHeight, railDepth), matFrame);
bottomRail.position.set(0, -CONFIG.box.h / 2 + CONFIG.wall + railHeight / 2, railZ);
assembly.add(bottomRail);
*/

// Dados + partitions
const dadoDepth = 3;
const partitionOffset = CONFIG.bassChamberWidth / 2 + CONFIG.partition / 2;

// Precise physical planes
const zBackInner = -CONFIG.box.d / 2 + CONFIG.wall; // Inner face of back wall
const zBaffleRear = baffleZ - CONFIG.wall / 2;      // Rear face of front baffle
const internalGap = zBaffleRear - zBackInner;

// Partition physically enters the wall by dadoDepth on both sides
const partitionDepth = internalGap + 2 * dadoDepth;
const partitionZ = zBackInner + internalGap / 2;

const partitionGeo = new THREE.BoxGeometry(CONFIG.partition, internalH, partitionDepth);
[-1, 1].forEach((side) => {
    const partition = new THREE.Mesh(partitionGeo, matPartition);
    partition.position.set(side * partitionOffset, 0, partitionZ);
    partition.castShadow = true;
    partition.receiveShadow = true;
    assembly.add(partition);
});

// === NEW SEPTUMS for 6L Limit ===
// Target Volume: 6L. 
// Height: internalH (~250mm). 
// Width: Approx sideW (~312mm).
// Required Depth: 6000000 / (250 * 312) = ~77mm.
// Position: Behind the baffle.
// Baffle Front Face is roughly at baffleZ. 
// Baffle Back Face is approx baffleZ - CONFIG.wall.
// Septum Front Face should be at (baffleZ - CONFIG.wall - 77).
// Septum Center Z = (baffleZ - CONFIG.wall - 77) - (CONFIG.partition / 2).

const targetVolLiters = 6;
const estimatedSideW = (CONFIG.box.w - 2 * CONFIG.wall - CONFIG.bassChamberWidth - 2 * CONFIG.partition) / 2;
const requiredDepth = (targetVolLiters * 1e6) / (internalH * estimatedSideW); // ~77 mm

const septumZ = (baffleZ - CONFIG.wall) - requiredDepth - (CONFIG.partition / 2);

// Septum Width needs to span from Outer Wall to Bass Partition.
// Outer Wall Inner Face X = +/- (wallX - CONFIG.wall/2) = +/- (550 - 40) = +/- 510.
// Bass Partition Outer Face X = +/- partitionOuterEdge = +/- (180 + 18) = +/- 198.
// Width = 510 - 198 = 312mm.
const septumWidth = estimatedSideW + 2 * dadoDepth; // Embed into walls
const septumGeo = new THREE.BoxGeometry(septumWidth, internalH, CONFIG.partition);

// Left Septum
const leftSeptum = new THREE.Mesh(septumGeo, matPartition);
// Center X = (LeftWallInner + PartitionOuter) / 2 = (-510 + -198) / 2 = -354.
const septumCenterX = (-(CONFIG.box.w / 2 - CONFIG.wall) + (-partitionOuterEdge)) / 2;
leftSeptum.position.set(septumCenterX, 0, septumZ);
leftSeptum.castShadow = true;
leftSeptum.receiveShadow = true;
assembly.add(leftSeptum);

// Right Septum
const rightSeptum = new THREE.Mesh(septumGeo, matPartition);
rightSeptum.position.set(-septumCenterX, 0, septumZ);
rightSeptum.castShadow = true;
rightSeptum.receiveShadow = true;
assembly.add(rightSeptum);


// === STATS CALCULATION ===
function updateStats() {
    // 1. External Dims
    const extW = CONFIG.box.w;
    const extH = CONFIG.box.h;
    const extD = CONFIG.box.d;

    // 2. Internal Dims (Approx)
    // Height
    const intH = extH - 2 * CONFIG.wall;

    // Depth (Avg)
    // zBackInner = -extD/2 + wall
    // zBaffleRear = baffleZ - wall/2
    // baffleZ = frontZ - inset - wall/2
    // frontZ = extD/2
    const frontZ = extD / 2;
    const baffleZ = frontZ - CONFIG.baffleInset - CONFIG.wall / 2;
    const zBaffleRear = baffleZ - CONFIG.wall; // Fixed: Back face is full wall thickness back? 
    // Actually baffleZ is center of panel if standard extrude. 
    // But we used makeTrapezoidalPanel which puts Origin at hinge. 
    // Assuming standard placement, let's treat Z dimensions consistently.

    // Sub Chamber (Rectangular approximation)
    const subW = CONFIG.bassChamberWidth;
    // Sub depth is full depth
    const zBackInner = -extD / 2 + CONFIG.wall;
    const subDepth = zBaffleRear - zBackInner;
    const volSub = (subW * intH * subDepth) / 1000000; // Liters

    // Side Chambers (Limited by Septum)
    // Depth is now fixed by requiredDepth calculation roughly
    // Actual depth = (zBaffleRear) - (septumZ + partition/2)
    // = (zBaffleRear) - (zBaffleRear - requiredDepth - partition/2 + partition/2) = requiredDepth
    const sideDepth = requiredDepth;

    const sideW = (extW - 2 * CONFIG.wall - subW - 2 * CONFIG.partition) / 2;
    const volSide = (sideW * intH * sideDepth) / 1000000;

    const statsHtml = `
        <div style="margin-top: 20px; border-top: 1px solid #444; padding-top: 10px;">
            <strong>System Specs:</strong><br>
            Dims: ${extW} x ${extH} x ${extD} mm<br>
            <br>
            <strong>Net Volumes (Est):</strong><br>
            Sub Chamber: ~${volSub.toFixed(1)} L (Full Depth)<br>
            Side Chamber: ~${volSide.toFixed(1)} L (Lim < 6L)<br>
            Side Depth: ~${sideDepth.toFixed(0)} mm
        </div>
    `;

    const infoPanel = document.getElementById('info');
    if (infoPanel) {
        // Check if stats already exist
        let statsDiv = document.getElementById('perf-stats');
        if (!statsDiv) {
            statsDiv = document.createElement('div');
            statsDiv.id = 'perf-stats';
            infoPanel.appendChild(statsDiv);
        }
        statsDiv.innerHTML = statsHtml;
    }
}

// Call stats update
updateStats();

const dadoMat = matAccent;
const dadoW = CONFIG.partition;
const dadoH = 3;

[-1, 1].forEach((side) => {
    const x = side * partitionOffset;

    // Top & Bottom Dados (running full length of partition insertion)
    // They represent the groove cut into top/bottom panels
    const tbDado = new THREE.Mesh(new THREE.BoxGeometry(dadoW, dadoH, partitionDepth), dadoMat);

    // Top
    const topDado = tbDado.clone();
    topDado.position.set(x, wallY - CONFIG.wall / 2 + dadoH / 2, partitionZ);
    panelGroup.add(topDado);

    // Bottom
    const bottomDado = tbDado.clone();
    bottomDado.position.set(x, -wallY + CONFIG.wall / 2 - dadoH / 2, partitionZ);
    panelGroup.add(bottomDado);

    // Back Dado (cut into back wall)
    // Positioned relative to back inner face, going deeper (negative Z)
    const backDado = new THREE.Mesh(new THREE.BoxGeometry(dadoW, internalH, dadoDepth), dadoMat);
    backDado.position.set(x, 0, zBackInner - dadoDepth / 2);
    panelGroup.add(backDado);

    // Front Dado (cut into baffle rear)
    // Positioned relative to baffle rear face, going deeper (positive Z)
    const frontDado = new THREE.Mesh(new THREE.BoxGeometry(dadoW, internalH, dadoDepth), dadoMat);
    frontDado.position.set(x, 0, zBaffleRear + dadoDepth / 2);
    panelGroup.add(frontDado);
});

const mountZ = baffleZ + CONFIG.wall / 2;

const braceW = CONFIG.bassChamberWidth - 2;
const braceH = internalH - 2 - DRV.pr.depth;
const brace = makeWindowBrace(braceW, braceH, 30, CONFIG.wall, matPartition);
const subBasketDepth = DRV.sub.depth - 20;
const subMagnetDepth = 26;
const subBackMost = mountZ + CONFIG.driverOffset - (subBasketDepth + 18 + subMagnetDepth / 2);
const braceDesiredZ = subBackMost - 40;
const braceMinZ = zBackInner + 10;
const braceMaxZ = zBaffleRear - 10;
const braceZ = clamp(braceDesiredZ, braceMinZ, braceMaxZ);
brace.position.set(0, 0, braceZ);
brace.castShadow = true;
brace.receiveShadow = true;
assembly.add(brace);

const footGeo = new THREE.CylinderGeometry(15, 10, CONFIG.feetH, 16);
const footMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
const fx = CONFIG.box.w / 2 - 40;
const fz = CONFIG.box.d / 2 - 40;
const fy = -CONFIG.box.h / 2 - CONFIG.feetH / 2;

[{ x: fx, z: fz }, { x: -fx, z: fz }, { x: fx, z: -fz }, { x: -fx, z: -fz }].forEach((pos) => {
    const foot = new THREE.Mesh(footGeo, footMat);
    foot.position.set(pos.x, fy, pos.z);
    foot.castShadow = true;
    foot.receiveShadow = true;
    assembly.add(foot);
});

function createLaser(length) {
    const points = [];
    points.push(new THREE.Vector3(0, 0, 0));
    points.push(new THREE.Vector3(0, 0, length));
    const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
    const line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: 0xff0000, opacity: 0.5, transparent: true }));
    return line;
}

function enableShadows(object) {
    object.traverse((child) => {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
        }
    });
}

function placeDriverAt(object, parent, x, y, z, yawDeg = 0, isLaser = false) {
    const wrapper = new THREE.Group();
    // Use local coordinates relative to the parent
    wrapper.position.set(x, y, z);
    // Apply local rotation (usually 0 if parent is already rotated)
    wrapper.rotation.y = THREE.MathUtils.degToRad(yawDeg);

    enableShadows(object);
    wrapper.add(object);

    if (isLaser) {
        // Laser needs Global Z distance roughly. 
        // Approximating distance based on Z=0 local means Z=ParentZ global.
        // For simplicity, using a fixed length or omitting dynamic length calculation for now
        // to avoid complex global world matrix updates in this function.
        const laser = createLaser(CONFIG.listenerDist);
        wrapper.add(laser);
    }

    // Add to specific parent (e.g. the baffle mesh)
    parent.add(wrapper);
}



// FIX: Gap visible at wall+offset. Trying flush mount (wall thickness).
const driverZ = CONFIG.wall;

// Subwoofer (Attached to centerBaffle)
// Local X/Y=0 (Center of baffle), Local Z=driverZ (Front face + offset)
// FIX: Center Baffle origin is Left Edge. Driver should be at width/2.
placeDriverAt(createSubRSS210(materials), centerBaffle, centerBaffleW / 2, 0, driverZ, 0, false);

// LEFT CHANNEL (Attached to leftLeadBaffle)
// Local X should be width/2 because Origin is Hinge and grows Right (1).
placeDriverAt(createMidRS125(materials), leftLeadBaffle, leftLeadW / 2, LAYOUT.left.mid.y, driverZ, 0, true);
placeDriverAt(createTweeterRST28(materials), leftLeadBaffle, leftLeadW / 2, LAYOUT.left.tweeter.y, driverZ, 0, true);

// RIGHT CHANNEL (Attached to rightLeadBaffle)
// Right Lead grows Left (-1). Origin is Hinge. Center is at -width/2.
placeDriverAt(createMidRS125(materials), rightLeadBaffle, -rightLeadW / 2, LAYOUT.right.mid.y, driverZ, 0, true);
placeDriverAt(createTweeterRST28(materials), rightLeadBaffle, -rightLeadW / 2, LAYOUT.right.tweeter.y, driverZ, 0, true);

// AMBIENT CHANNELS (Attached to Ambient Baffles)
// Ambient driver is at Y=0 locally (center of ambient baffle)
// Left Ambient: Grows Left (-1). Center is -width/2.
placeDriverAt(createCoaxCX120(materials), leftAmbientBaffle, -leftAmbW / 2, 0, driverZ, 0, true);
// Right Ambient: Grows Right (1). Center is width/2.
placeDriverAt(createCoaxCX120(materials), rightAmbientBaffle, rightAmbW / 2, 0, driverZ, 0, true);

const prObj = createPRDS315(materials);
const prWrapper = new THREE.Group();
prWrapper.position.set(0, -CONFIG.box.h / 2, 0);
prWrapper.rotation.x = Math.PI / 2;
enableShadows(prObj);
prWrapper.add(prObj);
assembly.add(prWrapper);

const head = new THREE.Group();
const headGeo = new THREE.SphereGeometry(28, 24, 18);
const headMat = new THREE.MeshStandardMaterial({ color: 0x8fbf9f, roughness: 0.6, metalness: 0.0 });
const headMesh = new THREE.Mesh(headGeo, headMat);
headMesh.position.y = 28;
head.add(headMesh);

const neckGeo = new THREE.CylinderGeometry(10, 12, 20, 16);
const neck = new THREE.Mesh(neckGeo, headMat);
neck.position.y = 10;
head.add(neck);

head.position.copy(listenerPos);
scene.add(head);

const floorY = fy - CONFIG.feetH / 2;
const floorGeo = new THREE.PlaneGeometry(5000, 5000);
const floorMat = new THREE.MeshStandardMaterial({ color: 0xbfbfbf, roughness: 0.9, metalness: 0.0 });
const floor = new THREE.Mesh(floorGeo, floorMat);
floor.rotation.x = -Math.PI / 2;
floor.position.y = floorY;
floor.receiveShadow = true;
scene.add(floor);

const grid = new THREE.GridHelper(5000, 50, 0x999999, 0xdcdcdc);
grid.position.y = floorY + 0.1;
scene.add(grid);

const blueprintGrid = new THREE.GridHelper(5000, 80, 0x2b6d98, 0x1a3c57);
blueprintGrid.position.y = floorY + 0.1;
blueprintGrid.visible = false;
scene.add(blueprintGrid);

const blueprint = new THREE.Group();
const blueprintMat = new THREE.LineBasicMaterial({ color: 0x7cd0ff, transparent: true, opacity: 0.95 });
blueprint.visible = false;
scene.add(blueprint);

function buildBlueprint() {
    assembly.updateWorldMatrix(true, true);
    assembly.traverse((child) => {
        if (!child.isMesh || !child.geometry) return;
        const edgesGeo = new THREE.EdgesGeometry(child.geometry, 25);
        const line = new THREE.LineSegments(edgesGeo, blueprintMat);
        line.matrix.copy(child.matrixWorld);
        line.matrixAutoUpdate = false;
        blueprint.add(line);
    });
}
buildBlueprint();

const normalBackground = scene.background instanceof THREE.Color ? scene.background.clone() : scene.background;
const normalEnvironment = scene.environment;
const normalFog = scene.fog;
const normalExposure = renderer.toneMappingExposure;
const normalBloom = bloomPass.strength;
const blueprintBackground = new THREE.Color(0x0b1f33);

function setBlueprintMode(enabled) {
    assembly.visible = !enabled;
    blueprint.visible = enabled;
    grid.visible = !enabled;
    floor.visible = !enabled;
    blueprintGrid.visible = enabled;
    head.visible = !enabled;
    scene.background = enabled ? blueprintBackground : normalBackground;
    scene.environment = enabled ? null : normalEnvironment;
    scene.fog = enabled ? new THREE.Fog(0x0b1f33, 900, 5200) : normalFog;
    renderer.toneMappingExposure = enabled ? 1.15 : normalExposure;
    bloomPass.strength = enabled ? 0.05 : normalBloom;
}

const blueprintBtn = document.getElementById('toggleBlueprint');
let blueprintEnabled = false;
blueprintBtn.addEventListener('click', () => {
    blueprintEnabled = !blueprintEnabled;
    blueprintBtn.classList.toggle('active', blueprintEnabled);
    blueprintBtn.textContent = blueprintEnabled ? 'Render' : 'Blueprint';
    setBlueprintMode(blueprintEnabled);
});

window.addEventListener('keydown', (event) => {
    if (event.key.toLowerCase() === 'b') {
        blueprintBtn.click();
    }
});

// === ENVIRONMENT MANAGER ===
export const envManager = new EnvironmentManager(scene, camera, controls, assembly);

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    composer.render();
    labelRenderer.render(scene, camera);
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    labelRenderer.setSize(window.innerWidth, window.innerHeight);
    updateComposerSize();
});

animate();
