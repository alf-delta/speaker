import * as THREE from 'three';

export function createMaterials(THREE) {
    return {
        matCabinet: new THREE.MeshStandardMaterial({
            color: 0x3e3a35,
            roughness: 0.8,
            metalness: 0.1
        }),
        matWall: new THREE.MeshStandardMaterial({
            color: 0x4a4a4a,
            roughness: 0.9,
            metalness: 0.05
        }),
        matMetal: new THREE.MeshStandardMaterial({
            color: 0x1a1a1a,
            roughness: 0.4,
            metalness: 0.8,
            side: THREE.DoubleSide // <--- ВАЖНО: Рисуем и снаружи и внутри
        }),
        matConeAlum: new THREE.MeshStandardMaterial({
            color: 0x111111,
            roughness: 0.25,
            metalness: 0.7,
            side: THREE.DoubleSide
        }),
        matConeBlack: new THREE.MeshStandardMaterial({
            color: 0x050505,
            roughness: 0.6,
            metalness: 0.1,
            side: THREE.DoubleSide
        }),
        matRubber: new THREE.MeshStandardMaterial({
            color: 0x101010,
            roughness: 0.8,
            metalness: 0.0,
            side: THREE.DoubleSide
        }),
        matPhasePlug: new THREE.MeshStandardMaterial({
            color: 0x222222,
            roughness: 0.3,
            metalness: 0.9,
            side: THREE.DoubleSide
        }),
        matFabric: new THREE.MeshStandardMaterial({
            color: 0x0a0a0a,
            roughness: 0.9,
            metalness: 0.0,
            flatShading: false,
            side: THREE.DoubleSide
        }),
        matFastener: new THREE.MeshStandardMaterial({
            color: 0xaaaaaa,
            roughness: 0.3,
            metalness: 1.0
        }),
        matAccent: new THREE.MeshStandardMaterial({
            color: 0x333333,
            roughness: 0.5,
            side: THREE.DoubleSide
        }),
        matPartition: new THREE.MeshStandardMaterial({
            color: 0x8b5a2b, // MDF/Wood internal
            roughness: 0.9
        }),
        matPad: new THREE.MeshStandardMaterial({
            color: 0x222222,
            roughness: 0.5
        }),
        matGrille: new THREE.MeshStandardMaterial({
            color: 0x000000,
            transparent: true,
            opacity: 0.8
        }),
        matFrame: new THREE.MeshStandardMaterial({
            color: 0x111111,
            metalness: 0.8,
            roughness: 0.2
        })
    };
}
