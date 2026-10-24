# PooHead

**[Play PooHead](https://deanthecoder.github.io/PooHead/)**

This is a preservation of a DOS card game I wrote in **August 1996**, with
revisions visible in the surviving files through **February 1997**. The
original was called *ShitHead*, after the traditional card game also known as
Palace. The playable browser edition is named **PooHead**. The original files
are preserved unchanged in [`original/`](original/), including the 1997 DOS
executable, Pascal source, 8-bit artwork, and font.

The browser edition ports the Pascal gameplay and draws to a 320×200 indexed
framebuffer, much like VGA mode `13h`. It reads copies of the original PCX
sprites and font directly, preserves their palette indices, and scales the
result for modern screens. The new title artwork is drawn by the browser code;
the original title images remain in the archive.

## How to play

PooHead is a three-player shedding game: you play against two computer players.
Each player starts with three cards in hand, three face-up cards on the table,
and three face-down cards beneath them. Play from your hand first, then your
face-up cards, then the face-down cards without seeing them. The last player
still holding cards loses.

- Play a card equal to or higher than the top card of the pile, or pick up the
  pile. You can play several cards of the same rank together.
- A **2** can be played on anything, and anything can follow a 2.
- A **10** clears the pile and gives you another turn. Four of the same rank
  at the top of the pile does the same.
- While the draw deck has cards, your hand refills to three after a valid play.

**Controls:** Left click a card to play it. Right click cards of the same rank
to select several, then left click one of them to play the selection. Left
click the pile to pick it up. The arrows beside your hand scroll it. The tiny
square at the upper-left of the game screen shows card counts. Use **New game**
to redeal. You can switch between CRT and square-pixel aspect ratios below the
screen.

## Run locally

Run `sh run.sh`, then open <http://localhost:8765/>. This needs Python 3 only
for a local static-file server; the game itself has no build step or external
JavaScript dependencies. The same files are published by GitHub Pages.

## Original files

[`original/`](original/) is a direct copy of the surviving `CARDS` folder.
[`original/shared/`](original/shared/) contains the shared Pascal library
source files found beside it (`GLIB`, `FNT`, `MOUSE`, and `CHARMAP`). Some old
library dependencies, including `PCX` and `MEMORY`, were not present in the
archive, so recompiling the DOS edition from source has not been verified. The
original `CARDS.EXE` is retained as a playable and visual reference.

The browser edition is a close recreation, but pixel-for-pixel and complete
gameplay comparison with the DOS executable is still in progress. The browser
version makes a few endgame safeguards so play does not stall on an original
control-flow edge case.

## License

MIT. See [LICENSE](LICENSE).
