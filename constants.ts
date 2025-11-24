import { Adjustments, FilterType, Preset } from './types';

export const DEFAULT_ADJUSTMENTS: Adjustments = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  blur: 0,
  sepia: 0,
  grayscale: 0,
  warmth: 0,
  watermark: '',
  
  // Default Overlay Settings
  overlayImage: null,
  overlayX: 0.5, // Center
  overlayY: 0.5, // Center
  overlayScale: 0.2, // 20% of image size default
  overlayOpacity: 1.0,

  privacyBlur: false,
};

export const FILTERS: Record<FilterType, Partial<Adjustments>> = {
  [FilterType.NONE]: {},
  [FilterType.VIVID]: { brightness: 110, contrast: 120, saturation: 140 },
  [FilterType.BW]: { grayscale: 100, contrast: 120 },
  [FilterType.VINTAGE]: { sepia: 60, contrast: 90, brightness: 90, blur: 0.5 },
  [FilterType.CINEMATIC]: { contrast: 110, saturation: 90, warmth: 20 }, // Warmth sim
  [FilterType.PASTEL]: { brightness: 115, contrast: 90, saturation: 85 },
};

export const MOCK_PRESETS: Preset[] = [
  { id: 'p1', name: 'Brilho Suave', adjustments: { ...DEFAULT_ADJUSTMENTS, brightness: 110, contrast: 90, blur: 0.5 } },
  { id: 'p2', name: 'Escuro Profundo', adjustments: { ...DEFAULT_ADJUSTMENTS, brightness: 80, contrast: 130, saturation: 80 } },
];