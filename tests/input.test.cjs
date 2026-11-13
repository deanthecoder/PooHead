const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Exercise the real input handlers and card-selection rules without a renderer.
function setup() {
  const target = () => ({
    listeners: new Map(),
    addEventListener(type, handler) { this.listeners.set(type, handler); },
    emit(type, values = {}) {
      this.listeners.get(type)?.({
        pointerId: 1, isPrimary: true, button: 0, clientX: 40, clientY: 140,
        preventDefault() {}, ...values,
      });
    },
  });
  const canvas = Object.assign(target(), {
    style: {}, focus() {}, captured: new Set(),
    setPointerCapture(id) { this.captured.add(id); },
    hasPointerCapture(id) { return this.captured.has(id); },
    releasePointerCapture(id) { this.captured.delete(id); },
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 320, height: 200 }),
  });
  const elements = {
    '#screen': canvas, '#status': {}, '#new-game': target(),
    '#crt-aspect': Object.assign(target(), { checked: true }),
    '.screen-wrap': { clientWidth: 320, getBoundingClientRect: () => ({ top: 0 }) },
    '.toolbar': { offsetHeight: 0 },
  };
  const document = Object.assign(target(), { querySelector: selector => elements[selector] });
  const window = Object.assign(target(), { innerHeight: 800 });
  const timers = new Map();
  let timerId = 0;
  let now = 0;
  const context = vm.createContext({
    document, window,
    setTimeout(fn, delay) { timers.set(++timerId, { fn, at: now + delay }); return timerId; },
    clearTimeout(id) { timers.delete(id); },
  });
  const source = fs.readFileSync(path.join(__dirname, '../main.js'), 'utf8')
    .replace("import { VGA } from './vga.js';", 'class VGA {}')
    .split('const game = new Game();')[0];
  vm.runInContext(`${source}\nglobalThis.Game = Game;`, context);
  const game = new context.Game();
  game.draw = () => {};
  game.phase = 'human';
  game.players = [null, Array(53).fill(null)];
  game.players[1][7] = { value: 5 };
  game.players[1][8] = { value: 5 };
  game.players[1][9] = { value: 6 };
  const plays = [];
  game.playHuman = index => plays.push({ index, selected: [...game.selected] });
  game.bindInput();
  const hold = (milliseconds = 500) => {
    now += milliseconds;
    for (const [id, timer] of [...timers]) {
      if (timer.at <= now) { timers.delete(id); timer.fn(); }
    }
  };
  return { canvas, document, window, game, plays, hold };
}

test('a tap plays only on release, while a hold selects once and does not play', () => {
  const { canvas, game, plays, hold } = setup();
  canvas.emit('pointerdown');
  assert.equal(plays.length, 0);
  canvas.emit('pointerup');
  assert.equal(plays.length, 1);
  canvas.emit('pointerdown');
  hold(499);
  assert.equal(game.selected.size, 0);
  hold(1);
  assert.deepEqual([...game.selected], [7]);
  canvas.emit('pointerup');
  hold();
  assert.deepEqual([...game.selected], [7]);
  assert.equal(plays.length, 1);
});

test('holds select matching cards, reject other ranks, and a tap plays the selection', () => {
  const { canvas, game, plays, hold } = setup();
  for (const clientX of [40, 94, 148]) {
    canvas.emit('pointerdown', { clientX }); hold(); canvas.emit('pointerup', { clientX });
  }
  assert.deepEqual([...game.selected], [7, 8]);
  canvas.emit('pointerdown'); canvas.emit('pointerup');
  assert.deepEqual(plays, [{ index: 7, selected: [7, 8] }]);
});

test('right-click remains immediate and holding a selected card toggles it off', () => {
  const { canvas, game, plays, hold } = setup();
  canvas.emit('pointerdown', { button: 2 });
  assert.deepEqual([...game.selected], [7]);
  canvas.emit('pointerup', { button: 2 });
  canvas.emit('pointerdown'); hold(); canvas.emit('pointerup');
  assert.equal(game.selected.size, 0);
  assert.equal(plays.length, 0);
});

for (const cancel of ['pointercancel', 'lostpointercapture', 'movement', 'second finger', 'blur', 'hidden', 'new deal']) {
  test(`${cancel} prevents a pending press from playing or selecting`, () => {
    const { canvas, document, window, game, plays, hold } = setup();
    canvas.emit('pointerdown');
    if (cancel === 'movement') canvas.emit('pointermove', { clientX: 94 });
    else if (cancel === 'second finger') canvas.emit('pointerdown', { pointerId: 2, isPrimary: false });
    else if (cancel === 'blur') window.emit('blur');
    else if (cancel === 'hidden') { document.hidden = true; document.emit('visibilitychange'); }
    else if (cancel === 'new deal') game.generation++;
    else canvas.emit(cancel);
    hold(); canvas.emit('pointerup');
    assert.equal(game.selected.size, 0);
    assert.equal(plays.length, 0);
  });
}

test('small finger movement still selects the original card', () => {
  const { canvas, game, hold } = setup();
  canvas.emit('pointerdown');
  canvas.emit('pointermove', { clientX: 44, clientY: 143 });
  hold(); canvas.emit('pointerup');
  assert.deepEqual([...game.selected], [7]);
});

test('touch holds ignore compatibility mouse/click events and never play on release', () => {
  const { canvas, game, plays, hold } = setup();
  canvas.emit('pointerdown', { pointerType: 'touch' });
  canvas.emit('mousedown');
  assert.equal(plays.length, 0);
  hold();
  canvas.emit('pointerup', { pointerType: 'touch' });
  canvas.emit('mouseup');
  canvas.emit('click');
  assert.deepEqual([...game.selected], [7]);
  assert.equal(plays.length, 0);
});

test('the full left and right gutters scroll the hand on touch', () => {
  const { canvas, game, plays } = setup();
  game.players[1][12] = { value: 7 };
  const tap = (clientX, clientY) => {
    canvas.emit('pointerdown', { pointerType: 'touch', clientX, clientY });
    canvas.emit('pointerup', { pointerType: 'touch', clientX, clientY });
  };
  for (const [rightX, leftX, y] of [[291, 29, 125], [319, 0, 184]]) {
    tap(rightX, y);
    assert.equal(game.leftCard, 8);
    tap(leftX, y);
    assert.equal(game.leftCard, 7);
  }
  assert.equal(plays.length, 0);
});

test('expanded arrow targets exclude cards and only work when scrolling is possible', () => {
  const { game } = setup();
  game.players[1][11] = { value: 7 };
  assert.equal(game.cardAt(29, 140), 0); // Already at the left end.
  assert.equal(game.cardAt(291, 140), 0); // No more cards on the right.
  game.players[1][12] = { value: 8 };
  assert.equal(game.cardAt(30, 140), 7);
  assert.equal(game.cardAt(290, 140), 11);
  assert.equal(game.cardAt(291, 124), 0);
  assert.equal(game.cardAt(291, 185), 0);
});
