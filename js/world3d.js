// Procedurally generated 3D city: ground texture + instanced buildings/trees,
// plus the same grid collision model used by the gameplay code.
import * as THREE from './vendor/three.module.js';
import { clamp, hash2, pick, rectCorners } from './utils.js';

export const CELL = 14;
export const COLS = 20;
export const ROWS = 20;

const CELL_BUILDING = 0;
const CELL_ROAD = 1;
const CELL_PARK = 2;

const BUILDING_COLORS = [
  0x5b4a6b, 0x4a5b6b, 0x6b4a4f, 0x4a6b58,
  0x6b5e4a, 0x4a4a6b, 0x5e6b4a, 0x6b4a63,
];

export class World3D {
  constructor(scene) {
    this.scene = scene;
    this.cols = COLS;
    this.rows = ROWS;
    this.cell = CELL;
    this.width = COLS * CELL;
    this.height = ROWS * CELL;
    this.cells = [];
    this.roadCenters = [];
    this._generateGrid();
    this._buildGround();
    this._buildBuildings();
    this._buildTrees();
  }

  _generateGrid() {
    for (let row = 0; row < this.rows; row++) {
      const line = [];
      for (let col = 0; col < this.cols; col++) {
        let type;
        if (col % 4 === 0 || row % 4 === 0) {
          type = CELL_ROAD;
        } else {
          const h = hash2(col * 3 + 1, row * 7 + 2);
          type = h < 0.12 ? CELL_PARK : CELL_BUILDING;
        }
        const entry = { type, color: null, height: 0 };
        if (type === CELL_BUILDING) {
          const h2 = hash2(col * 11 + 5, row * 13 + 9);
          entry.color = BUILDING_COLORS[Math.floor(h2 * BUILDING_COLORS.length)];
          entry.height = 6 + Math.floor(h2 * 10) * 2 + (hash2(col, row) > 0.8 ? 10 : 0);
        }
        line.push(entry);
        if (type === CELL_ROAD) {
          this.roadCenters.push({
            x: col * CELL + CELL / 2,
            z: row * CELL + CELL / 2,
          });
        }
      }
      this.cells.push(line);
    }
  }

  _buildGround() {
    const cellPx = 16;
    const canvas = document.createElement('canvas');
    canvas.width = this.cols * cellPx;
    canvas.height = this.rows * cellPx;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#6b6f76';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        const c = this.cells[row][col];
        const x = col * cellPx;
        const y = row * cellPx;
        if (c.type === CELL_ROAD) {
          ctx.fillStyle = '#39393f';
          ctx.fillRect(x, y, cellPx, cellPx);
          ctx.strokeStyle = 'rgba(255,255,255,0.35)';
          ctx.lineWidth = 1;
          ctx.setLineDash([3, 3]);
          if (row % 4 === 0) {
            ctx.beginPath();
            ctx.moveTo(x, y + cellPx / 2);
            ctx.lineTo(x + cellPx, y + cellPx / 2);
            ctx.stroke();
          }
          if (col % 4 === 0) {
            ctx.beginPath();
            ctx.moveTo(x + cellPx / 2, y);
            ctx.lineTo(x + cellPx / 2, y + cellPx);
            ctx.stroke();
          }
          ctx.setLineDash([]);
        } else if (c.type === CELL_PARK) {
          ctx.fillStyle = '#2f5d3a';
          ctx.fillRect(x, y, cellPx, cellPx);
        }
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.colorSpace = THREE.SRGBColorSpace;

    const geo = new THREE.PlaneGeometry(this.width, this.height);
    const mat = new THREE.MeshStandardMaterial({ map: texture, roughness: 1 });
    const ground = new THREE.Mesh(geo, mat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(this.width / 2, 0, this.height / 2);
    this.scene.add(ground);
  }

  _buildBuildings() {
    const buildings = [];
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        const c = this.cells[row][col];
        if (c.type === CELL_BUILDING) buildings.push({ col, row, color: c.color, height: c.height });
      }
    }
    if (buildings.length === 0) return;

    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
    const mesh = new THREE.InstancedMesh(geo, mat, buildings.length);
    const dummy = new THREE.Object3D();

    buildings.forEach((b, i) => {
      const cx = b.col * this.cell + this.cell / 2;
      const cz = b.row * this.cell + this.cell / 2;
      dummy.position.set(cx, b.height / 2, cz);
      dummy.scale.set(this.cell * 0.82, b.height, this.cell * 0.82);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, new THREE.Color(b.color));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    this.scene.add(mesh);
  }

  _buildTrees() {
    const spots = [];
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        if (this.cells[row][col].type === CELL_PARK) {
          for (let i = 0; i < 2; i++) {
            spots.push({
              x: col * this.cell + this.cell / 2 + (Math.random() - 0.5) * this.cell * 0.5,
              z: row * this.cell + this.cell / 2 + (Math.random() - 0.5) * this.cell * 0.5,
            });
          }
        }
      }
    }
    if (spots.length === 0) return;

    const trunkGeo = new THREE.CylinderGeometry(0.18, 0.22, 1.4, 6);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a3d26 });
    const trunkMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, spots.length);

    const foliageGeo = new THREE.ConeGeometry(1.4, 2.6, 7);
    const foliageMat = new THREE.MeshStandardMaterial({ color: 0x2f7a3f });
    const foliageMesh = new THREE.InstancedMesh(foliageGeo, foliageMat, spots.length);

    const dummy = new THREE.Object3D();
    spots.forEach((s, i) => {
      dummy.position.set(s.x, 0.7, s.z);
      dummy.scale.set(1, 1, 1);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      trunkMesh.setMatrixAt(i, dummy.matrix);

      dummy.position.set(s.x, 2.1, s.z);
      dummy.updateMatrix();
      foliageMesh.setMatrixAt(i, dummy.matrix);
    });
    trunkMesh.instanceMatrix.needsUpdate = true;
    foliageMesh.instanceMatrix.needsUpdate = true;
    this.scene.add(trunkMesh);
    this.scene.add(foliageMesh);
  }

  cellAt(worldX, worldZ) {
    const col = Math.floor(worldX / this.cell);
    const row = Math.floor(worldZ / this.cell);
    if (col < 0 || row < 0 || col >= this.cols || row >= this.rows) return null;
    return this.cells[row][col];
  }

  isSolidAt(worldX, worldZ) {
    const c = this.cellAt(worldX, worldZ);
    if (!c) return true;
    return c.type === CELL_BUILDING;
  }

  isRoadAt(worldX, worldZ) {
    const c = this.cellAt(worldX, worldZ);
    return !!c && c.type === CELL_ROAD;
  }

  collidesRect(cx, cz, length, width, angle) {
    const corners = rectCorners(cx, cz, length / 2, width / 2, angle);
    return corners.some((p) => this.isSolidAt(p.x, p.y));
  }

  randomRoadPoint() {
    return pick(this.roadCenters);
  }

  randomRoadPointNear(x, z, minDist, maxDist) {
    for (let i = 0; i < 40; i++) {
      const p = pick(this.roadCenters);
      const d = Math.hypot(p.x - x, p.z - z);
      if (d >= minDist && d <= maxDist) return p;
    }
    return this.randomRoadPoint();
  }
}
