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
    const from = (tokens[idx++] || '').toUpperCase();
    // To
    const to = (tokens[idx++] || '').toUpperCase();

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

    // Calculate ETA from sector duration, fallback to raw
    const calculatedEta = calculateETA(std, from, to);
    const eta = calculatedEta || rawEta;

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

    rows.push({ sn: sn++, flightNo, from, to, std, eta, aircraft, reg, pax });
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
