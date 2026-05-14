export interface ColorPreset {
  shape: string;
  canvas: string;
  logo: string;
}

export const COLOR_PRESETS: readonly ColorPreset[] = [
  { shape: '#99ECFF', canvas: '#FFFFFF', logo: '/logos/default-blue.svg' },
  { shape: '#FE443B', canvas: '#FFFFFF', logo: '/logos/default-red.svg'  },
  { shape: '#BF00FF', canvas: '#FEFE78', logo: '/logos/1.svg'            },
  { shape: '#00FFAA', canvas: '#004517', logo: '/logos/2.svg'            },
  { shape: '#FF0097', canvas: '#D4FA48', logo: '/logos/3.svg'            },
  { shape: '#0095FF', canvas: '#00FFAA', logo: '/logos/4.svg'            },
  { shape: '#E7002B', canvas: '#FFC7B6', logo: '/logos/5.svg'            },
] as const;

export const DEFAULT_LOGO = '/logos/default-blue.svg';

export function getLogoForColors(shapeColor: string, canvasColor: string): string {
  const preset = COLOR_PRESETS.find(
    (p) => p.shape === shapeColor && p.canvas === canvasColor,
  );
  return preset?.logo ?? DEFAULT_LOGO;
}
