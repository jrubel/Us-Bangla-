import { calculateETA } from './sectorDuration';

export interface FlightRow {
  sn: number;
  flightNo: string;
  from: string;
  to: string;
  std: string;
  eta: string;
  aircraft: string;
  reg: string;
  pax: number;
}

function cleanTime(raw: string): string {
  return raw.replace(/\s*(AM|PM|am|pm)\s*/g, '').trim();
}

function formatFlightNo(airline: string, num: string): string {
  return `${airline.toUpperCase()} ${num}`;
}

export function parseFlightData(text: string): FlightRow[] {
  const lines = text.trim().split('\n').filter(l => l.trim());
  const rows: FlightRow[] = [];
  let sn = 1;

  for (const line of lines) {
    const cleaned = line.replace(/\b(OK\s+SO|OK|SO)\b/gi, '').trim();
    const tokens = cleaned.split(/\s+/).filter(Boolean);
    if (tokens.length < 6) continue;

    let idx = 0;

    // Skip leading serial number
    if (/^\d+$/.test(tokens[idx]) && !/^[A-Za-z]/.test(tokens[idx])) {
      idx++;
    }

    // Airline code (1-3 letters)
    if (idx >= tokens.length || !/^[A-Za-z]{1,3}$/.test(tokens[idx])) continue;
    const airlineCode = tokens[idx++];

    // Flight number
    if (idx >= tokens.length || !/^\d{1,5}$/.test(tokens[idx])) continue;
    const flightNum = tokens[idx++];
    const flightNo = formatFlightNo(airlineCode, flightNum);

    // From
    const airport1 = (tokens[idx++] || '').toUpperCase();
    // To (could be middle or final)
    const airport2 = (tokens[idx++] || '').toUpperCase();
    
    // Check if there is a third airport token before the time/date
    let airport3 = '';
    // Airport codes are usually 3 letters. Times are usually 4 or 5 (HH:MM or HHMM)
    if (idx < tokens.length && tokens[idx].length === 3 && /^[A-Z]{3}$/.test(tokens[idx].toUpperCase()) &&
        !/^\d{1,2}[A-Z]{3}$/i.test(tokens[idx])) { // Not a date like 11APR
      airport3 = tokens[idx++].toUpperCase();
    }

    // Skip date field like 11APR, 12MAY etc.
    if (idx < tokens.length && /^\d{1,2}[A-Za-z]{3}$/i.test(tokens[idx])) {
      idx++;
    }

    // STD
    const stdRaw = tokens[idx++] || '';
    if (idx < tokens.length && /^(AM|PM)$/i.test(tokens[idx])) {
      idx++; // skip AM/PM
    }
    const std = cleanTime(stdRaw);

    // ETA from raw data
    const etaRaw = tokens[idx++] || '';
    if (idx < tokens.length && /^(AM|PM)$/i.test(tokens[idx])) {
      idx++; // skip AM/PM
    }
    const rawEta = cleanTime(etaRaw);

    // Aircraft type
    const aircraft = tokens[idx++] || '';

    // Registration - keep last 3 characters
    const regFull = (tokens[idx++] || '').toUpperCase();
    const reg = regFull.length > 3 ? regFull.slice(-3) : regFull;

    // Pax
    let pax = 0;
    const remaining = tokens.slice(idx);
    for (let i = remaining.length - 1; i >= 0; i--) {
      const n = parseInt(remaining[i], 10);
      if (!isNaN(n)) { pax = n; break; }
    }

    if (airport3) {
      // Split into two rows: airport1 -> airport2 and airport2 -> airport3
      // First sector: airport1 -> airport2
      const sector1Eta = calculateETA(std, airport1, airport2) || rawEta;
      rows.push({ sn: sn++, flightNo, from: airport1, to: airport2, std, eta: sector1Eta, aircraft, reg, pax: Math.floor(pax * 0.4) || 0 });
      
      // Second sector: airport2 -> airport3
      // Assume 60 min ground time if it's a via flight
      const sector2Std = calculateETA(sector1Eta, '00:00', '00:60') || sector1Eta; // Hacky way to add 60 mins if I don't have a better util here, but wait
      // Actually let's just use rawEta for the final destination if available
      const sector2Eta = calculateETA(sector1Eta, airport2, airport3) || rawEta;
      
      // For second sector STD, let's try to add 60 mins to sector1's ETA
      const [h, m] = sector1Eta.split(':').map(Number);
      const totalMins = (h * 60 + (m || 0) + 60) % 1440;
      const s2h = Math.floor(totalMins / 60);
      const s2m = totalMins % 60;
      const s2std = `${String(s2h).padStart(2, '0')}:${String(s2m).padStart(2, '0')}`;
      
      rows.push({ sn: sn++, flightNo, from: airport2, to: airport3, std: s2std, eta: sector2Eta, aircraft, reg, pax });
    } else {
      // Standard sector
      const calculatedEta = calculateETA(std, airport1, airport2);
      const eta = calculatedEta || rawEta;
      rows.push({ sn: sn++, flightNo, from: airport1, to: airport2, std, eta, aircraft, reg, pax });
    }
  }

  return rows;
}

export function refreshFlightETAs(data: FlightRow[]): FlightRow[] {
  return data.map(row => {
    const calculatedEta = calculateETA(row.std, row.from, row.to);
    return calculatedEta ? { ...row, eta: calculatedEta } : row;
  });
}

export function isInternationalFlight(r: FlightRow): boolean {
  const DOMESTIC_AIRPORTS = ['DAC', 'CGP', 'ZYL', 'CXB', 'SPD', 'BZL', 'JSR', 'RJH'];
  const INTERNATIONAL_CONNECTING_FLIGHTS = ['BS 341', 'BS 342', 'BS 321', 'BS 322', 'BS 333', 'BS 334', 'BS 343', 'BS 344', 'BS 349', 'BS 350'];

  if (INTERNATIONAL_CONNECTING_FLIGHTS.includes(r.flightNo)) return true;
  return !DOMESTIC_AIRPORTS.includes(r.from) || !DOMESTIC_AIRPORTS.includes(r.to);
}
