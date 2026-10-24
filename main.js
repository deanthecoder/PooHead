import { VGA } from './vga.js';

const canvas = document.querySelector('#screen');
const status = document.querySelector('#status');
const vga = new VGA(canvas);
const emptyHand = () => Array(53).fill(null);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const clone = card => card && { ...card };

class Game {
  constructor() {
    this.generation = 0;
    this.mouse = null;
    this.modal = null;
    this.phase = 'loading';
    this.leftCard = 7;
    this.selected = new Set();
  }

  async init() {
    await Promise.all(['BACKGRND.SPR', '4X5.FNT'].map(name => vga.load(name)));
    this.palette = vga.sprites['BACKGRND.SPR'].palette.slice();
    // ShadeBackground in GRAPHICS.PAS changes palette entries 216..255.
    for (let i = 0; i < 40; i++) {
      const p = (216 + i) * 3;
      this.palette[p] = 0; this.palette[p + 1] = 0; this.palette[p + 2] = i;
    }
    vga.setPalette(this.palette);
    this.bindInput();
    await this.intro();
    if (this.phase === 'intro') this.newGame();
  }

  bindInput() {
    const fitScreen = () => {
      const wrap = document.querySelector('.screen-wrap');
      const toolbar = document.querySelector('.toolbar');
      const aspect = document.querySelector('#crt-aspect').checked ? 4 / 3 : 8 / 5;
      const availableHeight = Math.max(180, window.innerHeight - wrap.getBoundingClientRect().top - toolbar.offsetHeight - 24);
      const width = Math.floor(Math.min(1280, wrap.clientWidth, availableHeight * aspect));
      canvas.style.width = `${width}px`;
      canvas.style.height = `${Math.floor(width / aspect)}px`;
    };
    window.addEventListener('resize', fitScreen);
    fitScreen();
    const updateMouse = event => {
      const bounds = canvas.getBoundingClientRect();
      this.mouse = {
        x: Math.max(0, Math.min(319, Math.floor((event.clientX - bounds.left) * 320 / bounds.width))),
        y: Math.max(0, Math.min(199, Math.floor((event.clientY - bounds.top) * 200 / bounds.height))),
      };
    };
    canvas.addEventListener('pointermove', event => { updateMouse(event); this.draw(); });
    canvas.addEventListener('pointerleave', () => { this.mouse = null; this.draw(); });
    canvas.addEventListener('pointerdown', event => {
      event.preventDefault();
      canvas.focus();
      updateMouse(event);
      if (this.phase === 'intro') { this.generation++; this.newGame(); return; }
      this.click(event.button);
    });
    canvas.addEventListener('contextmenu', event => event.preventDefault());
    document.querySelector('#new-game').addEventListener('click', () => this.newGame());
    document.querySelector('#crt-aspect').addEventListener('change', event => {
      fitScreen();
    });
  }

  async intro() {
    const generation = ++this.generation;
    this.phase = 'intro';
    this.draw();
    for (let i = 0; i <= 63 && generation === this.generation; i += 3) {
      this.draw(Math.min(1, i / 63)); await sleep(16);
    }
    if (generation !== this.generation) return;
    this.draw(); await sleep(1900);
    for (let i = 63; i >= 0 && generation === this.generation; i -= 3) {
      this.draw(i / 63); await sleep(16);
    }
  }

  newGame() {
    this.generation++;
    this.players = [null, emptyHand(), emptyHand(), emptyHand()];
    this.deck = emptyHand();
    this.pile = emptyHand();
    this.selected.clear();
    this.selectedValue = 0;
    this.currentPlayer = 1;
    this.playersLeft = 3;
    this.finished = false;
    this.goFast = false;
    this.leftCard = 7;
    this.modal = null;
    this.phase = 'human';

    const values = [15, 3, 4, 5, 6, 7, 8, 9, 16, 11, 12, 13, 14];
    const numbers = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    for (let i = 1; i <= 52; i++) this.deck[i] = {
      suit: Math.floor((i - 1) / 13) + 1,
      value: values[(i - 1) % 13],
      number: numbers[(i - 1) % 13],
    };
    // The original shuffles by swapping two different cards 1000 times.
    for (let i = 0; i < 1000; i++) {
      const a = 1 + Math.floor(Math.random() * 52);
      let b; do { b = 1 + Math.floor(Math.random() * 52); } while (b === a);
      [this.deck[a], this.deck[b]] = [this.deck[b], this.deck[a]];
    }
    let next = 1;
    for (let p = 1; p <= 3; p++) for (let i = 1; i <= 9; i++) {
      this.players[p][i] = this.deck[next];
      this.deck[next++] = null;
    }
    while (!this.deck[1]) this.scrollUpPack();
    this.sortCards(1);
    status.textContent = 'Your turn';
    this.draw();
  }

  scrollUpPack() { const first = this.deck[1]; for (let i = 1; i < 52; i++) this.deck[i] = this.deck[i + 1]; this.deck[52] = first; }
  sortCards(player) {
    const hand = this.players[player];
    let max = 52;
    while (!hand[max]) { if (max === 8) return; max--; }
    for (let j = 7; j < max; j++) for (let i = 7; i < max; i++)
      if (hand[i]?.value > hand[i + 1]?.value) [hand[i], hand[i + 1]] = [hand[i + 1], hand[i]];
  }
  playerFinished(player) { return this.players[player].slice(1).every(card => !card); }
  topFourSame() { return this.pile.slice(1, 5).every(card => card && card.value === this.pile[1].value); }
  clearPile() { this.pile.fill(null); this.draw(); }
  makeSpaceOnPile(card) { for (let i = 52; i >= 2; i--) this.pile[i] = this.pile[i - 1]; this.pile[1] = clone(card); }
  removeCard(hand, index) {
    if (index < 7) { hand[index] = null; return; }
    for (let i = index; i < 52; i++) hand[i] = hand[i + 1];
    hand[52] = null;
  }
  pickup(player) {
    if (!this.pile[1]) { if (player === 1) this.message('No cards to pick up!'); return false; }
    const hand = this.players[player];
    let slot = 7; while (hand[slot]) slot++;
    for (let i = 1; i <= 52 && this.pile[i]; i++) { hand[slot++] = this.pile[i]; this.pile[i] = null; }
    this.sortCards(player);
    this.draw();
    return true;
  }
  replenish(player) {
    if (!this.deck[1]) { this.draw(); return; }
    const hand = this.players[player];
    while (!hand[9] && this.deck[1]) {
      let last = 52; while (!hand[last] && last > 1) last--;
      hand[last + 1] = this.deck[1];
      this.scrollUpPack();
    }
    this.sortCards(player);
    this.draw();
  }
  clearSelection() { this.selected.clear(); this.selectedValue = 0; }

  cardAt(x, y) {
    const hand = this.players[1];
    const inside = (a, b, c, d) => x >= a && x <= c && y >= b && y <= d;
    for (let i = this.leftCard; i <= this.leftCard + 4; i++) {
      const cx = 30 + (i - this.leftCard) * 54;
      if (hand[i] && inside(cx, 125, cx + 44, 184)) return i;
    }
    for (let i = 4; i <= 6; i++) {
      const cx = (i - 3) * 47 - 38;
      if (hand[i] && inside(cx, 27, cx + 44, 86)) return i;
    }
    for (let i = 1; i <= 3; i++) {
      const cx = i * 47 - 38;
      if (hand[i] && !hand[i + 3] && inside(cx, 20, cx + 44, 79)) return i;
    }
    if (inside(246, 23, 290, 82)) return 100;
    if (this.leftCard > 7 && inside(3, 140, 12, 169)) return 101;
    if (hand[this.leftCard + 5] && inside(306, 140, 315, 169)) return 102;
    if (inside(0, 0, 2, 2)) return 103;
    return 0;
  }

  click(button) {
    if (this.modal?.kind === 'info') { this.modal = null; this.draw(); return; }
    if (this.modal?.kind === 'quit') {
      this.modal = null;
      if (button === 2) { this.phase = 'stopped'; status.textContent = 'Stopped — use New game to play again'; }
      this.draw(); return;
    }
    if (this.phase === 'finished') {
      if (button === 0) this.newGame();
      else { this.phase = 'stopped'; this.modal = null; this.draw(); }
      return;
    }
    if (this.phase !== 'human' || !this.mouse) return;
    const index = this.cardAt(this.mouse.x, this.mouse.y);
    if (button === 2) {
      if (!index) { this.modal = { kind: 'quit', text: 'Left mouse button continues or Right quits.' }; this.draw(); }
      else if (index >= 4 && index < 100) this.select(index);
      return;
    }
    if (button !== 0) return;
    if (index === 100) { this.pickup(1); return; }
    if (index === 101 || index === 102) {
      this.leftCard += index === 101 ? -1 : 1;
      this.draw(); return;
    }
    if (index === 103) { this.modal = { kind: 'info' }; this.draw(); return; }
    if (index > 0 && index < 100) this.playHuman(index);
  }
  select(index) {
    const hand = this.players[1];
    if (index < 7 && hand[7]) return;
    const card = hand[index];
    if (this.selectedValue && card.value !== this.selectedValue) return;
    this.selectedValue = card.value;
    if (this.selected.has(index)) this.selected.delete(index); else this.selected.add(index);
    if (!this.selected.size) this.selectedValue = 0;
    this.draw();
  }
  async playHuman(index) {
    const generation = this.generation;
    const hand = this.players[1];
    if (index < 7 && hand[7]) return;
    const previous = this.pile[1];
    if (!this.selected.has(index)) { this.clearSelection(); this.selected.add(index); this.selectedValue = hand[index].value; }
    for (let i = 52; i >= 1; i--) if (this.selected.has(i)) {
      this.makeSpaceOnPile(hand[i]); this.removeCard(hand, i);
    }
    this.clearSelection(); this.phase = 'busy'; this.draw();
    const valid = !previous || this.pile[1].value >= previous.value ||
      this.pile[1].number === '2' || previous.number === '2';
    if (!valid) {
      await this.message('Card not high enough!', generation);
      if (generation !== this.generation) return;
      this.pickup(1); this.phase = 'human'; status.textContent = 'Your turn'; this.draw(); return;
    }
    let again = false;
    if (this.pile[1].number === '10') {
      await this.message('10 clears the pack...', generation); again = true;
    } else if (this.topFourSame()) {
      await this.message('top 4 cards are the same. Pack cleared.', generation); again = true;
    }
    if (generation !== this.generation) return;
    if (again) this.clearPile();
    this.replenish(1);
    if (this.playerFinished(1)) {
      this.goFast = true;
      await this.message('Human player is out!', generation);
      if (generation !== this.generation) return;
      if (await this.reducePlayers(generation)) return;
    }
    if (generation !== this.generation) return;
    if (again) { this.phase = 'human'; status.textContent = 'Your turn again'; this.draw(); }
    else this.cpuTurns(generation);
  }

  async reducePlayers(generation) {
    this.playersLeft--;
    if (this.playersLeft !== 1) return false;
    let loser = 1;
    for (let p = 1; p <= 3; p++) if (!this.playerFinished(p)) loser = p;
    await this.message(`${loser === 1 ? 'you are' : `cpu ${loser - 1} is`} the poohead!`, generation, 2300);
    if (generation !== this.generation) return true;
    this.finished = true; this.phase = 'finished';
    this.modal = { kind: 'replay', text: 'Left mouse button continues or Right quits.' };
    status.textContent = 'Game over — left click to play again';
    this.draw();
    return true;
  }

  async cpuTurns(generation) {
    this.phase = 'cpu'; status.textContent = 'CPU turn';
    for (const player of [2, 3]) {
      if (generation !== this.generation) return;
      if (this.playerFinished(player)) continue;
      let another = true, guard = 0;
      while (another && guard++ < 100 && generation === this.generation) another = await this.cpuPlay(player, generation);
      if (this.finished) return;
    }
    if (generation !== this.generation) return;
    if (this.playerFinished(1)) {
      // The DOS loop continues straight past the human when they are out.
      setTimeout(() => { if (generation === this.generation) this.cpuTurns(generation); }, 0);
    } else {
      this.phase = 'human'; status.textContent = 'Your turn'; this.draw();
    }
  }
  higher(card) {
    return !this.pile[1] || card.number === '2' || this.pile[1].number === '2' || card.value >= this.pile[1].value;
  }
  async cpuPlay(player, generation) {
    const hand = this.players[player];
    if (this.playerFinished(player)) return false;
    this.sortCards(player);
    const secondRow = !!(hand[4] || hand[5] || hand[6]);
    const firstRow = !secondRow && !hand[7] && !!(hand[1] || hand[2] || hand[3]);
    let cardNo = 0;
    if (firstRow) {
      const options = [1, 2, 3].filter(i => hand[i]);
      cardNo = options[Math.floor(Math.random() * options.length)];
    } else {
      const minimum = hand[7] ? 7 : 4;
      for (let i = 52; i >= minimum; i--) if (hand[i] && this.higher(hand[i])) cardNo = i;
    }
    if (!this.pile[1]) {
      const old = cardNo;
      for (let i = 0; i <= 1000; i++) {
        const choice = 7 + Math.floor(Math.random() * 45);
        if (hand[choice]) { cardNo = choice; break; }
      }
      if (!cardNo) cardNo = old;
    }
    if (!cardNo) { cardNo = 52; while (!hand[cardNo]) cardNo--; }
    this.makeSpaceOnPile(hand[cardNo]); this.removeCard(hand, cardNo); this.draw();
    const top = this.pile[1], below = this.pile[2];
    const valid = !below || top.value >= below.value || top.number === '2' || below.number === '2';
    if (!valid) {
      await this.message(`CPU ${player - 1} picks up the pack.`, generation);
      if (generation !== this.generation) return false;
      this.pickup(player); return true;
    }
    const names = { '2': 'two', '3': 'three', '4': 'four', '5': 'five', '6': 'six', '7': 'seven', '8': 'eight', '9': 'nine', '10': 'ten', J: 'jack', Q: 'queen', K: 'king', A: 'ace' };
    await this.message(`cpu ${player - 1} lays a${'8A'.includes(top.number) ? 'n' : ''} ${names[top.number]}.`, generation);
    if (generation !== this.generation) return false;
    this.replenish(player);
    if (top.number === '10' || this.topFourSame()) {
      await this.message(top.number === '10' ? 'pack cleared.' : 'top four cards the same! pack cleared...', generation);
      if (generation !== this.generation) return false;
      this.clearPile();
      if (this.playerFinished(player)) {
        await this.message(`CPU ${player - 1} is out!`, generation);
        if (generation === this.generation) await this.reducePlayers(generation);
        return false;
      }
      return true;
    }
    if (this.playerFinished(player)) {
      await this.message(`CPU ${player - 1} is out!`, generation);
      if (generation !== this.generation) return false;
      await this.reducePlayers(generation);
    }
    return false;
  }

  async message(text, generation = this.generation, duration = this.goFast ? 80 : 800) {
    this.modal = { kind: 'message', text }; this.draw();
    await sleep(duration);
    if (generation === this.generation) { this.modal = null; this.draw(); }
  }

  drawDesign(x, y, rows, color) {
    rows.forEach((row, ry) => { for (let rx = 0; rx < 7; rx++) if (row[rx] !== ' ') vga.pixel(x + rx, y + ry, color); });
  }
  drawCard(visible, card, x, y) {
    vga.fill(x, y, x + 44, y + 59, 215);
    vga.rect(x + 1, y + 1, x + 43, y + 58, 0);
    if (!visible) {
      vga.fill(x + 3, y + 3, x + 41, y + 56, 18);
      for (let i = 1; i <= 39; i += 3) {
        vga.line(x + 3, y + 56, x + i + 2, y + 3, 24);
        vga.line(x + 41, y + 3, x + 42 - i, y + 56, 24);
      }
      return;
    }
    const layouts = {
      14: '000010000000', 15: '010000000010', 3: '101000000010',
      4: '101000000101', 5: '101010000101', 6: '100110011001',
      7: '010111111000', 8: '101101101101', 9: '101111101101',
      16: '111101101111', 11: '111010010110', 12: '111101101110',
      13: '101110110101',
    };
    const suits = {
      1: ['   #   ', '  ###  ', ' ##### ', '#######', ' # # # ', '   #   ', '       '],
      2: ['   #   ', '  ###  ', ' # # # ', '#######', ' # # # ', '   #   ', '       '],
      3: [' ## ## ', '#######', '#######', '#######', ' ##### ', '   #   ', '       '],
      4: ['   #   ', '  ###  ', ' ##### ', '#######', ' ##### ', '  ###  ', '   #   '],
    };
    const color = card.suit < 3 ? 0 : 24;
    for (let i = 0; i < 12; i++) if (layouts[card.value][i] === '1') {
      const cx = x + ((i % 3) + 1) * 10 - 1;
      const cy = y + (Math.floor(i / 3) + 1) * 10 + 2;
      this.drawDesign(cx, cy, suits[card.suit], color);
    }
    if (card.value === 12) {
      vga.line(x + 25, y + 38, x + 35, y + 48, color);
      vga.line(x + 26, y + 38, x + 36, y + 48, color);
    }
    vga.text(card.number, x + 3, y + 3, color);
    vga.text(card.number, x + (card.number.length === 1 ? 38 : 33), y + 51, color);
  }
  drawArrow(x, active, right) {
    vga.fill(x, 140, x + 9, 169, 172);
    vga.line(x, 140, x, 169, 215); vga.line(x, 140, x + 9, 140, 215);
    vga.line(x + 9, 141, x + 9, 169, 129); vga.line(x + 1, 169, x + 9, 169, 129);
    const shape = right
      ? ['  #    ', '  ##   ', '#####  ', '###### ', '#####  ', '  ##   ', '  #    ']
      : ['   #   ', '  ##   ', ' ##### ', '###### ', ' ##### ', '  ##   ', '   #   '];
    this.drawDesign(x + 2, 152, shape, active ? 0 : 129);
  }
  drawBoard() {
    vga.tile(vga.sprites['BACKGRND.SPR']);
    vga.scaledText('POOHEAD', 10, 2, 2, 3);
    vga.scaledText('POOHEAD', 9, 2, 2, 155);
    vga.text('BY EDIS ENTERPRISES 96', 101, 5, 203);
    // GLIB's Darken subtracts one palette index per pixel in these areas.
    for (const [x1, y1, x2, y2] of [[0, 191, 319, 197], [5, 17, 151, 98], [241, 17, 300, 98]]) {
      for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++) {
        const at = y * 320 + x; vga.pixels[at] = (vga.pixels[at] - 1) & 255;
      }
    }
    vga.text('Primary Hand', 130, 192, 180);
    vga.text('Secondary Hand', 42, 92, 180);
    vga.text('Top Card', 251, 92, 180);
    this.drawArrow(3, this.leftCard > 7, false);
    this.drawArrow(306, !!this.players[1][this.leftCard + 5], true);
    vga.fill(0, 0, 2, 2, 172);
    const hand = this.players[1];
    for (let i = this.leftCard; i <= this.leftCard + 4; i++)
      if (hand[i]) this.drawCard(true, hand[i], 30 + (i - this.leftCard) * 54, 125);
    for (let i = 1; i <= 3; i++) {
      const x = i * 47 - 38;
      if (hand[i]) this.drawCard(false, hand[i], x, 20);
      if (hand[i + 3]) this.drawCard(true, hand[i + 3], x, 27);
    }
    if (this.pile[1]) {
      if (this.pile[3]) this.drawCard(false, this.pile[1], 250, 27);
      if (this.pile[2]) this.drawCard(false, this.pile[1], 248, 25);
      this.drawCard(true, this.pile[1], 246, 23);
    }
    for (const i of this.selected) {
      let x, y;
      if (i >= 7) { x = 30 + (i - this.leftCard) * 54; y = 125; }
      else if (i >= 4) { x = (i - 3) * 47 - 38; y = 27; }
      else { x = i * 47 - 38; y = 20; }
      vga.rect(x - 1, y - 1, x + 45, y + 60, 210);
    }
  }
  drawModal() {
    if (!this.modal) return;
    if (this.modal.kind === 'info') {
      vga.fill(0, 0, 92, 38, 172); vga.rect(1, 1, 91, 37, 0);
      for (const [label, y, count] of [
        ['information', 3, null], ['pile size', 13, this.pile],
        ['cpu 1 cards', 19, this.players[2]], ['cpu 2 cards', 25, this.players[3]],
        ['player cards', 31, this.players[1]],
      ]) { vga.text(label, 5, y, 0); if (count) vga.text(String(count.slice(1).filter(Boolean).length), 73, y, 210); }
      return;
    }
    const text = this.modal.text;
    const x = Math.floor((320 - text.length * 5) / 2);
    vga.fill(x - 20, 85, x + text.length * 5 + 20, 115, 72);
    vga.rect(x - 21, 84, x + text.length * 5 + 21, 116, 72);
    vga.rect(x - 20, 85, x + text.length * 5 + 20, 115, 180);
    vga.text(text, x, 97, 180);
  }
  draw(brightness = 1) {
    if (this.phase === 'loading') return;
    if (this.phase === 'intro') {
      vga.clear(0);
      for (let y = 0; y < 200; y++) vga.fill(0, y, 319, y, 216 + Math.floor(y / 5));
      vga.scaledText('POOHEAD', 24, 77, 8, 3);
      vga.scaledText('POOHEAD', 20, 73, 8, 113);
      vga.scaledText('POOHEAD', 20, 72, 8, 185);
      for (const [x, y, c] of [[91, 140, 72], [93, 140, 72], [91, 139, 72], [93, 141, 72], [92, 140, 180]])
        vga.text('written by edis enterprises', x, y, c);
    } else if (this.players) {
      this.drawBoard(); this.drawModal();
      if (this.mouse) {
        const { x, y } = this.mouse;
        for (const [dx, dy] of [[0, -2], [0, -1], [-2, 0], [-1, 0], [1, 0], [2, 0], [0, 1], [0, 2]])
          vga.pixel(x + dx, y + dy, 138);
      }
    }
    vga.present(brightness);
  }
}

const game = new Game();
game.init().catch(error => {
  console.error(error);
  status.textContent = `Could not start: ${error.message}`;
});
