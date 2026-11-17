import { VGA } from './vga.js?v=smooth-fades-1';

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
    this.fadeLevel = 63;
    this.leftCard = 7;
    this.selected = new Set();
  }

  async init() {
    await Promise.all(['BACKGRND.SPR', '4X5.FNT', 'LOGO.SPR', 'TITLE.SPR'].map(name => vga.load(name)));
    this.palette = vga.sprites['BACKGRND.SPR'].palette.slice();
    // ShadeBackground in GRAPHICS.PAS changes palette entries 216..255.
    for (let i = 0; i < 40; i++) {
      const p = (216 + i) * 3;
      this.palette[p] = 0; this.palette[p + 1] = 0; this.palette[p + 2] = i;
    }
    vga.setPalette(this.palette);
    this.bindInput();
    await this.intro();
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
    let press = null;
    const cancelPress = () => {
      if (!press) return;
      clearTimeout(press.timer);
      const pointerId = press.pointerId;
      press = null;
      if (canvas.hasPointerCapture(pointerId)) canvas.releasePointerCapture(pointerId);
    };
    const performPress = (pending, button) => {
      // A hold must not carry over into a new deal, turn, or dialog.
      if (pending.generation !== this.generation || pending.phase !== this.phase || pending.modal !== this.modal) return;
      updateMouse(pending.event);
      this.click(button);
    };
    canvas.addEventListener('pointermove', event => {
      if (press && event.pointerId !== press.pointerId) return;
      if (press && Math.hypot(event.clientX - press.event.clientX, event.clientY - press.event.clientY) > 10) cancelPress();
      updateMouse(event);
      this.draw();
    });
    canvas.addEventListener('pointerleave', () => { this.mouse = null; this.draw(); });
    canvas.addEventListener('pointerdown', event => {
      event.preventDefault();
      if (!event.isPrimary) { cancelPress(); return; }
      cancelPress();
      canvas.focus();
      updateMouse(event);
      if (this.phase === 'intro') { this.newGame(true); return; }
      if (event.button !== 0) { this.click(event.button); return; }
      press = {
        pointerId: event.pointerId, event,
        generation: this.generation, phase: this.phase, modal: this.modal,
        held: false,
      };
      canvas.setPointerCapture(event.pointerId);
      const pending = press;
      press.timer = setTimeout(() => {
        pending.held = true;
        performPress(pending, 2);
      }, 500);
      this.draw();
    });
    canvas.addEventListener('pointerup', event => {
      if (!press || event.pointerId !== press.pointerId) return;
      event.preventDefault();
      const pending = press;
      cancelPress();
      if (!pending.held && Math.hypot(event.clientX - pending.event.clientX, event.clientY - pending.event.clientY) <= 10) performPress(pending, 0);
    });
    canvas.addEventListener('pointercancel', cancelPress);
    canvas.addEventListener('lostpointercapture', cancelPress);
    window.addEventListener('blur', cancelPress);
    document.addEventListener('visibilitychange', () => { if (document.hidden) cancelPress(); });
    canvas.addEventListener('contextmenu', event => event.preventDefault());
    document.querySelector('#new-game').addEventListener('click', () => { cancelPress(); this.newGame(this.phase === 'intro'); });
    document.querySelector('#crt-aspect').addEventListener('change', event => {
      fitScreen();
    });
  }

  async fade(from, to, generation) {
    const direction = from <= to ? 1 : -1;
    for (let level = from; level !== to + direction; level += direction) {
      if (generation !== this.generation) return false;
      this.fadeLevel = level;
      this.draw();
      await sleep(1000 / 70);
    }
    return generation === this.generation;
  }

  async intro() {
    const generation = ++this.generation;
    this.phase = 'intro';
    if (!await this.fade(0, 63, generation)) return;
    await sleep(3500);
    if (generation !== this.generation) return;
    if (!await this.fade(63, 0, generation)) return;
    await sleep(500);
    if (generation === this.generation) await this.newGame(true);
  }

  async fadeBoard(generation) {
    if (!await this.fade(0, 63, generation)) return;
    this.phase = 'setup';
    this.updateSetupStatus();
    this.draw();
  }

  newGame(fadeIn = false) {
    this.generation++;
    this.players = [null, emptyHand(), emptyHand(), emptyHand()];
    this.deck = emptyHand();
    this.pile = emptyHand();
    this.selected.clear();
    this.selectedValue = 0;
    this.currentPlayer = 1;
    this.playersLeft = 3;
    this.finishOrder = [];
    this.finished = false;
    this.goFast = false;
    this.leftCard = 7;
    this.modal = null;
    this.phase = fadeIn ? 'dealing' : 'setup';
    this.fadeLevel = fadeIn ? 0 : 63;

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
    if (fadeIn) status.textContent = 'Dealing...';
    else this.updateSetupStatus();
    this.draw();
    if (fadeIn) return this.fadeBoard(this.generation);
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
      this.deck[1] = null;
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
    // Use the full gutters beside the hand so the small arrows are easy to tap.
    if (this.leftCard > 7 && inside(0, 125, 29, 184)) return 101;
    if (hand[this.leftCard + 5] && inside(291, 125, 319, 184)) return 102;
    if (inside(0, 0, 2, 2)) return 103;
    return 0;
  }

  click(button) {
    if (this.phase === 'finished' && this.modal?.kind === 'results') {
      if (button === 0 && this.mouse && !(this.modal.progress < 1)) {
        const { x, width, top, bottom } = this.modalBounds();
        if (this.mouse.x >= x - 21 && this.mouse.x <= x + width + 21 &&
            this.mouse.y >= top - 1 && this.mouse.y <= bottom + 1) this.newGame();
      }
      return;
    }
    if (this.modal?.kind === 'info') { this.modal = null; this.draw(); return; }
    if (this.modal?.kind === 'message') return;
    if (!['setup', 'human'].includes(this.phase) || !this.mouse) return;
    const index = this.cardAt(this.mouse.x, this.mouse.y);
    if (this.phase === 'setup' && index > 0 && index < 100) {
      this.setupClick(index, button); return;
    }
    if (button === 2) {
      if (index >= 4 && index < 100) this.select(index);
      return;
    }
    if (button !== 0) return;
    if (index === 100) { if (this.phase === 'human') this.pickup(1); return; }
    if (index === 101 || index === 102) {
      this.leftCard += index === 101 ? -1 : 1;
      this.draw(); return;
    }
    if (index === 103) { this.openInfo(); return; }
    if (index > 0 && index < 100) this.playHuman(index);
  }
  updateSetupStatus() {
    const count = this.players[1].slice(4, 7).filter(Boolean).length;
    status.textContent = count === 3
      ? 'Arrange your face-up cards, or play from your primary hand to start.'
      : `Choose ${3 - count} more face-up card${count === 2 ? '' : 's'} from your primary hand.`;
  }

  setupClick(index, button) {
    const hand = this.players[1];
    if (index < 4) return; // Keep the face-down cards hidden and in place.
    const emptySlot = [4, 5, 6].find(slot => !hand[slot]);
    if (button === 2) {
      if (index >= 7 && emptySlot === undefined) this.select(index);
      return;
    }
    if (button !== 0) return;
    if (index >= 7 && emptySlot === undefined) {
      this.phase = 'human';
      status.textContent = 'Your turn';
      this.playHuman(index);
      return;
    }
    this.clearSelection();
    if (index < 7) {
      const slot = hand.findIndex((card, i) => i >= 7 && !card);
      hand[slot] = hand[index];
      hand[index] = null;
      this.sortCards(1);
    } else {
      const card = hand[index];
      this.removeCard(hand, index);
      hand[emptySlot] = card;
    }
    const count = hand.slice(7).filter(Boolean).length;
    this.leftCard = Math.max(7, Math.min(this.leftCard, 7 + count - 5));
    this.updateSetupStatus();
    this.draw();
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
  humanPlayText(card, count) {
    const names = { '2': 'two', '3': 'three', '4': 'four', '5': 'five', '6': 'six', '7': 'seven', '8': 'eight', '9': 'nine', '10': 'ten', J: 'jack', Q: 'queen', K: 'king', A: 'ace' };
    if (count > 1) return `You played ${count} ${names[card.number]}s.`;
    const suits = ['spades', 'clubs', 'hearts', 'diamonds'];
    const name = ({ A: 'ace', K: 'king', Q: 'queen', J: 'jack' })[card.number] ?? card.number;
    return `You played ${name} of ${suits[card.suit - 1]}.`;
  }

  async playHuman(index) {
    const generation = this.generation;
    const hand = this.players[1];
    if (index < 7 && hand[7]) return;
    const previous = this.pile[1];
    if (!this.selected.has(index)) { this.clearSelection(); this.selected.add(index); this.selectedValue = hand[index].value; }
    const playedText = this.humanPlayText(hand[index], this.selected.size);
    const playedCount = this.selected.size;
    for (let i = 52; i >= 1; i--) if (this.selected.has(i)) {
      this.makeSpaceOnPile(hand[i]); this.removeCard(hand, i);
    }
    this.clearSelection(); this.phase = 'busy'; this.draw();
    const valid = !previous || this.pile[1].value >= previous.value ||
      this.pile[1].number === '2' || previous.number === '2';
    if (index < 7 && (!valid || !this.playerFinished(1) || this.deck[1])) {
      await this.message(playedText, generation, playedCount > 1 ? 1200 : 800);
      if (generation !== this.generation) return;
    }
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
      const result = this.finishOrder.length === 0 ? 'You win!' : 'You finish 2nd!';
      await this.message(`${playedText}\n${result}`, generation, 3000);
      if (generation !== this.generation) return;
      if (await this.reducePlayers(1, generation)) return;
      this.goFast = true;
      again = false;
    }
    if (generation !== this.generation) return;
    if (again) { this.phase = 'human'; status.textContent = 'Your turn again'; this.draw(); }
    else this.cpuTurns(generation);
  }

  async reducePlayers(player, generation) {
    this.finishOrder.push(player);
    this.playersLeft--;
    if (this.playersLeft !== 1) return false;
    const loser = [1, 2, 3].find(p => !this.playerFinished(p));
    this.finishOrder.push(loser);
    const name = p => p === 1 ? 'You' : `CPU ${p - 1}`;
    this.finished = true; this.phase = 'finished';
    await this.expandModal({
      kind: 'results',
      text: `${loser === 1 ? 'You are' : `${name(loser)} is`} the shithead!\n1st: ${name(this.finishOrder[0])}\n2nd: ${name(this.finishOrder[1])}\n3rd: ${name(loser)}`,
    }, generation);
    if (generation !== this.generation) return true;
    status.textContent = 'Game over - click the results or use New game to play again';
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
      // Compare ranks explicitly: face-up table cards are not sorted.
      // Twos and tens rank above ordinary cards, so save them when possible.
      for (let i = 52; i >= minimum; i--)
        if (hand[i] && this.higher(hand[i]) && (!cardNo || hand[i].value <= hand[cardNo].value)) cardNo = i;
    }
    if (!cardNo) { cardNo = 52; while (!hand[cardNo]) cardNo--; }
    const chosen = hand[cardNo];
    const valid = this.higher(chosen);
    const indices = [cardNo];
    // Only combine known cards from the active hand or face-up row.
    // Face-down cards must still be revealed one at a time.
    if (valid && !firstRow) {
      const minimum = cardNo >= 7 ? 7 : 4;
      const maximum = cardNo >= 7 ? 52 : 6;
      const special = chosen.number === '2' || chosen.number === '10';
      const emptiesHand = hand.slice(minimum, maximum + 1)
        .every(card => !card || card.value === chosen.value);
      // Spend one escape card at a time unless the matching group empties this row.
      if (!special || emptiesHand) {
        for (let i = minimum; i <= maximum; i++)
          if (i !== cardNo && hand[i]?.value === chosen.value) indices.push(i);
      }
    }
    for (const index of indices.sort((a, b) => b - a)) {
      this.makeSpaceOnPile(hand[index]); this.removeCard(hand, index);
    }
    this.draw();
    const top = this.pile[1];
    const names = { '2': 'two', '3': 'three', '4': 'four', '5': 'five', '6': 'six', '7': 'seven', '8': 'eight', '9': 'nine', '10': 'ten', J: 'jack', Q: 'queen', K: 'king', A: 'ace' };
    const cards = indices.length > 1
      ? `${indices.length} ${names[top.number]}s`
      : `a${'8A'.includes(top.number) ? 'n' : ''} ${names[top.number]}`;
    await this.message(valid ? `CPU ${player - 1} lays ${cards}.` : `CPU ${player - 1} cannot go.`, generation,
      indices.length > 1 ? (this.goFast ? 400 : 1200) : undefined);
    if (generation !== this.generation) return false;
    if (!valid) {
      await this.message(`CPU ${player - 1} picks up the pack.`, generation);
      if (generation !== this.generation) return false;
      this.pickup(player); return true;
    }
    this.replenish(player);
    if (top.number === '10' || this.topFourSame()) {
      await this.message(top.number === '10' ? 'pack cleared.' : 'top four cards the same! pack cleared...', generation,
        top.number !== '10' ? (this.goFast ? 400 : 1200) : undefined);
      if (generation !== this.generation) return false;
      this.clearPile();
      if (this.playerFinished(player)) {
        await this.message(`CPU ${player - 1} is out!`, generation);
        if (generation === this.generation) await this.reducePlayers(player, generation);
        return false;
      }
      return true;
    }
    if (this.playerFinished(player)) {
      await this.message(`CPU ${player - 1} is out!`, generation);
      if (generation !== this.generation) return false;
      await this.reducePlayers(player, generation);
    }
    return false;
  }

  async expandModal(modal, generation = this.generation) {
    this.modal = modal;
    // The original advances each box on VGA vertical retrace (about 70 Hz).
    const width = modal.kind === 'info' ? 92 : Math.max(...modal.text.split('\n').map(line => line.length)) * 5 + 40;
    const steps = modal.kind === 'info' ? 30 : Math.ceil(width / 12);
    for (let step = 0; step <= steps; step++) {
      if (generation !== this.generation || this.modal !== modal) return false;
      modal.progress = step / steps;
      this.draw();
      if (step < steps) await sleep(1000 / 70);
    }
    return true;
  }

  async openInfo() {
    await this.expandModal({ kind: 'info' });
  }

  async message(text, generation = this.generation, duration = this.goFast ? 80 : 800) {
    const modal = { kind: 'message', text };
    if (!await this.expandModal(modal, generation)) return;
    // Keep the full reading time after the box has opened and text appears.
    await sleep(duration);
    if (generation === this.generation && this.modal === modal) { this.modal = null; this.draw(); }
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
    vga.sprite(vga.sprites['LOGO.SPR'], 10, 2, true);
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
  modalBounds() {
    const lines = this.modal.text.split('\n');
    const width = Math.max(...lines.map(line => line.length)) * 5;
    const x = Math.floor((320 - width) / 2);
    const top = Math.floor((200 - (lines.length - 1) * 10 - 30) / 2);
    const bottom = top + (lines.length - 1) * 10 + 30;
    return { lines, width, x, top, bottom };
  }

  drawModal() {
    if (!this.modal) return;
    if (this.modal.kind === 'info') {
      const step = Math.round((this.modal.progress ?? 1) * 30);
      const width = Math.min(92, 2 + step * 3);
      const height = Math.min(38, 2 + step * 6);
      vga.fill(0, 0, width, height, 172); vga.rect(1, 1, width - 1, height - 1, 0);
      if (this.modal.progress < 1) return;
      for (const [label, y, count] of [
        ['information', 3, null], ['pile size', 13, this.pile],
        ['cpu 1 cards', 19, this.players[2]], ['cpu 2 cards', 25, this.players[3]],
        ['player cards', 31, this.players[1]],
      ]) { vga.text(label, 5, y, 0); if (count) vga.text(String(count.slice(1).filter(Boolean).length), 73, y, 210); }
      return;
    }
    const { lines, width, x, top, bottom } = this.modalBounds();
    if (this.modal.progress < 1) {
      const halfWidth = Math.max(1, Math.round((width / 2 + 20) * this.modal.progress));
      vga.fill(160 - halfWidth, top, 160 + halfWidth, bottom, 72);
      vga.rect(160 - halfWidth, top, 160 + halfWidth, bottom, 180);
      return;
    }
    vga.fill(x - 20, top, x + width + 20, bottom, 72);
    vga.rect(x - 21, top - 1, x + width + 21, bottom + 1, 72);
    vga.rect(x - 20, top, x + width + 20, bottom, 180);
    lines.forEach((line, i) => vga.text(line, Math.floor((320 - line.length * 5) / 2), top + 12 + i * 10, 180));
  }

  draw() {
    if (this.phase === 'loading') return;
    if (this.phase === 'intro') {
      vga.clear(0);
      for (let y = 0; y < 200; y++) vga.fill(0, y, 319, y, 216 + Math.floor(y / 5));
      const title = vga.sprites['TITLE.SPR'];
      vga.sprite(title, Math.floor((320 - title.width) / 2), Math.floor((200 - title.height) / 2), true);
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
    vga.present(this.fadeLevel);
  }
}

const game = new Game();
game.init().catch(error => {
  console.error(error);
  status.textContent = `Could not start: ${error.message}`;
});
