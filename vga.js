// Mode 13h-style, indexed 320x200 framebuffer. Sprites are read directly from
// the original PCX files; their indices and the original 6-bit DAC are retained.
export class VGA {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.ctx.imageSmoothingEnabled = false;
    this.pixels = new Uint8Array(320 * 200);
    this.palette = new Uint8Array(768);
    this.image = this.ctx.createImageData(320, 200);
    this.sprites = {};
  }

  async load(name) {
    const response = await fetch(`assets/${name}`);
    if (!response.ok) throw new Error(`Could not load ${name}`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes[0] !== 10 || bytes[2] !== 1 || bytes[3] !== 8 || bytes[65] !== 1)
      throw new Error(`${name} is not an 8-bit PCX image`);
    const u16 = offset => bytes[offset] | bytes[offset + 1] << 8;
    const width = u16(8) - u16(4) + 1;
    const height = u16(10) - u16(6) + 1;
    const stride = u16(66);
    const pixels = new Uint8Array(width * height);
    let cursor = 128;
    for (let y = 0; y < height; y++) {
      let x = 0;
      while (x < stride) {
        let value = bytes[cursor++], count = 1;
        if ((value & 0xc0) === 0xc0) { count = value & 0x3f; value = bytes[cursor++]; }
        while (count-- > 0) { if (x < width) pixels[y * width + x] = value; x++; }
      }
    }
    if (bytes[bytes.length - 769] !== 12) throw new Error(`${name} has no VGA palette`);
    const palette = bytes.slice(-768).map(c => c >> 2);
    return this.sprites[name] = { width, height, pixels, palette };
  }

  setPalette(palette) { this.palette.set(palette); }
  clear(color = 0) { this.pixels.fill(color); }
  pixel(x, y, color) {
    if (x >= 0 && x < 320 && y >= 0 && y < 200) this.pixels[y * 320 + x] = color;
  }
  fill(x1, y1, x2, y2, color) {
    const left = Math.max(0, Math.min(x1, x2));
    const right = Math.min(319, Math.max(x1, x2));
    for (let y = Math.max(0, Math.min(y1, y2)); y <= Math.min(199, Math.max(y1, y2)); y++)
      this.pixels.fill(color, y * 320 + left, y * 320 + right + 1);
  }
  rect(x1, y1, x2, y2, color) {
    this.fill(x1, y1, x2, y1, color); this.fill(x1, y2, x2, y2, color);
    this.fill(x1, y1, x1, y2, color); this.fill(x2, y1, x2, y2, color);
  }
  line(x1, y1, x2, y2, color) {
    let dx = Math.abs(x2 - x1), dy = -Math.abs(y2 - y1);
    const sx = x1 < x2 ? 1 : -1, sy = y1 < y2 ? 1 : -1;
    let error = dx + dy;
    for (;;) {
      this.pixel(x1, y1, color);
      if (x1 === x2 && y1 === y2) break;
      const twice = 2 * error;
      if (twice >= dy) { error += dy; x1 += sx; }
      if (twice <= dx) { error += dx; y1 += sy; }
    }
  }
  sprite(sprite, x, y, transparent = false) {
    for (let sy = 0; sy < sprite.height; sy++) {
      const dy = y + sy;
      if (dy < 0 || dy >= 200) continue;
      for (let sx = 0; sx < sprite.width; sx++) {
        const dx = x + sx, value = sprite.pixels[sy * sprite.width + sx];
        if (dx >= 0 && dx < 320 && (!transparent || value !== 0)) this.pixels[dy * 320 + dx] = value;
      }
    }
  }
  tile(sprite) {
    for (let y = 0; y < 200; y += sprite.height)
      for (let x = 0; x < 320; x += sprite.width) this.sprite(sprite, x, y);
  }
  text(value, x, y, color) {
    const font = this.sprites['4X5.FNT'];
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ.!?';
    for (const letter of value.toUpperCase()) {
      const index = chars.indexOf(letter);
      if (index >= 0) {
        for (let fy = 0; fy < 5; fy++) for (let fx = 0; fx < 5; fx++)
          if (font.pixels[fy * font.width + index * 5 + fx]) this.pixel(x + fx, y + fy, color);
      }
      x += 5;
    }
  }
  scaledText(value, x, y, scale, color) {
    const font = this.sprites['4X5.FNT'];
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ.!?';
    for (const letter of value.toUpperCase()) {
      const index = chars.indexOf(letter);
      if (index >= 0) {
        for (let fy = 0; fy < 5; fy++) for (let fx = 0; fx < 5; fx++)
          if (font.pixels[fy * font.width + index * 5 + fx])
            this.fill(x + fx * scale, y + fy * scale,
              x + (fx + 1) * scale - 1, y + (fy + 1) * scale - 1, color);
      }
      x += 5 * scale;
    }
  }
  present(brightness = 1) {
    const out = this.image.data;
    for (let i = 0; i < this.pixels.length; i++) {
      const index = this.pixels[i] * 3, p = i * 4;
      out[p] = Math.min(255, Math.round(this.palette[index] * 255 / 63 * brightness));
      out[p + 1] = Math.min(255, Math.round(this.palette[index + 1] * 255 / 63 * brightness));
      out[p + 2] = Math.min(255, Math.round(this.palette[index + 2] * 255 / 63 * brightness));
      out[p + 3] = 255;
    }
    this.ctx.putImageData(this.image, 0, 0);
  }
}
