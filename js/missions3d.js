// Same sequential mission chain as the 2D prototype, adapted to x/z world space.
import * as THREE from './vendor/three.module.js';
import { dist } from './utils.js';
import { TrafficCar3D } from './entities3d.js';

export class MissionManager3D {
  constructor(game) {
    this.game = game;
    this.world = game.world;
    this.index = 0;
    this.state = 'idle';
    this.timer = 0;
    this.message = '';
    this.targetMarker = null;
    this.specialVehicle = null;
    this.specialTaken = false;

    const spawn = game.player.worldPos;
    this.startMarker = this.world.randomRoadPointNear(spawn.x, spawn.z, 10, 30);
    this.startMarker.radius = 5;

    this.titles = ['Cursă rapidă', 'Fugă de poliție', 'Livrare VIP'];
    this.rewards = [500, 750, 1000];

    this.startMesh = this._buildMarkerMesh(0xffd84c);
    this.targetMesh = this._buildMarkerMesh(0x4cff6b);
    this.targetMesh.visible = false;
    game.scene.add(this.startMesh);
    game.scene.add(this.targetMesh);
  }

  _buildMarkerMesh(color) {
    const group = new THREE.Group();
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(2.2, 0.18, 8, 24),
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.6 })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.2;
    group.add(ring);
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.12, 4, 8),
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.9, transparent: true, opacity: 0.55 })
    );
    beam.position.y = 2.2;
    group.add(beam);
    return group;
  }

  update(dt) {
    const player = this.game.player;
    const pos = player.worldPos;

    this.startMesh.position.set(this.startMarker.x, 0, this.startMarker.z);
    this.startMesh.rotation.y += dt;
    this.startMesh.visible = this.state === 'idle';

    if (this.targetMarker) {
      this.targetMesh.position.set(this.targetMarker.x, 0, this.targetMarker.z);
      this.targetMesh.rotation.y += dt;
      this.targetMesh.visible = true;
    } else {
      this.targetMesh.visible = false;
    }

    if (this.state === 'idle') {
      this.message = `Mergi la marcajul galben pentru misiunea: ${this.titles[this.index % this.titles.length]}`;
      if (dist(pos.x, pos.z, this.startMarker.x, this.startMarker.z) < this.startMarker.radius) {
        this._begin(this.index % 3);
      }
      return;
    }

    if (this.state === 'mission0') {
      this.timer -= dt;
      this.message = `Cursă rapidă — ajungi în zona verde! Timp: ${Math.max(0, Math.ceil(this.timer))}s`;
      if (this.timer <= 0) return this._fail('Timp expirat! Încearcă din nou la marcaj.');
      if (dist(pos.x, pos.z, this.targetMarker.x, this.targetMarker.z) < 6) this._complete();
    } else if (this.state === 'mission1') {
      this.timer -= dt;
      this.message = `Fugă de poliție — rezistă ${Math.max(0, Math.ceil(this.timer))}s!`;
      if (player.health <= 0) return this._fail('Ai fost prins de poliție!');
      if (this.timer <= 0) this._complete();
    } else if (this.state === 'mission2') {
      if (!this.specialTaken && player.inVehicle === this.specialVehicle) {
        this.specialTaken = true;
      }
      this.message = this.specialTaken
        ? 'Livrare VIP — du maşina lime la marcajul verde!'
        : 'Livrare VIP — intră în maşina lime!';
      if (this.specialTaken && dist(this.specialVehicle.x, this.specialVehicle.z, this.targetMarker.x, this.targetMarker.z) < 6.5) {
        this._complete();
      }
    } else if (this.state === 'done') {
      this.message = 'Toate misiunile demo completate! Poți continua explorarea orașului.';
    }
  }

  _begin(i) {
    const pos = this.game.player.worldPos;
    if (i === 0) {
      this.state = 'mission0';
      this.timer = 60;
      this.targetMarker = this.world.randomRoadPointNear(pos.x, pos.z, 55, 140);
    } else if (i === 1) {
      this.state = 'mission1';
      this.timer = 25;
      this.game.addWanted(2);
    } else if (i === 2) {
      this.state = 'mission2';
      this.specialTaken = false;
      const carSpot = this.world.randomRoadPointNear(pos.x, pos.z, 10, 25);
      this.specialVehicle = new TrafficCar3D(this.game.scene, carSpot.x, carSpot.z, 0x9dff3b);
      this.specialVehicle.ai = false;
      this.game.vehicles.push(this.specialVehicle);
      this.targetMarker = this.world.randomRoadPointNear(pos.x, pos.z, 55, 140);
    }
  }

  _complete() {
    const reward = this.rewards[this.index % 3];
    this.game.addMoney(reward);
    this.game.flashMessage(`Misiune completă! +$${reward}`);
    this.index++;
    this.state = 'idle';
    this.targetMarker = null;
    if (this.specialVehicle) {
      const idx = this.game.vehicles.indexOf(this.specialVehicle);
      if (idx >= 0) this.game.vehicles.splice(idx, 1);
      this.specialVehicle.destroy();
      this.specialVehicle = null;
    }
    const spawn = this.game.player.worldPos;
    this.startMarker = this.world.randomRoadPointNear(spawn.x, spawn.z, 10, 35);
    this.startMarker.radius = 5;
  }

  _fail(msg) {
    this.game.flashMessage(msg);
    this.state = 'idle';
    this.targetMarker = null;
    if (this.specialVehicle) {
      const idx = this.game.vehicles.indexOf(this.specialVehicle);
      if (idx >= 0) this.game.vehicles.splice(idx, 1);
      this.specialVehicle.destroy();
      this.specialVehicle = null;
    }
  }
}
