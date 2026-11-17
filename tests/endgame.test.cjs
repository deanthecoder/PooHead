// Copyright (c) Dean Edis. Licensed under the MIT License.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function setup(timing = {}) {
  const status = {};
  const context = vm.createContext({
    document: { querySelector: () => status }, setTimeout, clearTimeout, ...timing,
  });
  const source = fs.readFileSync(path.join(__dirname, '../main.js'), 'utf8')
    .replace(/^import .*;$/m, 'class VGA {}')
    .split('const game = new Game();')[0];
  vm.runInContext(`${source}\nglobalThis.Game = Game; globalThis.renderer = vga;`, context);
  const game = new context.Game();
  game.draw = () => {};
  game.newGame();
  game.phase = 'human';
  game.players.forEach(hand => hand?.fill(null));
  game.deck.fill(null);
  game.pile.fill(null);
  game.players[2][7] = card('3');
  game.players[3][7] = card('4');
  const messages = [];
  game.message = async (text, generation, duration) => { messages.push({ text, duration }); };
  let cpuTurns = 0;
  game.cpuTurns = () => { cpuTurns++; game.phase = 'cpu'; };
  return { game, messages, status, renderer: context.renderer, cpuTurns: () => cpuTurns };
}
const card = number => ({ number, suit: 3, value: ({ '2': 15, '10': 16, J: 11, Q: 12, K: 13, A: 14 })[number] ?? Number(number) });

for (const burn of ['10', 'four matching cards', 'ordinary card']) {
  test(`finishing with ${burn} advances to CPU after a readable winning-card notice`, async () => {
    const state = setup();
    const { game, messages } = state;
    const number = burn === '10' ? '10' : '5';
    game.players[1][1] = card(number);
    if (burn === 'four matching cards') for (let i = 1; i <= 3; i++) game.pile[i] = card(number);
    await game.playHuman(1);
    assert.equal(state.cpuTurns(), 1);
    assert.equal(game.phase, 'cpu');
    assert.deepEqual([...game.finishOrder], [1]);
    assert.equal(game.goFast, true);
    assert.ok(messages.some(m => m.text === `You played ${number} of hearts.\nYou win!` && m.duration === 3000));
    if (burn !== 'ordinary card') assert.equal(game.pile[1], null);
  });
}

test('a ten grants another turn if a table card or replenished card remains', async () => {
  for (const fromDeck of [false, true]) {
    const state = setup();
    const { game } = state;
    game.players[1][7] = card('10');
    if (fromDeck) game.deck[1] = card('3');
    else game.players[1][1] = card('3');
    await game.playHuman(7);
    assert.equal(game.phase, 'human');
    assert.equal(state.cpuTurns(), 0);
    assert.equal(game.finishOrder.length, 0);
  }
});

test('an invalid last card is picked up and does not count as finishing', async () => {
  const { game } = setup();
  game.players[1][1] = card('3');
  game.pile[1] = card('9');
  await game.playHuman(1);
  assert.equal(game.phase, 'human');
  assert.equal(game.finishOrder.length, 0);
  assert.equal(game.playerFinished(1), false);
});

test('new game during the winning notice cancels the old endgame', async () => {
  const state = setup();
  const { game } = state;
  game.players[1][1] = card('5');
  game.message = async () => game.newGame();
  await game.playHuman(1);
  assert.equal(game.phase, 'setup');
  assert.equal(game.goFast, false);
  assert.equal(game.finishOrder.length, 0);
  assert.equal(state.cpuTurns(), 0);
});

test('CPU finishes are ranked and final results remain visible', async () => {
  const { game, status } = setup();
  game.players[1][1] = card('9');
  await game.cpuPlay(2, game.generation);
  await game.cpuPlay(3, game.generation);
  assert.deepEqual([...game.finishOrder], [2, 3, 1]);
  assert.equal(game.modal.text, 'You are the shithead!\n1st: CPU 1\n2nd: CPU 2\n3rd: You');
  assert.equal(game.phase, 'finished');
  assert.match(status.textContent, /New game/);
  game.click(2);
  assert.equal(game.phase, 'finished');
  assert.equal(game.modal.kind, 'results');
  game.newGame();
  assert.equal(game.finishOrder.length, 0);
});

test('finishing second names the card and reports second place', async () => {
  const { game, messages } = setup();
  game.players[2].fill(null);
  await game.reducePlayers(2, game.generation);
  game.players[1][1] = card('10');
  await game.playHuman(1);
  assert.ok(messages.some(m => m.text.includes('You finish 2nd!')));
  assert.equal(game.modal.text, 'CPU 2 is the shithead!\n1st: CPU 1\n2nd: You\n3rd: CPU 2');
});

test('right clicking empty board space has no quit action', () => {
  const { game } = setup();
  game.mouse = { x: 200, y: 100 };
  game.click(2);
  assert.equal(game.modal, null);
  assert.equal(game.phase, 'human');
});

test('CPU plays matching hand cards together without taking matching table cards', async () => {
  const { game, messages } = setup();
  game.players[2][7] = card('Q');
  game.players[2][8] = card('Q');
  game.players[2][9] = card('K');
  game.players[2][4] = card('Q');
  game.pile[1] = card('J');
  assert.equal(await game.cpuPlay(2, game.generation), false);
  assert.equal(game.pile.filter(Boolean).length, 3);
  assert.equal(game.players[2][7].number, 'K');
  assert.equal(game.players[2][4].number, 'Q');
  assert.equal(messages[0].text, 'CPU 1 lays 2 queens.');
});

test('CPU combines face-up cards but leaves face-down matches alone', async () => {
  const { game, messages } = setup();
  game.players[2].fill(null);
  for (const index of [1, 4, 6]) game.players[2][index] = card('8');
  game.pile[1] = card('7');
  await game.cpuPlay(2, game.generation);
  assert.equal(game.players[2][1].number, '8');
  assert.equal(game.players[2][4], null);
  assert.equal(game.players[2][6], null);
  assert.equal(messages[0].text, 'CPU 1 lays 2 eights.');
});

test('CPU reveals only one face-down card even when others match', async () => {
  const { game, messages } = setup();
  game.players[2].fill(null);
  for (const index of [1, 2, 3]) game.players[2][index] = card('8');
  game.pile[1] = card('7');
  await game.cpuPlay(2, game.generation);
  assert.equal(game.players[2].filter(Boolean).length, 2);
  assert.equal(messages[0].text, 'CPU 1 lays an eight.');
});

test('an unplayable pair does not validate itself by covering the previous top card', async () => {
  const { game, messages } = setup();
  game.players[2][7] = card('Q');
  game.players[2][8] = card('Q');
  game.pile[1] = card('K');
  assert.equal(await game.cpuPlay(2, game.generation), true);
  assert.equal(game.pile.filter(Boolean).length, 0);
  assert.equal(game.players[2].filter(Boolean).length, 3);
  assert.deepEqual(messages.map(m => m.text), ['CPU 1 cannot go.', 'CPU 1 picks up the pack.']);
});

test('a pair completing four matching cards clears the pile and grants another turn', async () => {
  const { game } = setup();
  game.players[2][7] = card('Q');
  game.players[2][8] = card('Q');
  game.players[2][9] = card('K');
  game.pile[1] = card('Q');
  game.pile[2] = card('Q');
  assert.equal(await game.cpuPlay(2, game.generation), true);
  assert.equal(game.pile.filter(Boolean).length, 0);
  assert.equal(game.players[2][7].number, 'K');
});

test('a grouped play refills the hand and a final pair of tens finishes only once', async () => {
  const { game } = setup();
  for (let i = 1; i <= 6; i++) game.players[2][i] = card('4');
  game.players[2][7] = card('Q');
  game.players[2][8] = card('Q');
  game.pile[1] = card('J');
  for (const index of [1, 2, 3]) game.deck[index] = card('3');
  await game.cpuPlay(2, game.generation);
  assert.equal(game.players[2].slice(7).filter(Boolean).length, 3);
  assert.equal(game.deck.filter(Boolean).length, 0);
  game.players[2].fill(null);
  game.players[2][7] = card('10');
  game.players[2][8] = card('10');
  assert.equal(await game.cpuPlay(2, game.generation), false);
  assert.deepEqual([...game.finishOrder], [2]);
  assert.equal(game.pile.filter(Boolean).length, 0);
});

test('the next CPU waits until the current play notice has finished', async () => {
  const { game } = setup();
  game.players[1][7] = card('9');
  game.players[2][8] = card('5');
  game.players[3][8] = card('6');
  game.pile[1] = card('3');
  const pending = [];
  game.message = () => new Promise(resolve => pending.push(resolve));
  const turn = Object.getPrototypeOf(game).cpuTurns.call(game, game.generation);
  assert.equal(game.pile[1].number, '3');
  assert.equal(game.players[3].filter(Boolean).length, 2);
  pending.shift()();
  for (let i = 0; i < 5; i++) await Promise.resolve();
  assert.equal(game.pile[1].number, '4');
  pending.shift()();
  await turn;
  assert.equal(game.phase, 'human');
});


test('only multi-card CPU plays use slower notices, including after the human finishes', async () => {
  for (const goFast of [false, true]) {
    for (const count of [1, 2]) {
      const { game, messages } = setup();
      game.goFast = goFast;
      game.players[2][7] = card('Q');
      if (count === 2) game.players[2][8] = card('Q');
      game.players[2][1] = card('3');
      game.pile[1] = card('J');
      await game.cpuPlay(2, game.generation);
      assert.equal(messages[0].duration, count > 1 ? (goFast ? 400 : 1200) : undefined);
    }
  }
});


test('four-card clearing notices use slower timing while ten clearing keeps normal timing', async () => {
  for (const goFast of [false, true]) {
    for (const number of ['Q', '10']) {
      const { game, messages } = setup();
      game.goFast = goFast;
      game.players[2][7] = card(number);
      game.players[2][1] = card('3');
      for (let i = 1; i <= 3; i++) game.pile[i] = card('Q');
      await game.cpuPlay(2, game.generation);
      const notice = messages.find(m => m.text.includes('cleared'));
      assert.ok(notice);
      assert.equal(notice.duration, number === 'Q' ? (goFast ? 400 : 1200) : undefined);
      assert.equal(game.pile.filter(Boolean).length, 0);
    }
  }
});


test('the winning-card notice spells out face-card names', async () => {
  for (const [number, name] of Object.entries({ A: 'ace', K: 'king', Q: 'queen', J: 'jack' })) {
    const { game, messages } = setup();
    game.players[1][1] = { ...card(number), suit: 2 };
    await game.playHuman(1);
    assert.ok(messages.some(m => m.text === `You played ${name} of clubs.\nYou win!`));
  }
});

function animationSetup() {
  const timers = [];
  const state = setup({ setTimeout: (fn, delay) => { timers.push({ fn, delay }); } });
  state.game.message = Object.getPrototypeOf(state.game).message;
  const frames = [];
  let drawing;
  for (const method of ['fill', 'rect', 'text']) state.renderer[method] = (...args) => drawing.push({ method, args });
  state.game.draw = () => {
    drawing = [];
    state.game.drawModal();
    frames.push(drawing);
  };
  const tick = async () => {
    assert.ok(timers.length);
    timers.shift().fn();
    for (let i = 0; i < 5; i++) await Promise.resolve();
  };
  return { ...state, timers, frames, tick };
}

test('message boxes expand at fixed height, reveal text at full width, then wait the requested duration', async () => {
  const { game, frames, timers, tick } = animationSetup();
  const work = game.message('CPU 1 lays 2 queens.\nPack cleared.', game.generation, 1200);
  assert.equal(frames[0].some(call => call.method === 'text'), false);
  let previousWidth = 0;
  while (game.modal.progress < 1) {
    const fill = frames.at(-1).find(call => call.method === 'fill').args;
    assert.ok(fill[2] - fill[0] >= previousWidth);
    assert.equal(fill[3] - fill[1], 40);
    previousWidth = fill[2] - fill[0];
    assert.equal(timers[0].delay, 1000 / 70);
    await tick();
  }
  assert.equal(frames.at(-1).filter(call => call.method === 'text').length, 2);
  assert.equal(timers[0].delay, 1200);
  await tick();
  await work;
  assert.equal(game.modal, null);
});

test('new game cancels box expansion without overwriting the new deal', async () => {
  const { game, timers, tick } = animationSetup();
  const work = game.message('Old game');
  game.newGame();
  await tick();
  await work;
  assert.equal(game.modal, null);
  assert.equal(game.phase, 'setup');
  assert.equal(timers.length, 0);
});

test('the information panel grows from the corner and can be dismissed during expansion', async () => {
  const { game, frames, timers, tick } = animationSetup();
  const work = game.openInfo();
  assert.deepEqual(frames[0][0].args.slice(0, 4), [0, 0, 2, 2]);
  await tick();
  assert.deepEqual(frames.at(-1)[0].args.slice(0, 4), [0, 0, 5, 8]);
  game.click(0);
  await tick();
  await work;
  assert.equal(game.modal, null);
  assert.equal(timers.length, 0);
});

test('an older notice cannot clear a newer notice in the same game', async () => {
  const { game, tick } = animationSetup();
  const work = game.message('First');
  while (game.modal.progress < 1) await tick();
  const replacement = { kind: 'results', text: 'Results' };
  game.modal = replacement;
  await tick();
  await work;
  assert.equal(game.modal, replacement);
});

function fadeSetup() {
  const timers = [];
  const state = setup({ setTimeout: (fn, delay) => timers.push({ fn, delay }) });
  const frames = [];
  state.game.draw = () => frames.push({ phase: state.game.phase, level: state.game.fadeLevel });
  const tick = async () => {
    assert.ok(timers.length);
    timers.shift().fn();
    for (let i = 0; i < 6; i++) await Promise.resolve();
  };
  return { ...state, timers, frames, tick };
}

test('startup uses original 64-step fades, intro holds, and fades the first board from black', async () => {
  const { game, timers, frames, tick } = fadeSetup();
  const work = game.intro();
  for (let i = 0; i < 64; i++) {
    assert.equal(game.fadeLevel, i);
    assert.equal(timers[0].delay, 1000 / 70);
    await tick();
  }
  assert.equal(timers[0].delay, 3500);
  await tick();
  for (let i = 63; i >= 0; i--) {
    assert.equal(game.fadeLevel, i);
    await tick();
  }
  assert.equal(timers[0].delay, 500);
  assert.equal(game.fadeLevel, 0);
  await tick();
  assert.equal(game.phase, 'dealing');
  assert.equal(frames.find(frame => frame.phase === 'dealing').level, 0);
  for (let i = 0; i < 64; i++) {
    assert.equal(game.fadeLevel, i);
    await tick();
  }
  await work;
  assert.equal(game.phase, 'setup');
  assert.equal(game.fadeLevel, 63);
  assert.equal(timers.length, 0);
});

test('restarting during the intro hold or board fade cancels the previous animation', async () => {
  for (const stage of ['intro hold', 'board fade']) {
    const { game, timers, tick } = fadeSetup();
    const work = stage === 'intro hold' ? game.intro() : game.newGame(true);
    if (stage === 'intro hold') for (let i = 0; i < 64; i++) await tick();
    game.newGame();
    const players = game.players;
    await tick();
    await work;
    assert.equal(game.players, players);
    assert.equal(game.phase, 'setup');
    assert.equal(game.fadeLevel, 63);
    assert.equal(timers.length, 0);
  }
});

test('palette fading scales all channels equally to preserve colours', () => {
  const context = vm.createContext({});
  const source = fs.readFileSync(path.join(__dirname, '../vga.js'), 'utf8').replace('export class VGA', 'class VGA');
  vm.runInContext(`${source}\nglobalThis.Renderer = VGA;`, context);
  let output;
  const renderer = new context.Renderer({ getContext: () => ({
    createImageData: () => ({ data: new Uint8ClampedArray(320 * 200 * 4) }),
    putImageData: image => { output = image.data; },
  }) });
  renderer.palette.set([10, 32, 63]);
  renderer.present(20);
  assert.deepEqual([...output.slice(0, 4)], [13, 41, 81, 255]);
  renderer.present(0);
  assert.deepEqual([...output.slice(0, 4)], [0, 0, 0, 255]);
  renderer.present();
  assert.deepEqual([...output.slice(0, 4)], [40, 130, 255, 255]);
});

test('a Jack from either secondary row is rejected on a King using real dealt card values', async () => {
  for (const index of [1, 2, 3, 4, 5, 6]) {
    const state = setup();
    const { game, messages } = state;
    game.newGame();
    const cards = [...game.deck, ...game.players.slice(1).flat()].filter(Boolean);
    const jack = cards.find(card => card.number === 'J');
    const king = cards.find(card => card.number === 'K');
    assert.equal(jack.value, 11);
    assert.equal(king.value, 13);
    game.players.forEach(hand => hand?.fill(null));
    game.deck.fill(null);
    game.players[1][index] = jack;
    game.players[2][7] = cards.find(card => card.number === '3');
    game.players[3][7] = cards.find(card => card.number === '4');
    game.pile[1] = king;
    await game.playHuman(index);
    assert.ok(messages.some(m => m.text === 'Card not high enough!'));
    assert.deepEqual([...game.players[1]].filter(Boolean).map(card => card.number).sort(), ['J', 'K']);
    assert.equal(game.pile.filter(Boolean).length, 0);
    assert.equal(game.phase, 'human');
    assert.equal(game.finishOrder.length, 0);
    assert.equal(state.cpuTurns(), 0);
  }
});

test('selected secondary-hand Jacks cannot validate one another on top of a King', async () => {
  const state = setup();
  const { game, messages } = state;
  game.players[1][4] = card('J');
  game.players[1][5] = { ...card('J'), suit: 2 };
  game.pile[1] = card('K');
  game.select(4);
  game.select(5);
  await game.playHuman(4);
  assert.ok(messages.some(m => m.text === 'Card not high enough!'));
  assert.equal(game.players[1].filter(Boolean).length, 3);
  assert.equal(game.pile.filter(Boolean).length, 0);
  assert.equal(state.cpuTurns(), 0);
});

test('clicking the completed results box restarts, while outside and right clicks do not', () => {
  const { game } = setup();
  game.phase = 'finished';
  game.finished = true;
  game.modal = { kind: 'results', text: 'CPU 2 is the shithead!\n1st: You\n2nd: CPU 1\n3rd: CPU 2', progress: 1 };
  game.mouse = { x: 0, y: 0 };
  game.click(0);
  assert.equal(game.phase, 'finished');
  game.mouse = { x: 160, y: 100 };
  game.click(2);
  assert.equal(game.phase, 'finished');
  game.modal.progress = 0.5;
  game.click(0);
  assert.equal(game.phase, 'finished');
  game.modal.progress = 1;
  game.click(0);
  assert.equal(game.phase, 'setup');
  assert.equal(game.finished, false);
  assert.equal(game.modal, null);
  assert.equal(game.players[1].filter(Boolean).length, 9);
});

test('secondary plays announce the card or group before CPUs continue', async () => {
  for (const index of [1, 4]) {
    const state = setup();
    const { game, messages } = state;
    game.players[1][index] = { ...card('J'), suit: 2 };
    game.players[1][3] = card('9');
    game.pile[1] = card('9');
    await game.playHuman(index);
    assert.equal(messages[0].text, 'You played jack of clubs.');
    assert.equal(messages[0].duration, 800);
    assert.equal(state.cpuTurns(), 1);
  }
  const { game, messages } = setup();
  game.players[1][1] = card('3');
  game.players[1][4] = card('Q');
  game.players[1][5] = { ...card('Q'), suit: 2 };
  game.select(4);
  game.select(5);
  await game.playHuman(4);
  assert.equal(messages[0].text, 'You played 2 queens.');
  assert.equal(messages[0].duration, 1200);
});

test('a rejected secondary card is announced before the rejection and pickup', async () => {
  const { game, messages } = setup();
  game.players[1][1] = { ...card('J'), suit: 2 };
  game.pile[1] = card('K');
  await game.playHuman(1);
  assert.equal(messages[0].text, 'You played jack of clubs.');
  assert.equal(messages[1].text, 'Card not high enough!');
  assert.equal(game.players[1].filter(Boolean).length, 2);
});

test('primary plays stay quiet and a new deal cancels a secondary-card notice', async () => {
  const state = setup();
  const { game, messages } = state;
  game.players[1][1] = card('3');
  game.players[1][7] = card('J');
  await game.playHuman(7);
  assert.equal(messages.length, 0);
  game.phase = 'human';
  game.players[1][4] = card('Q');
  game.message = async () => game.newGame();
  await game.playHuman(4);
  assert.equal(game.phase, 'setup');
  assert.equal(game.players[1].filter(Boolean).length, 9);
  assert.equal(state.cpuTurns(), 1);
});

test('a CPU says it cannot go after a failed face-down reveal, then picks up the pile', async () => {
  const { game, messages } = setup();
  game.players[2].fill(null);
  game.players[2][1] = card('8');
  game.pile[1] = card('K');
  assert.equal(await game.cpuPlay(2, game.generation), true);
  assert.deepEqual(messages.map(m => m.text), ['CPU 1 cannot go.', 'CPU 1 picks up the pack.']);
  assert.equal(game.pile.filter(Boolean).length, 0);
  assert.equal(game.players[2].filter(Boolean).length, 2);
});

test('a new game during an invalid CPU play notice cancels the pending pickup', async () => {
  const { game } = setup();
  game.players[2][7] = card('J');
  game.pile[1] = card('K');
  const notices = [];
  game.message = async text => { notices.push(text); game.newGame(); };
  assert.equal(await game.cpuPlay(2, game.generation), false);
  assert.deepEqual(notices, ['CPU 1 cannot go.']);
  assert.equal(game.phase, 'setup');
  assert.equal(game.players[2].filter(Boolean).length, 9);
  assert.equal(game.pile.filter(Boolean).length, 0);
});

test('playing the opening card commits setup and begins CPU turns', async () => {
  const { game } = setup();
  game.newGame();
  game.players[1][7] = card('5');
  let turns = 0;
  game.cpuTurns = () => { turns++; game.phase = 'cpu'; };
  game.mouse = { x: 40, y: 140 };
  game.click(0);
  await Promise.resolve();
  assert.equal(game.phase, 'cpu');
  assert.equal(turns, 1);
  assert.equal(game.pile[1].number, '5');
  assert.equal(game.players[1].slice(4, 7).filter(Boolean).length, 3);
});

test('on an empty pile CPUs play the lowest matching cards and save twos and tens', async () => {
  for (const row of [4, 7]) {
    const { game, messages } = setup();
    game.players[2].fill(null);
    game.players[2][row] = card('10');
    game.players[2][row + 1] = card('2');
    game.players[2][row + 2] = card('3');
    if (row === 7) game.players[2][10] = { ...card('3'), suit: 2 };
    await game.cpuPlay(2, game.generation);
    assert.equal(game.pile[1].number, '3');
    assert.equal(game.players[2].filter(c => c?.number === '2').length, 1);
    assert.equal(game.players[2].filter(c => c?.number === '10').length, 1);
    assert.equal(messages[0].text, row === 7 ? 'CPU 1 lays 2 threes.' : 'CPU 1 lays a three.');
  }
});

test('on an empty pile CPUs prefer an ace over a two, and a two over a ten', async () => {
  for (const [numbers, expected] of [[['10', '2', 'A'], 'A'], [['10', '2'], '2']]) {
    const { game } = setup();
    game.players[2].fill(null);
    numbers.forEach((number, i) => { game.players[2][4 + i] = card(number); });
    await game.cpuPlay(2, game.generation);
    assert.equal(game.pile[1].number, expected);
  }
});

test('empty-pile face-down choices remain random instead of inspecting hidden ranks', async () => {
  let draws = 0;
  const { game, messages } = setup({ Math: Object.assign(Object.create(Math), { random: () => (draws++ % 2) / 2 }) });
  game.players[2].fill(null);
  game.players[2][1] = card('10');
  game.players[2][2] = card('3');
  await game.cpuPlay(2, game.generation);
  assert.equal(messages[0].text, 'CPU 1 lays a ten.');
  assert.equal(game.players[2][2].number, '3');
});

test('CPUs spend only one two or ten while other ranks remain in the active row', async () => {
  for (const number of ['2', '10']) {
    for (const row of [4, 7]) {
      const { game, messages } = setup();
      game.players[2].fill(null);
      game.players[2][row] = card(number);
      game.players[2][row + 1] = { ...card(number), suit: 2 };
      game.players[2][row + 2] = card('3');
      game.pile[1] = card('K');
      await game.cpuPlay(2, game.generation);
      assert.equal(game.players[2].filter(c => c?.number === number).length, 1);
      assert.equal(game.players[2].filter(c => c?.number === '3').length, 1);
      assert.equal(messages[0].text, `CPU 1 lays a ${number === '2' ? 'two' : 'ten'}.`);
    }
  }
});

test('CPUs can lay matching specials together to empty the active row', async () => {
  for (const number of ['2', '10']) {
    for (const row of [4, 7]) {
      const { game, messages } = setup();
      game.players[2].fill(null);
      game.players[2][1] = card('3');
      if (row === 7) game.players[2][4] = card('4');
      game.players[2][row] = card(number);
      game.players[2][row + 1] = { ...card(number), suit: 2 };
      game.pile[1] = card('K');
      await game.cpuPlay(2, game.generation);
      assert.equal(game.players[2].filter(c => c?.number === number).length, 0);
      assert.equal(game.players[2][1].number, '3');
      assert.equal(messages[0].text, `CPU 1 lays 2 ${number === '2' ? 'twos' : 'tens'}.`);
    }
  }
});

test('holding only mixed specials still saves duplicates if the play would not empty the hand', async () => {
  const { game, messages } = setup();
  game.players[2][7] = card('2');
  game.players[2][8] = { ...card('2'), suit: 2 };
  game.players[2][9] = card('10');
  await game.cpuPlay(2, game.generation);
  assert.equal(messages[0].text, 'CPU 1 lays a two.');
  assert.equal(game.players[2].filter(c => c?.number === '2').length, 1);
  assert.equal(game.players[2].filter(c => c?.number === '10').length, 1);
});
