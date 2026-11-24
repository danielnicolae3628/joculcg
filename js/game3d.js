// Main 3D game orchestrator: scene setup, update loop, HUD, wanted system.
import * as THREE from './vendor/three.module.js';
import { InputManager } from './input.js';
import { World3D } from './world3d.js';
import { Player3D, TrafficCar3D, PoliceCar3D, Pedestrian3D } from './entities3d.js';
import { MissionManager3D } from './missions3d.js';
import { clamp, dist } from './utils.js';

export class Game3D {
  constructor(canvas) {
    this.canvas = canvas;
    this.input = new InputManager();

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x8fd0ff);
    this.scene.fog = new THREE.Fog(0x8fd0ff, 60, 220);

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.camera = new THREE.PerspectiveCamera(62, 1, 0.1, 500);
    this.cameraPos = new THREE.Vector3();
    this.cameraTarget = new THREE.Vector3();

    this._addLights();

    this.world = new World3D(this.scene);

    const spawn = this.world.randomRoadPoint();
    this.player = new Player3D(this.scene, spawn.x, spawn.z);

    this.vehicles = [];
    this.pedestrians = [];
    this.wanted = 0;
    this.wantedSinceIncrease = 0;
    this.money = 0;
    this.flashText = '';
    this.flashTimer = 0;
    this.lastTime = performance.now();
    this.running = false;

    this._spawnStarterCars(spawn);
    this._spawnTraffic(16);
    this._spawnPedestrians(16);

    this.missions = new MissionManager3D(this);
    this._updateCamera(1); // snap camera into place before the first frame renders

    this._resize();
    window.addEventListener('resize', () => this._resize());
  }

  _addLights() {
    const ambient = new THREE.AmbientLight(0xffffff, 0.65);
    this.scene.add(ambient);
    const sun = new THREE.DirectionalLight(0xfff3d8, 0.9);
    sun.position.set(80, 120, 40);
    this.scene.add(sun);
    const fill = new THREE.HemisphereLight(0x8fd0ff, 0x3a3a2a, 0.4);
    this.scene.add(fill);
  }

  _resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  _spawnStarterCars(spawn) {
    for (let i = 0; i < 3; i++) {
      const p = this.world.randomRoadPointNear(spawn.x, spawn.z, 6, 24);
      const car = new TrafficCar3D(this.scene, p.x, p.z);
      car.ai = false; // parked until driven
      this.vehicles.push(car);
    }
  }

  _spawnTraffic(count) {
    for (let i = 0; i < count; i++) {
      const p = this.world.randomRoadPoint();
      this.vehicles.push(new TrafficCar3D(this.scene, p.x, p.z));
    }
  }

  _spawnPedestrians(count) {
    for (let i = 0; i < count; i++) {
      const p = this.world.randomRoadPoint();
      this.pedestrians.push(new Pedestrian3D(this.scene, p.x, p.z));
    }
  }

  allVehicles() {
    return this.vehicles;
  }

  addMoney(amount) {
    this.money += amount;
  }

  flashMessage(text) {
    this.flashText = text;
    this.flashTimer = 3;
  }

  addWanted(n) {
    this.wanted = clamp(this.wanted + n, 0, 5);
    this.wantedSinceIncrease = 0;
    this._syncPoliceCount();
  }

  _syncPoliceCount() {
    const current = this.vehicles.filter((v) => v.isPolice).length;
    const desired = Math.min(this.wanted, 4);
    if (current < desired) {
      for (let i = current; i < desired; i++) {
        const pos = this.player.worldPos;
        const p = this.world.randomRoadPointNear(pos.x, pos.z, 45, 100);
        this.vehicles.push(new PoliceCar3D(this.scene, p.x, p.z));
      }
    } else if (desired === 0 && current > 0) {
      this.vehicles = this.vehicles.filter((v) => {
        if (v.isPolice && v.driver !== this.player) {
          v.destroy();
          return false;
        }
        return true;
      });
    }
  }

  onPedestrianKilled() {
    this.addWanted(1);
  }

  start() {
    this.running = true;
    this.lastTime = performance.now();
    requestAnimationFrame((t) => this._loop(t));
  }

  _loop(now) {
    if (!this.running) return;
    let dt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    dt = Math.min(dt, 0.05);

    this._update(dt);
    this.renderer.render(this.scene, this.camera);

    this.input.endFrame();
    requestAnimationFrame((t) => this._loop(t));
  }

  _update(dt) {
    const input = this.input;
    const player = this.player;

    if (input.wasPressed('interact')) {
      this._handleInteract();
    }

    if (player.inVehicle) {
      const throttle = (input.isDown('up') ? 1 : 0) - (input.isDown('down') ? 1 : 0);
      const steer = (input.isDown('left') ? 1 : 0) - (input.isDown('right') ? 1 : 0);
      player.inVehicle.update(dt, { throttle, steer }, this.world);
    } else {
      player.update(dt, input, this.world);
    }

    for (const v of this.vehicles) {
      if (v.driver) continue;
      if (v.ai) v.updateAI(dt, this.world);
      else if (v.isPolice) v.updateAI(dt, player.worldPos, this.world);
    }

    for (const ped of this.pedestrians) {
      ped.update(dt, this.world, player, this);
    }

    this._handlePoliceCollisions(dt);

    this.wantedSinceIncrease += dt;
    if (this.wanted > 0 && this.wantedSinceIncrease > 6) {
      this.wantedSinceIncrease = 0;
      this.wanted -= 1;
      this._syncPoliceCount();
    }

    if (player.health <= 0) {
      this._busted();
    }

    this.missions.update(dt);

    if (this.flashTimer > 0) this.flashTimer -= dt;

    this._updateCamera(dt);
    this._updateHud();
  }

  _handleInteract() {
    const player = this.player;
    if (player.inVehicle) {
      const v = player.inVehicle;
      v.driver = null;
      player.inVehicle = null;
      player.x = v.x - Math.cos(v.angle) * (v.length / 2 + 1.6);
      player.z = v.z - Math.sin(v.angle) * (v.length / 2 + 1.6);
      player.angle = v.angle;
      return;
    }

    let nearest = null;
    let best = 5.5;
    for (const v of this.vehicles) {
      if (v.driver) continue;
      const d = dist(player.x, player.z, v.x, v.z);
      if (d < best) { best = d; nearest = v; }
    }
    if (nearest) {
      nearest.driver = player;
      nearest.ai = false;
      player.inVehicle = nearest;
    }
  }

  _handlePoliceCollisions(dt) {
    const player = this.player;
    for (const v of this.vehicles) {
      if (!v.isPolice || v.driver) continue;
      if (player.inVehicle) {
        const d = dist(v.x, v.z, player.inVehicle.x, player.inVehicle.z);
        if (d < (v.length + player.inVehicle.length) / 2.2) {
          player.inVehicle.health -= 180 * dt;
          player.takeDamage(4);
          if (player.inVehicle.health <= 0) this._destroyPlayerVehicle();
        }
      } else {
        const d = dist(v.x, v.z, player.x, player.z);
        if (d < v.length / 2 + player.radius) {
          player.takeDamage(10);
        }
      }
    }
  }

  _destroyPlayerVehicle() {
    const v = this.player.inVehicle;
    const idx = this.vehicles.indexOf(v);
    if (idx >= 0) this.vehicles.splice(idx, 1);
    v.destroy();
    this.player.x = v.x;
    this.player.z = v.z;
    this.player.inVehicle = null;
    this.player.takeDamage(25);
  }

  _busted() {
    this.flashMessage('Ai fost prins! Pierzi bani şi echipamentul.');
    this.money = Math.max(0, this.money - Math.min(this.money, 150));
    this.player.health = 100;
    this.wanted = 0;
    this._syncPoliceCount();
    const spawn = this.world.randomRoadPoint();
    this.player.x = spawn.x;
    this.player.z = spawn.z;
    if (this.player.inVehicle) {
      const idx = this.vehicles.indexOf(this.player.inVehicle);
      if (idx >= 0) this.vehicles.splice(idx, 1);
      this.player.inVehicle.destroy();
      this.player.inVehicle = null;
    }
  }

  _updateCamera(dt) {
    const pos = this.player.worldPos;
    const angle = this.player.inVehicle ? this.player.inVehicle.angle : this.player.angle;
    const backDist = this.player.inVehicle ? 10 : 6.5;
    const height = this.player.inVehicle ? 5.5 : 4;

    const desired = new THREE.Vector3(
      pos.x - Math.cos(angle) * backDist,
      height,
      pos.z - Math.sin(angle) * backDist
    );
    const lookAt = new THREE.Vector3(pos.x, 1.4, pos.z);

    const lerpFactor = 1 - Math.pow(0.0001, dt);
    this.cameraPos.lerp(desired, lerpFactor);
    this.cameraTarget.lerp(lookAt, lerpFactor);
    this.camera.position.copy(this.cameraPos);
    this.camera.lookAt(this.cameraTarget);
  }

  _updateHud() {
    const healthBar = document.getElementById('healthBar');
    if (healthBar) healthBar.style.width = `${this.player.health}%`;

    const moneyText = document.getElementById('moneyText');
    if (moneyText) moneyText.textContent = `$${this.money}`;

    const stars = document.getElementById('wantedStars');
    if (stars) stars.textContent = this.wanted > 0 ? '★'.repeat(this.wanted) : '';

    const banner = document.getElementById('missionBanner');
    if (banner) {
      banner.textContent = this.flashTimer > 0 ? this.flashText : this.missions.message;
    }
  }
}
