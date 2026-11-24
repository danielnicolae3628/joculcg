// Player, vehicles and pedestrians for the 3D city.
import * as THREE from './vendor/three.module.js';
import { clamp, dist, rand, pick, normalizeAngle } from './utils.js';
import { CELL } from './world3d.js';

// A simple low-poly "voxel person" used for both the player and pedestrians.
function buildHumanoid({ shirt, pants, skin, hair }) {
  const group = new THREE.Group();
  const mat = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.85 });

  const legGeo = new THREE.BoxGeometry(0.34, 0.9, 0.32);
  const legMat = mat(pants);
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(legGeo, legMat);
    leg.position.set(0, 0.45, side * 0.19);
    group.add(leg);
  }

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.46, 1.0, 0.82), mat(shirt));
  torso.position.set(0, 1.4, 0);
  group.add(torso);

  const armGeo = new THREE.BoxGeometry(0.42, 0.82, 0.26);
  const armMat = mat(shirt);
  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(armGeo, armMat);
    arm.position.set(0, 1.37, side * 0.52);
    group.add(arm);
  }

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), mat(skin));
  head.position.set(0, 2.22, 0);
  group.add(head);

  const hairCap = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.6), mat(hair));
  hairCap.position.set(-0.03, 2.46, 0);
  group.add(hairCap);

  const face = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.3), mat(0xf2d9c4));
  face.position.set(0.3, 2.2, 0);
  group.add(face);

  return group;
}

export class Player3D {
  constructor(scene, x, z) {
    this.x = x;
    this.z = z;
    this.angle = 0;
    this.walkSpeed = 6.2;
    this.radius = 0.4;
    this.health = 100;
    this.money = 0;
    this.inVehicle = null;
    this.hitCooldown = 0;

    this.mesh = buildHumanoid({ shirt: 0x3b6fd1, pants: 0x2b2b35, skin: 0xe0ac69, hair: 0x2a1f1a });
    scene.add(this.mesh);
  }

  get worldPos() {
    return this.inVehicle ? { x: this.inVehicle.x, z: this.inVehicle.z } : { x: this.x, z: this.z };
  }

  update(dt, input, world) {
    if (this.hitCooldown > 0) this.hitCooldown -= dt;
    this.mesh.visible = !this.inVehicle;
    if (this.inVehicle) return;

    let dx = 0, dz = 0;
    if (input.isDown('up')) dx += 1;
    if (input.isDown('down')) dx -= 1;
    if (input.isDown('left')) dz += 1;
    if (input.isDown('right')) dz -= 1;

    if (dx || dz) {
      const len = Math.hypot(dx, dz);
      dx /= len; dz /= len;
      this.angle = Math.atan2(dz, dx);
      const speed = this.walkSpeed * (input.isDown('sprint') ? 1.7 : 1);
      const nx = this.x + dx * speed * dt;
      const nz = this.z + dz * speed * dt;
      if (!world.isSolidAt(nx, this.z)) this.x = nx;
      if (!world.isSolidAt(this.x, nz)) this.z = nz;
    }

    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = -this.angle;
  }

  takeDamage(amount) {
    if (this.hitCooldown > 0) return;
    this.health = clamp(this.health - amount, 0, 100);
    this.hitCooldown = 0.6;
  }
}

export class Vehicle3D {
  constructor(scene, x, z, opts = {}) {
    this.scene = scene;
    this.x = x;
    this.z = z;
    this.angle = opts.angle ?? rand(0, Math.PI * 2);
    this.speed = 0;
    this.maxSpeed = opts.maxSpeed || 26;
    this.accel = opts.accel || 20;
    this.brakeForce = opts.brakeForce || 28;
    this.friction = opts.friction || 14;
    this.turnSpeed = opts.turnSpeed || 2.6;
    this.length = opts.length || 4.4;
    this.width = opts.width || 2.0;
    this.color = opts.color ?? 0xc0392b;
    this.health = opts.health || 100;
    this.driver = null;
    this.ai = !!opts.ai;
    this.isPolice = !!opts.isPolice;
    this.removed = false;

    this.mesh = this._buildMesh();
    scene.add(this.mesh);
  }

  _buildMesh() {
    const group = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: this.color, roughness: 0.6, metalness: 0.1 });
    const wheelR = 0.42;

    const body = new THREE.Mesh(new THREE.BoxGeometry(this.length, 0.55, this.width), bodyMat);
    body.position.set(0, wheelR + 0.3, 0);
    group.add(body);

    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(this.length * 0.46, 0.42, this.width * 0.8),
      new THREE.MeshStandardMaterial({ color: 0xbfe3ff, roughness: 0.3, transparent: true, opacity: 0.85 })
    );
    cabin.position.set(-this.length * 0.05, wheelR + 0.3 + 0.45, 0);
    group.add(cabin);

    const wheelGeo = new THREE.CylinderGeometry(wheelR, wheelR, 0.3, 10);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 });
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const wheel = new THREE.Mesh(wheelGeo, wheelMat);
        wheel.rotation.x = Math.PI / 2;
        wheel.position.set(sx * (this.length / 2 - wheelR * 1.3), wheelR, sz * (this.width / 2 + 0.05));
        group.add(wheel);
      }
    }

    if (this.isPolice) {
      const bar = new THREE.Mesh(
        new THREE.BoxGeometry(0.7, 0.18, this.width * 0.7),
        new THREE.MeshStandardMaterial({ color: 0x111111 })
      );
      bar.position.set(this.length * 0.1, wheelR + 0.3 + 0.7, 0);
      group.add(bar);
      this._lightMat = new THREE.MeshStandardMaterial({ color: 0xff3b3b, emissive: 0xff3b3b, emissiveIntensity: 1.2 });
      const light = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.14, 0.26), this._lightMat);
      light.position.set(this.length * 0.1, wheelR + 0.3 + 0.82, 0);
      group.add(light);
    }

    return group;
  }

  update(dt, control, world) {
    if (control) {
      if (control.throttle > 0) {
        this.speed += this.accel * dt * control.throttle;
      } else if (control.throttle < 0) {
        if (this.speed > 0.3) this.speed -= this.brakeForce * dt;
        else this.speed += this.accel * dt * control.throttle * 0.6;
      }
      const speedFactor = clamp(Math.abs(this.speed) / this.maxSpeed, 0, 1);
      const dirSign = this.speed < 0 ? -1 : 1;
      this.angle += control.steer * this.turnSpeed * dt * (0.25 + 0.75 * speedFactor) * dirSign;
    }

    if (this.speed > 0) this.speed = Math.max(0, this.speed - this.friction * dt);
    else if (this.speed < 0) this.speed = Math.min(0, this.speed + this.friction * dt);
    this.speed = clamp(this.speed, -this.maxSpeed * 0.55, this.maxSpeed);

    const nx = this.x + Math.cos(this.angle) * this.speed * dt;
    const nz = this.z + Math.sin(this.angle) * this.speed * dt;

    if (!world.collidesRect(nx, nz, this.length, this.width, this.angle)) {
      this.x = nx;
      this.z = nz;
    } else {
      this.speed *= -0.25;
    }

    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = -this.angle;
    if (this.isPolice && this._lightMat) {
      const t = Math.floor(performance.now() / 180) % 2;
      this._lightMat.color.set(t === 0 ? 0xff3b3b : 0x3b7bff);
      this._lightMat.emissive.set(t === 0 ? 0xff3b3b : 0x3b7bff);
    }
  }

  destroy() {
    this.scene.remove(this.mesh);
    this.removed = true;
  }
}

export class TrafficCar3D extends Vehicle3D {
  constructor(scene, x, z, color) {
    super(scene, x, z, {
      maxSpeed: 14,
      accel: 15,
      friction: 7,
      turnSpeed: 2.2,
      brakeForce: 20,
      color: color ?? pick([0x8a8a8a, 0xb5651d, 0x2e86de, 0x2e8b57, 0xc0392b, 0xd4ac0d]),
      ai: true,
    });
    this.dir = pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]);
  }

  updateAI(dt, world) {
    const lookAhead = CELL * 0.75;
    const lookX = this.x + Math.cos(this.dir) * lookAhead;
    const lookZ = this.z + Math.sin(this.dir) * lookAhead;

    if (world.isSolidAt(lookX, lookZ)) {
      const candidates = [0, Math.PI / 2, Math.PI, -Math.PI / 2].filter((d) => {
        const tx = this.x + Math.cos(d) * lookAhead;
        const tz = this.z + Math.sin(d) * lookAhead;
        return !world.isSolidAt(tx, tz);
      });
      if (candidates.length > 0) {
        const nonReverse = candidates.filter((d) => Math.abs(normalizeAngle(d - this.dir - Math.PI)) > 0.1);
        this.dir = pick(nonReverse.length ? nonReverse : candidates);
      } else {
        this.dir = normalizeAngle(this.dir + Math.PI);
      }
    }

    const diff = normalizeAngle(this.dir - this.angle);
    const steer = clamp(diff * 2.2, -1, 1);
    this.update(dt, { throttle: 0.75, steer }, world);
  }
}

export class PoliceCar3D extends Vehicle3D {
  constructor(scene, x, z) {
    super(scene, x, z, {
      maxSpeed: 23,
      accel: 22,
      friction: 10,
      turnSpeed: 3.0,
      brakeForce: 26,
      color: 0x1b3a6b,
      isPolice: true,
    });
  }

  updateAI(dt, targetPos, world) {
    const desired = Math.atan2(targetPos.z - this.z, targetPos.x - this.x);
    const diff = normalizeAngle(desired - this.angle);
    const steer = clamp(diff * 2.4, -1, 1);
    const d = dist(this.x, this.z, targetPos.x, targetPos.z);
    const throttle = d > 3.5 ? 1 : 0.15;
    this.update(dt, { throttle, steer }, world);
  }
}

const PED_SKINS = [0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac];
const PED_SHIRTS = [0xd94f4f, 0x4fa3d9, 0x4fd97b, 0xd9b84f, 0x9d4fd9, 0xd9794f];

export class Pedestrian3D {
  constructor(scene, x, z) {
    this.scene = scene;
    this.x = x;
    this.z = z;
    this.angle = rand(0, Math.PI * 2);
    this.baseSpeed = 1.7;
    this.speed = this.baseSpeed;
    this.changeDirTimer = rand(1, 3);
    this.fleeTimer = 0;
    this.dead = false;
    this.respawnTimer = 0;

    this.mesh = buildHumanoid({
      shirt: pick(PED_SHIRTS),
      pants: 0x27293a,
      skin: pick(PED_SKINS),
      hair: 0x1c1410,
    });
    this.mesh.scale.setScalar(0.92);
    scene.add(this.mesh);
  }

  update(dt, world, player, game) {
    if (this.dead) {
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0) {
        const p = world.randomRoadPoint();
        this.x = p.x; this.z = p.z;
        this.dead = false;
        this.speed = this.baseSpeed;
        this.mesh.visible = true;
      }
      return;
    }

    const activeVehicle = player.inVehicle;
    if (activeVehicle) {
      const d = dist(this.x, this.z, activeVehicle.x, activeVehicle.z);
      if (d < 9 && Math.abs(activeVehicle.speed) > 6) {
        this.angle = Math.atan2(this.z - activeVehicle.z, this.x - activeVehicle.x);
        this.speed = 5.2;
        this.fleeTimer = 0.7;
      }
    }

    if (this.fleeTimer > 0) {
      this.fleeTimer -= dt;
    } else {
      this.speed = this.baseSpeed;
      this.changeDirTimer -= dt;
      if (this.changeDirTimer <= 0) {
        this.angle += rand(-0.8, 0.8);
        this.changeDirTimer = rand(1, 3);
      }
    }

    const nx = this.x + Math.cos(this.angle) * this.speed * dt;
    const nz = this.z + Math.sin(this.angle) * this.speed * dt;
    if (!world.isSolidAt(nx, nz)) {
      this.x = nx; this.z = nz;
    } else {
      this.angle += Math.PI + rand(-0.4, 0.4);
    }

    for (const v of game.allVehicles()) {
      if (Math.abs(v.speed) > 7 && dist(this.x, this.z, v.x, v.z) < 1.9) {
        this.dead = true;
        this.respawnTimer = rand(6, 12);
        this.mesh.visible = false;
        game.onPedestrianKilled(this);
        break;
      }
    }

    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = -this.angle;
  }
}
