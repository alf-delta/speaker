import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { CONFIG } from './config.js';

// Helper: Create stylish dimension line
export function createDimension(start, end, text, offset) {
    const group = new THREE.Group();

    // 1. Calculate points with offset
    const p1 = new THREE.Vector3().copy(start).add(offset);
    const p2 = new THREE.Vector3().copy(end).add(offset);

    // 2. Main Line
    const lineGeo = new THREE.BufferGeometry().setFromPoints([p1, p2]);
    const line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4 }));
    group.add(line);

    // 3. Ticks (Short perpendicular lines at ends)
    const tickH = 10; // Total height of tick
    // Assuming offset is typically Y-based for width dims, ticks go Y+-
    // But for general robustness, we might want ticks perpendicular to the line.
    // Simplifying for our specific use case (horizontal widths): ticks are vertical.

    const t1Points = [new THREE.Vector3(p1.x, p1.y - tickH / 2, p1.z), new THREE.Vector3(p1.x, p1.y + tickH / 2, p1.z)];
    const t2Points = [new THREE.Vector3(p2.x, p2.y - tickH / 2, p2.z), new THREE.Vector3(p2.x, p2.y + tickH / 2, p2.z)];

    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(t1Points), line.material));
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(t2Points), line.material));

    // 4. Label (HTML)
    const div = document.createElement('div');
    div.className = 'dimension-label';
    div.textContent = text;
    // Styling is best handled in CSS, but inline defaults ensure visibility
    div.style.color = 'white';
    div.style.fontFamily = '"Helvetica Neue", Helvetica, Arial, sans-serif';
    div.style.fontSize = '11px';
    div.style.fontWeight = '500';
    div.style.padding = '3px 6px';
    div.style.background = 'rgba(0,0,0,0.7)';
    div.style.borderRadius = '3px';
    div.style.pointerEvents = 'none';
    div.style.whiteSpace = 'nowrap';

    const label = new CSS2DObject(div);
    label.position.copy(p1).lerp(p2, 0.5);
    group.add(label);

    return group;
}

export class EnvironmentManager {
    constructor(scene, camera, controls, assemblyGroup) {
        this.scene = scene;
        this.camera = camera;
        this.controls = controls;
        this.assembly = assemblyGroup;
        this.currentEnvGroup = null;

        // Materials
        this.matFurniture = new THREE.MeshStandardMaterial({
            color: 0x222222,
            roughness: 0.9,
            metalness: 0.1
        });

        this.matScreen = new THREE.MeshStandardMaterial({
            color: 0x050505,
            roughness: 0.1,
            metalness: 0.2
        });

        this.matVase = new THREE.MeshStandardMaterial({
            color: 0x888888,
            roughness: 0.4,
            metalness: 0.0
        });
    }

    clearEnv() {
        if (this.currentEnvGroup) {
            // Explicitly cleanup CSS2DObjects to remove their DOM elements
            this.currentEnvGroup.traverse((child) => {
                if (child.isCSS2DObject) {
                    // CSS2DRenderer appends the element to the labelRenderer's domElement (or a container).
                    // We need to remove it manually if standard removal fails.
                    if (child.element && child.element.parentNode) {
                        child.element.parentNode.removeChild(child.element);
                    }
                }
            });
            this.scene.remove(this.currentEnvGroup);
            this.currentEnvGroup = null;
        }
        // Reset assembly position
        this.assembly.position.y = 0;
    }

    tweenCamera(targetPos, targetLookAt) {
        // Simple interpolation for now, or just snap. 
        // For a true smooth transition without TWEEN lib, we can just set it.
        // User requested smooth change, but without TWEEN lib in project, "lerp in animate" is complex to inject.
        // We will snap for MVP or use a basic step approach if needed.
        // Let's just snap and call controls.update() for now to ensure stability.
        this.camera.position.copy(targetPos);
        this.controls.target.copy(targetLookAt);
        this.controls.update();
    }

    setMode(mode) {
        this.clearEnv();
        const group = new THREE.Group();

        if (mode === 'studio') {
            // Default: Floor placement
            this.tweenCamera(new THREE.Vector3(0, 500, 2000), new THREE.Vector3(0, 0, 0));
        }
        else if (mode === 'tv') {
            // == TV MEDIA ZONE ==
            // Console: 2200 x 450 x 500
            const conW = 2200, conH = 450, conD = 500;
            const consoleMesh = new THREE.Mesh(new THREE.BoxGeometry(conW, conH, conD), this.matFurniture);
            // Floor is Y=0. Console sits on floor. Center Y = 225.
            consoleMesh.position.set(0, conH / 2, 0);
            consoleMesh.receiveShadow = true;
            consoleMesh.castShadow = true;
            group.add(consoleMesh);

            // TV: 65" (1450 x 830). Wall mounted.
            // TV: 65" (1450 x 830). Wall mounted.
            // Bottom edge must clear the speaker.
            // Speaker Top = ConsH (450) + Feet (55) + BoxH (330) = 835.
            // Let's set TV Bottom at 900 (65mm gap).
            // TV Center Y = 900 + 830/2 = 1315.
            const tvW = 1450, tvH = 830, tvD = 40;
            const tvPanel = new THREE.Mesh(new THREE.BoxGeometry(tvW, tvH, tvD), this.matScreen);
            // Wall Z? Console is 500 deep (Z -250 to +250). Wall is likely at -250.
            // Let's put wall at Z = -250. TV Center Z = -250 + 20 = -230.
            tvPanel.position.set(0, 1315, -230);
            group.add(tvPanel);

            // Assembly on console
            // FIX SINKING: Assembly origin is center. Must add half height + feet height.
            this.assembly.position.y = conH + CONFIG.box.h / 2 + CONFIG.feetH;

            // Dimensions
            // TV Width
            group.add(createDimension(
                new THREE.Vector3(-tvW / 2, 1315 + tvH / 2, -230),
                new THREE.Vector3(tvW / 2, 1315 + tvH / 2, -230),
                "65\" TV (145 cm)",
                new THREE.Vector3(0, 50, 0)
            ));



            // Camera Zoom Out
            this.tweenCamera(new THREE.Vector3(0, 1000, 3500), new THREE.Vector3(0, 600, 0));
        }
        else if (mode === 'sideboard') {
            // == SIDEBOARD ==
            // 1600 x 850 x 500
            const sbW = 1600, sbH = 850, sbD = 500;
            const sbMesh = new THREE.Mesh(new THREE.BoxGeometry(sbW, sbH, sbD), this.matFurniture);
            sbMesh.position.set(0, sbH / 2, 0);
            sbMesh.receiveShadow = true;
            sbMesh.castShadow = true;
            group.add(sbMesh);

            // Assembly on top
            this.assembly.position.y = sbH + CONFIG.box.h / 2 + CONFIG.feetH;

            // Vase for scale
            const vase = new THREE.Mesh(new THREE.CylinderGeometry(60, 80, 250, 32), this.matVase);
            vase.position.set(-750, sbH + 125, 0);
            vase.castShadow = true;
            group.add(vase);

            // Dims
            group.add(createDimension(
                new THREE.Vector3(-sbW / 2, sbH, 260),
                new THREE.Vector3(sbW / 2, sbH, 260),
                "Sideboard (160 cm)",
                new THREE.Vector3(0, 0, 50) // Z offset forward
            ));

            // Camera Zoom Out
            this.tweenCamera(new THREE.Vector3(0, 1200, 3000), new THREE.Vector3(0, 850, 0));
        }

        this.currentEnvGroup = group;
        this.scene.add(group);
    }
}
