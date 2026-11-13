// Fit within 55% of the fixed simulation height, preserving aspect ratio.
export function imagePlacement(width, height, gridWidth, gridHeight) {
  const scale = Math.min(gridWidth * 0.86 / width, gridHeight * 0.55 / height);
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));
  return { width: w, height: h, x: Math.floor((gridWidth - w) / 2), y: Math.floor(gridHeight * 0.08) };
}

export function particlesFromRGBA(data, width, height, offsetX = 0, offsetY = 0) {
  const particles = [];
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = (y * width + x) * 4;
    if (data[i + 3] === 0) continue;
    particles.push({ x: x + offsetX, y: y + offsetY, color: data.slice(i, i + 4) });
  }
  return particles;
}

export function sampleImage() {
  const canvas = document.createElement('canvas');
  canvas.width = 600; canvas.height = 440;
  const c = canvas.getContext('2d');
  const sky = c.createLinearGradient(0, 0, 0, 440);
  sky.addColorStop(0, '#193654'); sky.addColorStop(0.58, '#88b7b7'); sky.addColorStop(1, '#eecda1');
  c.fillStyle = sky; c.fillRect(0, 0, 600, 440);
  c.fillStyle = '#ffe1a0'; c.beginPath(); c.arc(420, 115, 49, 0, Math.PI * 2); c.fill();
  const mountain = (color, points) => {
    c.fillStyle = color; c.beginPath(); c.moveTo(...points[0]);
    points.slice(1).forEach(p => c.lineTo(...p)); c.closePath(); c.fill();
  };
  mountain('#708c91', [[0, 300], [140, 119], [285, 300], [410, 205], [600, 340], [600, 440], [0, 440]]);
  mountain('#d8ded0', [[95, 177], [140, 119], [190, 182], [153, 167], [134, 181], [120, 166]]);
  mountain('#355d68', [[0, 355], [226, 173], [413, 357], [523, 258], [600, 325], [600, 440], [0, 440]]);
  mountain('#afbeb0', [[187, 205], [226, 173], [275, 221], [232, 207], [217, 218]]);
  mountain('#d49a71', [[0, 370], [163, 333], [340, 390], [600, 347], [600, 440], [0, 440]]);
  mountain('#e2b486', [[0, 425], [270, 370], [445, 428], [600, 387], [600, 440], [0, 440]]);
  return canvas;
}

export async function decodeImage(file) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) &&
      !/\.(jpe?g|png|webp)$/i.test(file.name)) throw new Error('JPEG・PNG・WebP形式を選択してください。');
  // Modern Safari/Chrome HTMLImageElement decoders apply EXIF orientation.
  const url = URL.createObjectURL(file);
  try {
    const image = new Image(); image.src = url;
    await image.decode();
    if (!image.naturalWidth || !image.naturalHeight) throw new Error();
    return image;
  } catch { throw new Error('画像を読み込めません。ファイルの破損や未対応形式をご確認ください。'); }
  finally { URL.revokeObjectURL(url); }
}

export function convertImage(source, gridWidth, gridHeight) {
  const layout = imagePlacement(source.naturalWidth || source.width, source.naturalHeight || source.height, gridWidth, gridHeight);
  const canvas = document.createElement('canvas');
  canvas.width = layout.width; canvas.height = layout.height;
  const c = canvas.getContext('2d', { willReadFrequently: true });
  c.drawImage(source, 0, 0, layout.width, layout.height);
  return particlesFromRGBA(c.getImageData(0, 0, layout.width, layout.height).data,
    layout.width, layout.height, layout.x, layout.y);
}
