const SECTOR_DURATIONS: Record<string, number> = {
  'BKK-DAC': 160, 'CAN-DAC': 130, 'CCU-DAC': 60, 'CGP-DAC': 55,
  'CGP-MCT': 275, 'CXB-DAC': 65, 'DAC-BKK': 160, 'DAC-CAN': 330,
  'DAC-CCU': 60, 'DAC-CGP': 55, 'DAC-CXB': 65, 'DAC-DOH': 205,
  'DAC-DXB': 235, 'DAC-JED': 410, 'DAC-JSR': 45, 'DAC-KUL': 240,
  'DAC-MLE': 240, 'DAC-RJH': 50, 'DAC-RUH': 260, 'DAC-SHJ': 285,
  'DAC-SIN': 250, 'DAC-SPD': 60, 'DAC-ZYL': 50, 'DOH-DAC': 460,
  'DXB-CGP': 400, 'DXB-DAC': 380, 'JED-DAC': 440, 'JSR-DAC': 45,
  'KUL-DAC': 115, 'MCT-CGP': 400, 'MCT-DAC': 400, 'MLE-DAC': 240,
  'RJH-DAC': 50, 'RUH-DAC': 500, 'SHJ-DAC': 300, 'SIN-DAC': 250,
  'SPD-DAC': 60, 'ZYL-DAC': 50, 'DAC-MAA': 180, 'MAA-DAC': 180,
  'DOH-CGP': 340, 'AUH-CGP': 290, 'CGP-DOH': 160, 'CGP-DXB': 365,
  'CGP-AUH': 200, 'AUH-DAC': 410, 'DAC-MCT': 300, 'DAC-AUH': 285,
};

const STORAGE_KEY = 'sectorDurationOverrides';

function getEffectiveDuration(from: string, to: string): number | null {
  const key = `${from.toUpperCase()}-${to.toUpperCase()}`;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const overrides = saved ? JSON.parse(saved) : {};
    if (key in overrides) return overrides[key];
  } catch { /* ignore */ }
  return SECTOR_DURATIONS[key] ?? null;
}

export function getSectorDuration(from: string, to: string): number | null {
  return getEffectiveDuration(from, to);
}

export function calculateETA(std: string, from: string, to: string): string {
  const duration = getSectorDuration(from, to);
  if (!duration) return '';

  const parts = std.replace(/[^0-9:]/g, '').split(':');
  if (parts.length < 2) return '';

  const hours = parseInt(parts[0], 10);
  const mins = parseInt(parts[1], 10);
  const totalMins = hours * 60 + mins + duration;

  const etaH = Math.floor(totalMins / 60) % 24;
  const etaM = totalMins % 60;
  return `${String(etaH).padStart(2, '0')}:${String(etaM).padStart(2, '0')}`;
}

export function getAllSectors(): Record<string, number> {
  return { ...SECTOR_DURATIONS };
}
