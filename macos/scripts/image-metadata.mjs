const SOF_MARKERS = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7,
  0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);
export const MAX_IMAGE_DIMENSION = 16384;
export const MAX_IMAGE_PIXELS = 50_000_000;

function uint16be(bytes, offset) {
  return bytes[offset] * 256 + bytes[offset + 1];
}

function uint16le(bytes, offset) {
  return bytes[offset] + bytes[offset + 1] * 256;
}

function uint24le(bytes, offset) {
  return bytes[offset] + bytes[offset + 1] * 256 + bytes[offset + 2] * 65536;
}

function uint32be(bytes, offset) {
  return bytes[offset] * 0x1000000 + bytes[offset + 1] * 0x10000 +
    bytes[offset + 2] * 0x100 + bytes[offset + 3];
}

function uint32le(bytes, offset) {
  return bytes[offset] + bytes[offset + 1] * 0x100 + bytes[offset + 2] * 0x10000 +
    bytes[offset + 3] * 0x1000000;
}

function ascii(bytes, offset, length) {
  return String.fromCharCode(...bytes.subarray(offset, offset + length));
}

function pngDimensions(bytes) {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length < 24 || signature.some((value, index) => bytes[index] !== value) ||
      uint32be(bytes, 8) !== 13 || ascii(bytes, 12, 4) !== "IHDR") return null;
  const width = uint32be(bytes, 16);
  const height = uint32be(bytes, 20);
  return width > 0 && height > 0 ? { width, height } : null;
}

function paeth(left, up, upperLeft) {
  const estimate = left + up - upperLeft;
  const leftDistance = Math.abs(estimate - left);
  const upDistance = Math.abs(estimate - up);
  const upperLeftDistance = Math.abs(estimate - upperLeft);
  return leftDistance <= upDistance && leftDistance <= upperLeftDistance
    ? left : upDistance <= upperLeftDistance ? up : upperLeft;
}

export function readPngTransparency(value) {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  if (!pngDimensions(bytes) || bytes[24] !== 8 || bytes[28] !== 0) return null;
  const width = uint32be(bytes, 16);
  const height = uint32be(bytes, 20);
  const colorType = bytes[25];
  const channels = colorType === 6 ? 4 : colorType === 4 ? 2 : 0;
  if (!channels) return { hasAlphaChannel: false, hasTransparentPixels: false, hasVisiblePixels: true };
  const chunks = [];
  let offset = 8;
  while (offset + 12 <= bytes.length) {
    const length = uint32be(bytes, offset);
    const type = ascii(bytes, offset + 4, 4);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (dataEnd + 4 > bytes.length) return null;
    if (type === "IDAT") chunks.push(bytes.subarray(dataStart, dataEnd));
    offset = dataEnd + 4;
    if (type === "IEND") break;
  }
  if (!chunks.length) return null;
  let inflated;
  try {
    const compressed = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
    inflated = inflateSync(compressed);
  } catch {
    return null;
  }
  const rowLength = width * channels;
  if (inflated.length !== height * (rowLength + 1)) return null;
  let previous = new Uint8Array(rowLength);
  let cursor = 0;
  let hasTransparentPixels = false;
  let hasVisiblePixels = false;
  for (let y = 0; y < height; y += 1) {
    const filter = inflated[cursor++];
    if (filter > 4) return null;
    const row = new Uint8Array(rowLength);
    for (let x = 0; x < rowLength; x += 1) {
      const encoded = inflated[cursor++];
      const left = x >= channels ? row[x - channels] : 0;
      const up = previous[x] || 0;
      const upperLeft = x >= channels ? previous[x - channels] : 0;
      const predictor = filter === 1 ? left : filter === 2 ? up
        : filter === 3 ? Math.floor((left + up) / 2)
          : filter === 4 ? paeth(left, up, upperLeft) : 0;
      row[x] = (encoded + predictor) & 0xff;
    }
    for (let x = channels - 1; x < rowLength; x += channels) {
      const alpha = row[x];
      if (alpha < 255) hasTransparentPixels = true;
      if (alpha > 0) hasVisiblePixels = true;
    }
    previous = row;
  }
  return { hasAlphaChannel: true, hasTransparentPixels, hasVisiblePixels };
}

function jpegDimensions(bytes) {
  if (bytes.length < 12 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    while (offset < bytes.length && bytes[offset] === 0xff) offset += 1;
    const marker = bytes[offset++];
    if (marker === 0xd9 || marker === 0xda) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) continue;
    if (offset + 2 > bytes.length) break;
    const length = uint16be(bytes, offset);
    if (length < 2 || offset + length > bytes.length) break;
    if (SOF_MARKERS.has(marker) && length >= 7) {
      const height = uint16be(bytes, offset + 3);
      const width = uint16be(bytes, offset + 5);
      return width > 0 && height > 0 ? { width, height } : null;
    }
    offset += length;
  }
  return null;
}

function webpDimensions(bytes) {
  if (bytes.length < 20 || ascii(bytes, 0, 4) !== "RIFF" || ascii(bytes, 8, 4) !== "WEBP") {
    return null;
  }
  const riffEnd = Math.min(bytes.length, uint32le(bytes, 4) + 8);
  let offset = 12;
  while (offset + 8 <= riffEnd) {
    const type = ascii(bytes, offset, 4);
    const size = bytes[offset + 4] + bytes[offset + 5] * 256 +
      bytes[offset + 6] * 65536 + bytes[offset + 7] * 0x1000000;
    const data = offset + 8;
    if (data + size > riffEnd) break;
    if (type === "VP8X" && size >= 10) {
      return { width: uint24le(bytes, data + 4) + 1, height: uint24le(bytes, data + 7) + 1 };
    }
    if (type === "VP8L" && size >= 5 && bytes[data] === 0x2f) {
      const width = 1 + bytes[data + 1] + ((bytes[data + 2] & 0x3f) << 8);
      const height = 1 + (bytes[data + 2] >> 6) + (bytes[data + 3] << 2) +
        ((bytes[data + 4] & 0x0f) << 10);
      return { width, height };
    }
    if (type === "VP8 " && size >= 10 && bytes[data + 3] === 0x9d &&
      bytes[data + 4] === 0x01 && bytes[data + 5] === 0x2a) {
      return {
        width: uint16le(bytes, data + 6) & 0x3fff,
        height: uint16le(bytes, data + 8) & 0x3fff,
      };
    }
    offset = data + size + (size % 2);
  }
  return null;
}

export function classifyImageDimensions({ width, height }) {
  const ratio = width / height;
  if (
    !Number.isSafeInteger(width) || !Number.isSafeInteger(height)
    || width < 1 || height < 1
    || width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION
    || width * height > MAX_IMAGE_PIXELS
    || !Number.isFinite(ratio)
  ) return null;
  const aspect = ratio >= 2.25 ? "ultrawide" : ratio >= 1.45 ? "wide"
    : ratio >= 1.08 ? "landscape" : ratio >= 0.9 ? "square" : "portrait";
  return {
    width,
    height,
    ratio,
    wide: ratio >= 1.75,
    aspect,
    taskMode: ratio >= 2.25 ? "banner" : "ambient",
  };
}

export function readImageMetadata(value, extension = "") {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  const normalized = extension.toLowerCase();
  let dimensions = null;
  if (normalized === ".png" || bytes[0] === 0x89) dimensions = pngDimensions(bytes);
  else if (normalized === ".jpg" || normalized === ".jpeg" ||
    (bytes[0] === 0xff && bytes[1] === 0xd8)) dimensions = jpegDimensions(bytes);
  else if (normalized === ".webp" || ascii(bytes, 8, 4) === "WEBP") dimensions = webpDimensions(bytes);
  return dimensions ? classifyImageDimensions(dimensions) : null;
}
import { inflateSync } from "node:zlib";
