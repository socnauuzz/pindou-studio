import { Palette } from "@/app/palettes";

type Lab = { l: number; a: number; b: number };
type Rgb = { r: number; g: number; b: number };

const hexToRgb = (hex: string): Rgb => ({
  r: parseInt(hex.slice(1, 3), 16),
  g: parseInt(hex.slice(3, 5), 16),
  b: parseInt(hex.slice(5, 7), 16),
});

function rgbToLab({ r, g, b }: Rgb): Lab {
  let rr = r / 255, gg = g / 255, bb = b / 255;
  rr = rr > 0.04045 ? Math.pow((rr + 0.055) / 1.055, 2.4) : rr / 12.92;
  gg = gg > 0.04045 ? Math.pow((gg + 0.055) / 1.055, 2.4) : gg / 12.92;
  bb = bb > 0.04045 ? Math.pow((bb + 0.055) / 1.055, 2.4) : bb / 12.92;
  const x = (rr * 0.4124 + gg * 0.3576 + bb * 0.1805) / 0.95047;
  const y = rr * 0.2126 + gg * 0.7152 + bb * 0.0722;
  const z = (rr * 0.0193 + gg * 0.1192 + bb * 0.9505) / 1.08883;
  const f = (v: number) => (v > 0.008856 ? Math.cbrt(v) : 7.787 * v + 16 / 116);
  return { l: 116 * f(y) - 16, a: 500 * (f(x) - f(y)), b: 200 * (f(y) - f(z)) };
}

function nearestColor(rgb: Rgb, labs: Lab[]) {
  const target = rgbToLab(rgb);
  let best = 0;
  let distance = Infinity;
  labs.forEach((color, index) => {
    const dl = target.l - color.l;
    const da = target.a - color.a;
    const db = target.b - color.b;
    const current = dl * dl + da * da + db * db;
    if (current < distance) { distance = current; best = index; }
  });
  return best;
}

export function imageToBeads(image: HTMLImageElement, size: number, palette: Palette, options: { dither: boolean }) {
  const sampleScale = 4;
  const side = size * sampleScale;
  const canvas = document.createElement("canvas");
  canvas.width = side;
  canvas.height = side;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return [];
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, side, side);
  const sourceRatio = image.naturalWidth / image.naturalHeight;
  let sw = image.naturalWidth, sh = image.naturalHeight, sx = 0, sy = 0;
  if (sourceRatio > 1) { sw = image.naturalHeight; sx = (image.naturalWidth - sw) / 2; }
  else { sh = image.naturalWidth; sy = (image.naturalHeight - sh) / 2; }
  context.drawImage(image, sx, sy, sw, sh, 0, 0, side, side);
  const data = context.getImageData(0, 0, side, side).data;
  const samples: Rgb[] = [];
  for (let gy = 0; gy < size; gy++) {
    for (let gx = 0; gx < size; gx++) {
      let r = 0, g = 0, b = 0, weight = 0;
      for (let yy = 0; yy < sampleScale; yy++) for (let xx = 0; xx < sampleScale; xx++) {
        const offset = (((gy * sampleScale + yy) * side) + gx * sampleScale + xx) * 4;
        const alpha = data[offset + 3] / 255;
        r += data[offset] * alpha; g += data[offset + 1] * alpha; b += data[offset + 2] * alpha; weight += alpha;
      }
      samples.push({ r: r / Math.max(weight, 1), g: g / Math.max(weight, 1), b: b / Math.max(weight, 1) });
    }
  }
  const labs = palette.colors.map((color) => rgbToLab(hexToRgb(color.hex)));
  const result = new Array(size * size).fill(0);
  const working = samples.map((color) => ({ ...color }));
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const offset = y * size + x;
    const old = working[offset];
    const index = nearestColor(old, labs);
    result[offset] = index;
    if (!options.dither) continue;
    const next = hexToRgb(palette.colors[index].hex);
    const error = { r: old.r - next.r, g: old.g - next.g, b: old.b - next.b };
    const spread = (tx: number, ty: number, factor: number) => {
      if (tx < 0 || ty < 0 || tx >= size || ty >= size) return;
      const target = working[ty * size + tx];
      target.r = Math.max(0, Math.min(255, target.r + error.r * factor));
      target.g = Math.max(0, Math.min(255, target.g + error.g * factor));
      target.b = Math.max(0, Math.min(255, target.b + error.b * factor));
    };
    spread(x + 1, y, 7 / 16); spread(x - 1, y + 1, 3 / 16); spread(x, y + 1, 5 / 16); spread(x + 1, y + 1, 1 / 16);
  }
  return result;
}

export function buildDemoPixels(size: number, palette: Palette) {
  const pixels = new Array(size * size).fill(0);
  const byTone = (tone: string, fallback: number) => {
    const found = palette.colors.findIndex((color) => color.name.toLowerCase().includes(tone));
    return found >= 0 ? found : Math.min(fallback, palette.colors.length - 1);
  };
  const bg = byTone("blue", 15), mint = byTone("green", 21), cream = byTone("cream", 1), brown = byTone("brown", 29), dark = byTone("black", palette.colors.length - 1), pink = byTone("pink", 9), orange = byTone("orange", 5);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const nx = (x + .5) / size, ny = (y + .5) / size;
    let color = bg;
    const head = Math.pow((nx - .5) / .31, 2) + Math.pow((ny - .48) / .29, 2) < 1;
    const body = Math.pow((nx - .5) / .25, 2) + Math.pow((ny - .78) / .27, 2) < 1;
    const earL = Math.pow((nx - .30) / .13, 2) + Math.pow((ny - .25) / .14, 2) < 1;
    const earR = Math.pow((nx - .70) / .13, 2) + Math.pow((ny - .25) / .14, 2) < 1;
    if (earL || earR || head) color = orange;
    if ((earL && Math.pow((nx - .30) / .07, 2) + Math.pow((ny - .25) / .08, 2) < 1) || (earR && Math.pow((nx - .70) / .07, 2) + Math.pow((ny - .25) / .08, 2) < 1)) color = pink;
    if (body) color = mint;
    if (head && Math.pow((nx - .5) / .23, 2) + Math.pow((ny - .54) / .18, 2) < 1) color = cream;
    if ((Math.pow((nx - .41) / .035, 2) + Math.pow((ny - .44) / .045, 2) < 1) || (Math.pow((nx - .59) / .035, 2) + Math.pow((ny - .44) / .045, 2) < 1)) color = dark;
    if (Math.pow((nx - .5) / .05, 2) + Math.pow((ny - .54) / .04, 2) < 1) color = brown;
    if (ny > .61 && ny < .64 && Math.abs(nx - .5) < .07) color = pink;
    if (((x + y * 3) % 29 === 0) && !head && !body && !earL && !earR) color = cream;
    pixels[y * size + x] = color;
  }
  return pixels;
}

export function summarizeColors(pixels: number[], palette: Palette) {
  const counts = new Map<number, number>();
  pixels.forEach((index) => { if (index >= 0) counts.set(index, (counts.get(index) || 0) + 1); });
  return [...counts.entries()].map(([index, count]) => ({ color: palette.colors[index], count })).filter((row) => row.color).sort((a, b) => b.count - a.count);
}

export function renderBeadCanvas(canvas: HTMLCanvasElement, pixels: number[], size: number, palette: Palette, options: { showGrid: boolean; showCodes: boolean; background: string }) {
  const maxSide = Math.min(1200, Math.max(720, size * 18));
  const cell = maxSide / size;
  canvas.width = maxSide;
  canvas.height = maxSide;
  const context = canvas.getContext("2d");
  if (!context) return;
  context.fillStyle = options.background;
  context.fillRect(0, 0, maxSide, maxSide);
  pixels.forEach((index, offset) => {
    if (index < 0 || !palette.colors[index]) return;
    const x = (offset % size) * cell, y = Math.floor(offset / size) * cell;
    const radius = options.showGrid ? cell * .42 : cell * .51;
    const centerX = x + cell / 2, centerY = y + cell / 2;
    context.beginPath(); context.arc(centerX, centerY, radius, 0, Math.PI * 2); context.fillStyle = palette.colors[index].hex; context.fill();
    const rgb = hexToRgb(palette.colors[index].hex);
    context.beginPath(); context.arc(centerX - radius * .2, centerY - radius * .25, radius * .38, 0, Math.PI * 2); context.fillStyle = "rgba(255,255,255,.20)"; context.fill();
    context.beginPath(); context.arc(centerX, centerY, radius * .23, 0, Math.PI * 2); context.fillStyle = `rgba(${Math.max(0, rgb.r - 55)},${Math.max(0, rgb.g - 55)},${Math.max(0, rgb.b - 55)},.30)`; context.fill();
    if (options.showCodes && cell >= 13) {
      context.fillStyle = (rgb.r * .299 + rgb.g * .587 + rgb.b * .114) > 155 ? "#30313a" : "#ffffff";
      context.font = `600 ${Math.max(7, cell * .20)}px ui-sans-serif`;
      context.textAlign = "center"; context.textBaseline = "middle";
      context.fillText(palette.colors[index].code, centerX, centerY + .5, cell * .75);
    }
  });
}

export function exportPatternPng(pixels: number[], size: number, palette: Palette, sourceName: string, options: { showCodes: boolean }) {
  const margin = 180, footer = 260, side = Math.min(5200, Math.max(2400, size * 52));
  const canvas = document.createElement("canvas");
  canvas.width = side + margin * 2; canvas.height = side + margin * 2 + footer;
  const context = canvas.getContext("2d"); if (!context) return;
  context.fillStyle = "#fffdf9"; context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#292934"; context.font = "700 64px sans-serif"; context.fillText("拼豆像素工坊 · 高清图纸", margin, 105);
  context.fillStyle = "#77727a"; context.font = "32px sans-serif"; context.fillText(`${sourceName}  ·  ${size}×${size}  ·  ${palette.name}`, margin, 155);
  const pattern = document.createElement("canvas");
  renderBeadCanvas(pattern, pixels, size, palette, { showGrid: true, showCodes: options.showCodes, background: "#fffdf9" });
  context.drawImage(pattern, margin, margin, side, side);
  const summary = summarizeColors(pixels, palette);
  context.fillStyle = "#292934"; context.font = "700 34px sans-serif"; context.fillText(`材料：${pixels.length.toLocaleString()} 颗 · ${summary.length} 种颜色`, margin, side + margin + 70);
  let x = margin, y = side + margin + 130;
  summary.slice(0, 16).forEach(({ color, count }, index) => {
    const colWidth = (side - 30) / 4;
    x = margin + (index % 4) * colWidth; y = side + margin + 135 + Math.floor(index / 4) * 42;
    context.fillStyle = color.hex; context.beginPath(); context.arc(x + 12, y - 9, 12, 0, Math.PI * 2); context.fill();
    context.fillStyle = "#4c4950"; context.font = "25px sans-serif"; context.fillText(`${color.code} ${color.name} × ${count}`, x + 34, y);
  });
  canvas.toBlob((blob) => {
    if (!blob) return;
    const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `${sourceName}-${palette.name}-${size}x${size}.png`; link.click(); URL.revokeObjectURL(link.href);
  }, "image/png");
}
