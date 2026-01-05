import * as THREE from 'three';
import { DRV } from './config.js';

// === HELPERS (FIXED GEOMETRY) ===

/**
 * Создает профиль конуса и поворачивает его ЛИЦОМ к зрителю (Z+)
 */
function makeCurvedCone(innerR, outerR, depth, segments = 64, material) {
    const points = [];
    // Генерируем профиль (как бы лежа на боку)
    for (let i = 0; i <= 20; i++) {
        const t = i / 20;
        const x = innerR + (outerR - innerR) * t;
        const y = -depth * (1 - t * t * 0.6); // Изгиб
        points.push(new THREE.Vector2(x, y));
    }
    const geo = new THREE.LatheGeometry(points, segments);
    // Lathe создает вертикальную "вазу". Кладем её на бок, чтобы смотрела на нас.
    geo.rotateX(Math.PI / 2);
    return new THREE.Mesh(geo, material);
}

// Универсальное кольцо/фланец
export function makeRing(outerD, innerD, thickness, mat, segments = 64) {
    const shape = new THREE.Shape();
    shape.absarc(0, 0, outerD / 2, 0, Math.PI * 2, false);
    const hole = new THREE.Path();
    hole.absarc(0, 0, innerD / 2, 0, Math.PI * 2, true);
    shape.holes.push(hole);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, curveSegments: segments });
    geo.translate(0, 0, -thickness / 2); // Центрируем по Z
    return new THREE.Mesh(geo, mat);
}

// Винты
export function addScrewRing(group, radius, count, screwD, headH, z, mat) {
    const geo = new THREE.CylinderGeometry(screwD / 2, screwD / 2, headH, 12);
    geo.rotateX(Math.PI / 2); // Винт смотрит на нас
    for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2;
        const s = new THREE.Mesh(geo, mat);
        s.position.set(Math.cos(a) * radius, Math.sin(a) * radius, z);
        group.add(s);
    }
}

// Пластина твитера
export function makeRoundedRectPlate(w, h, r, thickness, mat) {
    const shape = new THREE.Shape();
    const x = -w / 2, y = -h / 2;
    shape.moveTo(x + r, y);
    shape.lineTo(x + w - r, y);
    shape.quadraticCurveTo(x + w, y, x + w, y + r);
    shape.lineTo(x + w, y + h - r);
    shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    shape.lineTo(x + r, y + h);
    shape.quadraticCurveTo(x, y + h, x, y + h - r);
    shape.lineTo(x, y + r);
    shape.quadraticCurveTo(x, y, x + r, y);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: true, bevelThickness: 0.5, bevelSize: 0.5, bevelSegments: 2 });
    geo.translate(0, 0, -thickness / 2);
    return new THREE.Mesh(geo, mat);
}

export function makeWindowBrace(w, h, frame, thickness, mat) {
    const shape = new THREE.Shape();
    shape.moveTo(-w / 2, -h / 2);
    shape.lineTo(w / 2, -h / 2);
    shape.lineTo(w / 2, h / 2);
    shape.lineTo(-w / 2, h / 2);
    shape.closePath();

    const hole = new THREE.Path();
    hole.moveTo(-w / 2 + frame, -h / 2 + frame);
    hole.lineTo(w / 2 - frame, -h / 2 + frame);
    hole.lineTo(w / 2 - frame, h / 2 - frame);
    hole.lineTo(-w / 2 + frame, h / 2 - frame);
    hole.closePath();
    shape.holes.push(hole);

    const geo = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, curveSegments: 8 });
    geo.translate(0, 0, -thickness / 2);
    return new THREE.Mesh(geo, mat);
}

// === DRIVER MODELS (FINAL) ===

// 1. RSS210HF-4 (Subwoofer) - Corrected Dustcap Size
export function createSubRSS210(materials) {
    const group = new THREE.Group();
    // DATASHEET: OD 213mm, Cutout 185mm
    const od = 213;
    const cutout = 185;
    const depth = 124;

    // Рама (Frame)
    group.add(makeRing(od, cutout - 4, 8, materials.matMetal).translateZ(2));

    // Подвес (Surround)
    const surroundRadius = (cutout / 2) - 10;
    // Толстый подвес для длиннохода
    const surround = new THREE.Mesh(
        new THREE.TorusGeometry(surroundRadius, 12, 32, 100),
        materials.matRubber
    );
    surround.position.z = 5;
    surround.scale.z = 1.1;
    group.add(surround);

    // Диффузор (Cone)
    const cone = makeCurvedCone(40, (cutout / 2) - 10, 35, 64, materials.matConeAlum);
    cone.position.z = -2;
    group.add(cone);

    // --- DUSTCAP FIX ---
    // Размер уменьшен до реалистичных ~105мм в диаметре (R=52.5) -> еще -20% = R 42
    // В оригинале он занимает около 55-60% площади диффузора.
    const capGeo = new THREE.SphereGeometry(42, 64, 32, 0, Math.PI * 2, 0, 1.4);
    capGeo.rotateX(Math.PI / 2); // Лицом к зрителю

    const cap = new THREE.Mesh(capGeo, materials.matConeAlum);
    cap.position.z = -14;
    cap.scale.set(1, 1, 0.7); // Сплюснутая сфера
    group.add(cap);

    // Магнит
    const mag = new THREE.Mesh(new THREE.CylinderGeometry(70, 70, 40, 32).rotateX(Math.PI / 2), materials.matAccent);
    mag.position.z = -depth + 20;
    group.add(mag);

    // Крепежные отверстия (6 шт)
    addScrewRing(group, od / 2 - 9, 6, 4.5, 2.5, 6.2, materials.matFastener);

    return group;
}

// 2. RS125-8 (Midrange)
export function createMidRS125(materials) {
    const group = new THREE.Group();
    const { od, cutout } = DRV.mid;

    group.add(makeRing(od, cutout - 2, 5, materials.matMetal).translateZ(1.5));

    // Подвес
    const surround = new THREE.Mesh(new THREE.TorusGeometry((cutout / 2) - 6, 6, 24, 64), materials.matRubber);
    surround.position.z = 2.5;
    group.add(surround);

    // Диффузор
    const cone = makeCurvedCone(10, (cutout / 2) - 6, 22, 64, materials.matConeAlum);
    cone.position.z = -1;
    group.add(cone);

    // Phase Plug FIX
    const plugPoints = [
        new THREE.Vector2(0, 0), new THREE.Vector2(8, 0),
        new THREE.Vector2(8, 12), new THREE.Vector2(0, 25)
    ];
    const plugGeo = new THREE.LatheGeometry(plugPoints, 32);
    plugGeo.rotateX(Math.PI / 2); // Поворот пули к зрителю

    const plug = new THREE.Mesh(plugGeo, materials.matPhasePlug);
    plug.position.z = -16;
    group.add(plug);

    addScrewRing(group, od / 2 - 8, 6, 3.5, 2, 4, materials.matFastener);

    // Закрываем задник магнитом
    const mag = new THREE.Mesh(new THREE.CylinderGeometry(40, 40, 30, 32).rotateX(Math.PI / 2), materials.matAccent);
    mag.position.z = -50;
    group.add(mag);

    return group;
}

// 3. RST28F-4 (Tweeter) - Corrected to ROUND Faceplate
export function createTweeterRST28(materials) {
    const group = new THREE.Group();
    // DATASHEET: OD 104.8mm, Cutout 73mm
    const od = 104.8;
    const cutout = 73;

    // --- FACEPLATE FIX: Теперь используем кольцо (круг), а не RoundedRect ---
    // Фланец толщиной 4мм
    const plate = new THREE.Mesh(
        new THREE.CylinderGeometry(od / 2, od / 2, 4, 64).rotateX(Math.PI / 2),
        materials.matMetal
    );
    plate.position.z = 2; // Центр толщины на Z=2 (чтобы лежал на поверхности 0..4)
    group.add(plate);

    // Небольшой волновод (углубление)
    // Визуальная имитация перехода к куполу
    const guide = new THREE.Mesh(
        new THREE.CylinderGeometry(25, 18, 4.1, 32, 1, true).rotateX(Math.PI / 2),
        materials.matMetal
    );
    guide.position.z = 2;
    group.add(guide);

    // Шелковый купол (1-1/8 inch = ~28mm dia => R=14)
    const domeGeo = new THREE.SphereGeometry(14, 32, 16, 0, Math.PI * 2, 0, 1.2);
    domeGeo.rotateX(Math.PI / 2); // Лицом к зрителю
    const dome = new THREE.Mesh(domeGeo, materials.matFabric);
    dome.position.z = 1.5; // Чуть утоплен относительно фланца
    group.add(dome);

    // Крепеж: 4 винта по кругу
    // RST28F-4 имеет 4 отверстия на диаметре окружности болтов (BCD) ~92мм (примерно)
    addScrewRing(group, (od / 2 + cutout / 2) / 2 + 2, 4, 3.5, 1.5, 4.1, materials.matFastener);

    // Задняя камера
    const chamD = 65;
    const chamber = new THREE.Mesh(new THREE.CylinderGeometry(chamD / 2, chamD / 2, 25, 32).rotateX(Math.PI / 2), materials.matAccent);
    chamber.position.z = -15;
    group.add(chamber);

    return group;
}

// 4. CX120-8 (Coax)
export function createCoaxCX120(materials) {
    const group = new THREE.Group();
    const { od, cutout } = DRV.ambient;

    group.add(makeRing(od, cutout - 2, 6, materials.matMetal).translateZ(3));

    const surround = new THREE.Mesh(new THREE.TorusGeometry((cutout / 2) - 6, 6, 20, 64), materials.matRubber);
    surround.position.z = 4;
    group.add(surround);

    // FIX GAP: Inner radius = 13
    const cone = makeCurvedCone(13, (cutout / 2) - 6, 25, 48, materials.matConeBlack);
    cone.position.z = -1;
    group.add(cone);

    // Стойка (Stalk) - теперь глубоко внутри, как на фото
    // Top at -10. Height 35. Pos = -10 - 17.5 = -27.5
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(12, 12, 35, 24).rotateX(Math.PI / 2), materials.matAccent);
    stalk.position.z = -27.5;
    group.add(stalk);

    // Корпус твитера (Кольцо вокруг купола)
    const housing = new THREE.Mesh(new THREE.CylinderGeometry(13, 12, 3, 32).rotateX(Math.PI / 2), materials.matMetal);
    housing.position.z = -10;
    group.add(housing);

    // Твитер
    const domeGeo = new THREE.SphereGeometry(9, 24, 12, 0, Math.PI * 2, 0, 1.4);
    domeGeo.rotateX(Math.PI / 2);
    const dome = new THREE.Mesh(domeGeo, materials.matFabric);
    // Recessed deep inside
    dome.position.z = -10;
    group.add(dome);

    addScrewRing(group, od / 2 - 7, 4, 3.5, 1.5, 6.1, materials.matFastener);
    return group;
}

// 5. DS315-PR
export function createPRDS315(materials) {
    const group = new THREE.Group();
    const { od, cutout } = DRV.pr;

    group.add(makeRing(od, od - 25, 6, materials.matMetal).translateZ(2));

    const surround = new THREE.Mesh(new THREE.TorusGeometry((cutout / 2) * 0.9, 18, 32, 96), materials.matRubber);
    surround.position.z = 4;
    group.add(surround);

    // Диск
    const disk = new THREE.Mesh(new THREE.CylinderGeometry((cutout / 2) * 0.9 - 5, (cutout / 2) * 0.9 - 5, 4, 64).rotateX(Math.PI / 2), materials.matConeBlack);
    disk.position.z = 4;
    group.add(disk);

    // Шайба
    const center = new THREE.Mesh(new THREE.CylinderGeometry(30, 30, 4.2, 32).rotateX(Math.PI / 2), materials.matAccent);
    center.position.z = 4.1;
    group.add(center);

    addScrewRing(group, od / 2 - 12, 8, 5, 2.5, 5.1, materials.matFastener);

    // Утяжелитель сзади
    group.add(new THREE.Mesh(new THREE.CylinderGeometry(50, 50, 20, 32).rotateX(Math.PI / 2), materials.matMetal).translateZ(-15));

    return group;
}