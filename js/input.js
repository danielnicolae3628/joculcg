// Keyboard input handling with edge-triggered "just pressed" support.

const KEY_MAP = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  sprint: ['ShiftLeft', 'ShiftRight'],
  interact: ['KeyE'],
};

export class InputManager {
  constructor() {
    this.keys = {};
    this.justPressed = new Set();

    window.addEventListener('keydown', (e) => {
      if (!this.keys[e.code]) this.justPressed.add(e.code);
      this.keys[e.code] = true;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });
  }

  isDown(action) {
    return KEY_MAP[action].some((code) => this.keys[code]);
  }

  wasPressed(action) {
    const pressed = KEY_MAP[action].some((code) => this.justPressed.has(code));
    if (pressed) {
      KEY_MAP[action].forEach((code) => this.justPressed.delete(code));
    }
    return pressed;
  }

  endFrame() {
    this.justPressed.clear();
  }
}
