import blueLily from '../assets/blue-spider-lily.png';
import emeraldLily from '../assets/emerald-spider-lily.png';
import goldLily from '../assets/gold-spider-lily.png';
import indigoLily from '../assets/indigo-spider-lily.png';
import redLily from '../assets/red-spider-lily.png';

export const THEMES = [
  {
    id: 'blue', key: '1', name: 'Cobalt', colorName: 'blue', image: blueLily,
    accent: '#1646cb', deep: [0.035, 0.12, 0.56], light: [0.16, 0.42, 0.96],
  },
  {
    id: 'red', key: '2', name: 'Vermilion', colorName: 'red', image: redLily,
    accent: '#b9232d', deep: [0.45, 0.03, 0.06], light: [0.96, 0.24, 0.22],
  },
  {
    id: 'gold', key: '3', name: 'Gold', colorName: 'gold', image: goldLily,
    accent: '#946200', deep: [0.42, 0.2, 0.015], light: [1.0, 0.67, 0.12],
  },
  {
    id: 'indigo', key: '4', name: 'Indigo', colorName: 'indigo', image: indigoLily,
    accent: '#5735a5', deep: [0.16, 0.06, 0.37], light: [0.54, 0.4, 0.93],
  },
  {
    id: 'emerald', key: '5', name: 'Emerald', colorName: 'emerald', image: emeraldLily,
    accent: '#087257', deep: [0.02, 0.26, 0.18], light: [0.1, 0.72, 0.48],
  },
];

export const THEME_PRESETS = [
  { id: 'auto', key: '0', name: 'Daily rotation', theme: null },
  ...THEMES.map((theme) => ({
    id: theme.id,
    key: theme.key,
    name: theme.name,
    theme,
  })),
];

export function findTheme(themeId) {
  return THEMES.find((theme) => theme.id === themeId) || null;
}
