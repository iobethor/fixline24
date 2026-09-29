// Лёгкая цветокоррекция фотографий под фирменную палитру:
// снимок остаётся естественным, слегка приглушается насыщенность и добавляется изумрудный подтон.
const sharp = require('sharp');

async function grade(src, out, { w = 1200, h = 900, tint = '#0C3A24', strength = 0.42, saturation = 0.82, contrast = 1.07, brightness = 1 } = {}) {
  const layer = await sharp({ create: { width: w, height: h, channels: 4, background: { ...hex(tint), alpha: strength } } }).png().toBuffer();
  await sharp(src)
    .resize(w, h, { fit: 'cover' })
    .modulate({ saturation, brightness })
    .linear(contrast, -(128 * (contrast - 1)))
    .composite([{ input: layer, blend: 'soft-light' }])
    .webp({ quality: 82 })
    .toFile(out);
}
function hex(h) { return { r: parseInt(h.slice(1, 3), 16), g: parseInt(h.slice(3, 5), 16), b: parseInt(h.slice(5, 7), 16) }; }

module.exports = { grade };
