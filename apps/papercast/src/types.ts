export type FilterMode = 
  | 'normal' 
  | 'edges' 
  | 'posterize' 
  | 'stencil' 
  | 'grayscale' 
  | 'invert';

export type GridMode = 'none' | '3x3' | '4x4' | '8x8' | 'golden';

export interface ImageTransform {
  x: number;
  y: number;
  scale: number;
  rotation: number;
  flipH: boolean;
  flipV: boolean;
}

export interface CornerPoint {
  x: number;
  y: number;
}

export interface ColorSample {
  hex: string;
  rgb: [number, number, number];
  hsl: [number, number, number];
  luminance: number; // 0 to 100%
  description: string;
}

export interface TracingPreset {
  id: string;
  title: string;
  category: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Master';
  thumbnailUrl: string;
  sourceUrl: string;
  recommendedFilter: FilterMode;
}
