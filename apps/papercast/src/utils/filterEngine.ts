import { FilterMode } from '../types';

/**
 * Applies high-performance image processing filters onto an offscreen canvas
 * returning an optimized ImageBitmap or Canvas for instant 60fps rendering.
 */
export function applyArtistFilter(
  sourceImage: HTMLImageElement | HTMLCanvasElement,
  mode: FilterMode,
  posterizeLevels: number = 4
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const width = Math.max(1, sourceImage.width || 600);
  const height = Math.max(1, sourceImage.height || 450);

  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return canvas;

  try {
    // Draw original image first
    ctx.drawImage(sourceImage, 0, 0, width, height);
  } catch (err) {
    console.warn('Draw image failed:', err);
    return canvas;
  }

  if (mode === 'normal') {
    return canvas;
  }

  try {
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;
    const len = data.length;

    if (mode === 'grayscale') {
      for (let i = 0; i < len; i += 4) {
        if (data[i + 3] === 0) continue; // Skip transparent pixels
        const gray = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
        data[i] = gray;
        data[i + 1] = gray;
        data[i + 2] = gray;
      }
      ctx.putImageData(imgData, 0, 0);
      return canvas;
    }

    if (mode === 'invert') {
      for (let i = 0; i < len; i += 4) {
        if (data[i + 3] === 0) continue;
        data[i] = 255 - data[i];
        data[i + 1] = 255 - data[i + 1];
        data[i + 2] = 255 - data[i + 2];
      }
      ctx.putImageData(imgData, 0, 0);
      return canvas;
    }

    if (mode === 'stencil') {
      // High-contrast 1-bit threshold for stencils & cookie decorators
      for (let i = 0; i < len; i += 4) {
        if (data[i + 3] === 0) continue;
        const gray = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
        const val = gray > 135 ? 255 : 0;
        data[i] = val;
        data[i + 1] = val;
        data[i + 2] = val;
      }
      ctx.putImageData(imgData, 0, 0);
      return canvas;
    }

    if (mode === 'posterize') {
      // Quantizes luminance into discrete value steps
      const step = 255 / (posterizeLevels - 1);
      for (let i = 0; i < len; i += 4) {
        if (data[i + 3] === 0) continue;
        data[i] = Math.round(data[i] / step) * step;
        data[i + 1] = Math.round(data[i + 1] / step) * step;
        data[i + 2] = Math.round(data[i + 2] / step) * step;
      }
      ctx.putImageData(imgData, 0, 0);
      return canvas;
    }

    if (mode === 'edges') {
      // Sobel 3x3 Edge Detection convolution
      const outputData = ctx.createImageData(width, height);
      const out = outputData.data;

      // Precalculate luminance buffer for fast lookup
      const grayBuffer = new Float32Array(width * height);
      for (let i = 0, j = 0; i < len; i += 4, j++) {
        grayBuffer[j] = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
      }

      for (let y = 1; y < height - 1; y++) {
        const yOffset = y * width;
        for (let x = 1; x < width - 1; x++) {
          const idx = yOffset + x;

          const p00 = grayBuffer[idx - width - 1];
          const p02 = grayBuffer[idx - width + 1];
          const p10 = grayBuffer[idx - 1];
          const p12 = grayBuffer[idx + 1];
          const p20 = grayBuffer[idx + width - 1];
          const p22 = grayBuffer[idx + width + 1];
          const p01 = grayBuffer[idx - width];
          const p21 = grayBuffer[idx + width];

          const gx = -p00 + p02 - 2 * p10 + 2 * p12 - p20 + p22;
          const gy = -p00 - 2 * p01 - p02 + p20 + 2 * p21 + p22;

          const mag = Math.min(255, Math.hypot(gx, gy) * 1.5);
          const outIdx = (yOffset + x) * 4;

          if (mag > 40) {
            out[outIdx] = 245;     // R
            out[outIdx + 1] = 158; // G
            out[outIdx + 2] = 11;  // B (Amber accent)
            out[outIdx + 3] = 245; // Alpha
          } else {
            out[outIdx] = 0;
            out[outIdx + 1] = 0;
            out[outIdx + 2] = 0;
            out[outIdx + 3] = 0;
          }
        }
      }

      ctx.putImageData(outputData, 0, 0);
      return canvas;
    }
  } catch (err) {
    console.warn('Filter processing error, returning original canvas:', err);
    return canvas;
  }

  return canvas;
}

/**
 * Samples the color and tonal value of an image at a normalized position (0 to 1)
 */
export function samplePixelColor(
  canvas: HTMLCanvasElement,
  normX: number,
  normY: number
): { hex: string; rgb: [number, number, number]; hsl: [number, number, number]; luminance: number } | null {
  try {
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const px = Math.min(canvas.width - 1, Math.max(0, Math.floor(normX * canvas.width)));
    const py = Math.min(canvas.height - 1, Math.max(0, Math.floor(normY * canvas.height)));

    const pixel = ctx.getImageData(px, py, 1, 1).data;
    const r = pixel[0];
    const g = pixel[1];
    const b = pixel[2];

    const hex = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()}`;

    // Calculate HSL
    const rn = r / 255;
    const gn = g / 255;
    const bn = b / 255;
    const max = Math.max(rn, gn, bn);
    const min = Math.min(rn, gn, bn);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case rn: h = (gn - bn) / d + (gn < bn ? 6 : 0); break;
        case gn: h = (bn - rn) / d + 2; break;
        case bn: h = (rn - gn) / d + 4; break;
      }
      h /= 6;
    }

    const luminance = Math.round((0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 * 100);

    return {
      hex,
      rgb: [r, g, b],
      hsl: [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)],
      luminance
    };
  } catch (err) {
    console.warn('Sample color error:', err);
    return null;
  }
}
