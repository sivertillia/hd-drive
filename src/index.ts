import robot from 'robotjs';
import { GlobalKeyboardListener, IGlobalKeyEvent } from 'node-global-key-listener';
import { execSync } from 'child_process';

const INTERVAL_MS = 5000;
const MOVE_SPEED = 0.5;
const DOUBLE_TAP_MS = 400;

// Delay range between keystrokes (ms) to simulate human typing
const TYPE_DELAY_MIN = 40;
const TYPE_DELAY_MAX = 120;

let paused = false;
let typing = false;
let lastRShiftUp = 0;
let lastRAltUp = 0;

const held = new Set<string>();

function getRandomPosition() {
  const { width, height } = robot.getScreenSize();
  return {
    x: Math.floor(Math.random() * width),
    y: Math.floor(Math.random() * height),
  };
}

function moveMouseRandomly(): void {
  if (paused) return;
  const { x, y } = getRandomPosition();
  robot.moveMouseSmooth(x, y, MOVE_SPEED);
  console.log(`[mouse] → (${x}, ${y})`);
}

function getClipboard(): string {
  try {
    return execSync('pbpaste').toString();
  } catch {
    return '';
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function typeFromClipboard(): Promise<void> {
  const text = getClipboard();
  if (!text) {
    console.log('[type]  clipboard is empty');
    return;
  }

  typing = true;
  console.log(`[type]  start (${text.length} chars)`);

  for (const char of text) {
    if (!typing) break; // can be cancelled
    if (char === '\n') {
      robot.keyTap('enter', ['shift']);
    } else if (char !== '\r') {
      robot.typeString(char);
    }
    const delay = TYPE_DELAY_MIN + Math.random() * (TYPE_DELAY_MAX - TYPE_DELAY_MIN);
    await sleep(delay);
  }

  console.log('[type]  done');
  typing = false;
}

const keyboard = new GlobalKeyboardListener();

keyboard.addListener((e: IGlobalKeyEvent) => {
  const name = e.name ?? '[unknown]';

  if (e.state === 'DOWN') {
    held.add(name);
    const combo = [...held].join(' + ');
    console.log(`[key↓]  ${combo}`);

    // RShift + Esc = quit
    if (held.has('RIGHT SHIFT') && held.has('ESCAPE')) {
      console.log('Stopping.');
      process.exit(0);
    }
  }

  if (e.state === 'UP') {
    held.delete(name);

    // Double-tap RShift = pause / resume
    if (name === 'RIGHT SHIFT') {
      const now = Date.now();
      if (now - lastRShiftUp < DOUBLE_TAP_MS) {
        paused = !paused;
        console.log(paused ? '[paused]  ← double RShift' : '[resumed] ← double RShift');
        lastRShiftUp = 0;
      } else {
        lastRShiftUp = now;
      }
    }

    // Double-tap RAlt = type clipboard letter by letter
    if (name === 'RIGHT ALT') {
      const now = Date.now();
      if (now - lastRAltUp < DOUBLE_TAP_MS) {
        lastRAltUp = 0;
        if (typing) {
          typing = false; // cancel ongoing typing
          console.log('[type]  cancelled');
        } else {
          typeFromClipboard();
        }
      } else {
        lastRAltUp = now;
      }
    }
  }
});

console.log('Random mouse movement started.');
console.log('  RShift × 2    — pause / resume');
console.log('  RAlt × 2      — type clipboard letter by letter (× 2 again to cancel)');
console.log('  RShift + Esc  — quit\n');

setInterval(moveMouseRandomly, INTERVAL_MS);
