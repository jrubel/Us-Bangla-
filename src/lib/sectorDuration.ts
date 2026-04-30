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
  'DAC-BZJ': 40, 'BZJ-DAC': 40, 'DAC-IST': 450, 'IST-DAC': 550,
  'DAC-LHR': 720, 'LHR-DAC': 660, 'DAC-JFK': 1020, 'JFK-DAC': 960,
};

export const AIRPORT_NAMES: Record<string, string> = {
  'DAC': 'Dhaka', 'CGP': 'Chittagong', 'ZYL': 'Sylhet', 'JSR': 'Jessore', 
  'RJH': 'Rajshahi', 'SPD': 'Saidpur', 'CXB': "Cox's Bazar", 'BZJ': 'Barisal',
  'BKK': 'Bangkok', 'CAN': 'Guangzhou', 'CCU': 'Kolkata', 'MCT': 'Muscat', 
  'DOH': 'Doha', 'DXB': 'Dubai', 'JED': 'Jeddah', 'KUL': 'Kuala Lumpur', 
  'MLE': 'Male', 'RUH': 'Riyadh', 'SHJ': 'Sharjah', 'SIN': 'Singapore', 
  'MAA': 'Chennai', 'AUH': 'Abu Dhabi', 'PBH': 'Paro', 'KTM': 'Kathmandu', 
  'CMB': 'Colombo', 'IST': 'Istanbul', 'LHR': 'London', 'JFK': 'New York', 
  'DMM': 'Dammam', 'MED': 'Medina', 'KHI': 'Karachi', 'LHE': 'Lahore', 
  'ISB': 'Islamabad', 'KWI': 'Kuwait', 'BAH': 'Bahrain', 'HKG': 'Hong Kong', 
  'DEL': 'Delhi', 'BOM': 'Mumbai', 'BLR': 'Bangalore', 'HYD': 'Hyderabad', 
  'PNH': 'Phnom Penh', 'HAN': 'Hanoi', 'SGN': 'Ho Chi Minh', 'MNL': 'Manila', 
  'ICN': 'Seoul', 'NRT': 'Tokyo', 'SYD': 'Sydney', 'MEL': 'Melbourne', 
  'PER': 'Perth', 'KKB': 'Kish City', 'THU': 'Thiruvananthapuram', 'COK': 'Kochi',
  'CNN': 'Kannur', 'TRZ': 'Tiruchirappalli', 'CJB': 'Coimbatore',
  'BGM': 'Bagerhat', 'TGL': 'Tangail', 'COM': 'Comilla', 'FEN': 'Feni'
};

export const STORAGE_KEY = 'sectorDurationOverrides';
export const NAME_STORAGE_KEY = 'sectorNameOverrides';

export function getSectorOverrides(): Record<string, number> {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
}

export function getNameOverrides(): Record<string, string> {
  try {
    const saved = localStorage.getItem(NAME_STORAGE_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
}

export interface SectorInfo {
  code: string;
  name: string;
  key: string;
  duration: number;
}

export function getAvailableDestinations(from: string = 'DAC'): SectorInfo[] {
  const sectors = new Set<string>();
  const origin = from.toUpperCase();
  
  try {
    const savedOverrides = localStorage.getItem('sectorDurationOverrides');
    if (savedOverrides) {
      const overrides = JSON.parse(savedOverrides);
      Object.keys(overrides).forEach(key => {
        sectors.add(key.toUpperCase());
      });
    }
  } catch (e) {
    console.error('Error loading custom sectors:', e);
  }

  const nameOverrides = getNameOverrides();
  const durationOverrides = getSectorOverrides();
  
  // Collect unique destinations from sectors that start with the specified origin
  return Array.from(sectors)
    .filter(key => key.startsWith(`${origin}-`))
    .map(key => {
      const to = key.split('-')[1] || '';
      return {
        code: to,
        name: getSectorName(origin, to, nameOverrides),
        key: key,
        duration: durationOverrides[key] || SECTOR_DURATIONS[key] || 0
      };
    })
    .sort((a, b) => a.code.localeCompare(b.code));
}


export function getSectorName(from: string, to: string, providedOverrides?: Record<string, string>): string {
  const key = `${from.toUpperCase()}-${to.toUpperCase()}`;
  const overrides = providedOverrides || getNameOverrides();
  if (key in overrides) return overrides[key];

  const fromCity = AIRPORT_NAMES[from.toUpperCase()] || from.toUpperCase();
  const toCity = AIRPORT_NAMES[to.toUpperCase()] || to.toUpperCase();
  return `${fromCity} - ${toCity}`;
}

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
