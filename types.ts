export interface Adjustments {
  brightness: number; // 0-200, default 100
  contrast: number;   // 0-200, default 100
  saturation: number; // 0-200, default 100
  blur: number;       // 0-10, default 0
  sepia: number;      // 0-100, default 0
  grayscale: number;  // 0-100, default 0
  warmth: number;     // 0-100 (simulated via sepia/hue), default 0
  
  // Legacy text watermark (can be kept or deprecated)
  watermark: string;

  // Image Element / Watermark
  overlayImage: string | null; // Base64 string of the uploaded logo/element
  overlayX: number; // 0-1 (Percentage of width)
  overlayY: number; // 0-1 (Percentage of height)
  overlayScale: number; // 0.1 - 2.0 (Scale factor relative to image size)
  overlayOpacity: number; // 0-1

  privacyBlur: boolean; // Blur faces/plates
}

export interface BoundingBox {
  ymin: number;
  xmin: number;
  ymax: number;
  xmax: number;
}

export interface ImageFile {
  id: string;
  originalUrl: string; // The original blob URL
  previewUrl: string;  // The potentially edited preview (or original if no edits)
  name: string;
  type: string;
  adjustments: Adjustments; // Per-image adjustments
  privacyRegions?: BoundingBox[]; // Cached detection data
}

export interface Preset {
  id: string;
  name: string;
  adjustments: Adjustments;
}

export interface UserConfig {
  id: string;
  name: string;
  createdAt: number;
  adjustments: Adjustments;
}

export enum FilterType {
  NONE = 'Normal',
  VIVID = 'Vívido',
  BW = 'P&B',
  VINTAGE = 'Retrô',
  CINEMATIC = 'Cinemático',
  PASTEL = 'Pastel'
}

export interface AppState {
  images: ImageFile[];
  selectedImageId: string | null;
  adjustments: Adjustments;
  presets: Preset[];
  history: Adjustments[];
  historyIndex: number;
}