import { FlightRow } from '@/lib/parseFlightData';
import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Copy, Download, Image, FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';
import { toPng } from 'html-to-image';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const INTERNATIONAL_CONNECTING_FLIGHTS = ['BS 341', 'BS 342', 'BS 321', 'BS 322', 'BS 333', 'BS 334', 'BS 343', 'BS 344', 'BS 349', 'BS 350'];

interface Props {
  domestic: FlightRow[];
  international: FlightRow[];
  onUpdateReg: (flightNo: string, sectorIndex: number, newReg: string) => void;
  dateLabel?: string;
}

function getFlightNumParts(flightNo: string): { prefix: string; num: number } | null {
  const match = flightNo.match(/^([A-Za-z]+)\s*(\d+)$/);
  if (!match) return null;
  return { prefix: match[1] + ' ', num: parseInt(match[2], 10) };
}

function parseTime(t: string): number {
  const parts = t.replace(/[^0-9:]/g, '').split(':');
  if (parts.length < 2) return 9999;
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
}

function sortPairsBySTD(pairs: FlightRow[][]): FlightRow[][] {
  return [...pairs].sort((a, b) => {
    const aTime = parseTime(a[0]?.std || '');
    const bTime = parseTime(b[0]?.std || '');
    return aTime - bTime;
  });
}

function pairFlights(flights: FlightRow[], isInternational: boolean): FlightRow[][] {
  if (isInternational) {
    return sortPairsBySTD(pairInternationalFlights(flights));
  }
  const departures = flights.filter(f => f.from === 'DAC');
  const arrivals = flights.filter(f => f.to === 'DAC');
  const paired: FlightRow[][] = [];
  const usedArrivals = new Set<number>();

  for (const dep of departures) {
    const depParts = getFlightNumParts(dep.flightNo);
    const match = depParts
      ? arrivals.find((arr, i) => {
          if (usedArrivals.has(i)) return false;
          const arrParts = getFlightNumParts(arr.flightNo);
          return arrParts && arrParts.prefix === depParts.prefix && arrParts.num === depParts.num + 1;
        })
      : undefined;
    if (match) {
      usedArrivals.add(arrivals.indexOf(match));
      paired.push([dep, match]);
    } else {
      paired.push([dep, null as unknown as FlightRow]);
    }
  }
  arrivals.forEach((arr, i) => {
    if (!usedArrivals.has(i)) paired.push([arr]);
  });

  return sortPairsBySTD(paired);
}

function pairInternationalFlights(flights: FlightRow[]): FlightRow[][] {
  const grouped = new Map<string, FlightRow[]>();
  for (const f of flights) {
    const existing = grouped.get(f.flightNo) || [];
    existing.push(f);
    grouped.set(f.flightNo, existing);
  }

  const paired: FlightRow[][] = [];
  const processedNums = new Set<string>();

  for (const [flightNo, sectors] of grouped) {
    if (processedNums.has(flightNo)) continue;
    const parts = getFlightNumParts(flightNo);

    if (INTERNATIONAL_CONNECTING_FLIGHTS.includes(flightNo)) {
      const isOddFlight = parts && parts.num % 2 === 1;
      if (!isOddFlight) {
        const depNum = parts ? parts.prefix + (parts.num - 1) : null;
        if (!depNum || !grouped.has(depNum)) {
          processedNums.add(flightNo);
          continue;
        }
        continue;
      }

      const returnNum = parts ? parts.prefix + (parts.num + 1) : null;
      const returnSectors = returnNum ? grouped.get(returnNum) || [] : [];
      const group = [...sectors, ...returnSectors];
      paired.push(group);
      if (returnNum) processedNums.add(returnNum);
      processedNums.add(flightNo);
    } else if (!processedNums.has(flightNo)) {
      const hasDacDeparture = sectors.some(s => s.from === 'DAC');
      if (!hasDacDeparture) {
        const depNum = parts ? parts.prefix + (parts.num - 1) : null;
        if (!depNum || !grouped.has(depNum)) {
          processedNums.add(flightNo);
          continue;
        }
        continue;
      }

      const match = parts ? grouped.get(parts.prefix + (parts.num + 1)) : null;
      if (match) {
        paired.push([...sectors, ...match]);
        processedNums.add(parts!.prefix + (parts!.num + 1));
      } else {
        paired.push([...sectors, null as unknown as FlightRow]);
      }
      processedNums.add(flightNo);
    }
  }

  return paired;
}

const PAIR_COLORS = [
  'hsl(220 70% 96%)',
  'hsl(142 50% 95%)',
  'hsl(280 50% 96%)',
  'hsl(30 70% 95%)',
  'hsl(190 60% 95%)',
  'hsl(350 50% 96%)',
  'hsl(60 50% 94%)',
  'hsl(160 50% 95%)',
  'hsl(240 40% 96%)',
  'hsl(100 50% 95%)',
];

const headers = ['No.', 'REG', 'FLT', 'SECTOR', 'STD', 'STA', 'PAX'];

interface PairedRowMetadata {
  row: FlightRow | null;
  isFirstInPair: boolean;
  pairLength: number;
  sn: number | null;
}

const PairedFlightView = ({ domestic, international, onUpdateReg, dateLabel }: Props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const domesticPairs = pairFlights(domestic, false);
  const internationalPairs = pairFlights(international, true);

  // Process pairs into rows with metadata for merging
  const processPairs = (pairs: FlightRow[][]) => {
    const rows: PairedRowMetadata[] = [];
    pairs.forEach((pair, pi) => {
      pair.forEach((row, ri) => {
        rows.push({
          row,
          isFirstInPair: ri === 0,
          pairLength: pair.length,
          sn: ri === 0 ? pi + 1 : null,
        });
      });
    });
    return rows;
  };

  const domesticRows = processPairs(domesticPairs);
  const intlRows = processPairs(internationalPairs);

  const maxRows = Math.max(domesticRows.length, intlRows.length);

  if (domestic.length === 0 && international.length === 0) {
    return <p className="text-sm text-muted-foreground">No flight data. Generate a table first.</p>;
  }

  const handleCopyTable = () => {
    const lines: string[] = [];
    if (dateLabel) lines.push(dateLabel);
    lines.push([...headers, '', ...headers].join('\t'));
    for (let i = 0; i < maxRows; i++) {
      const d = domesticRows[i];
      const intl = intlRows[i];

      const dCols = d?.row ? [d.sn || '', d.row.reg, d.row.flightNo, `${d.row.from}-${d.row.to}`, d.row.std, d.row.eta, d.row.pax] : ['', '', '', '', '', '', ''];
      const iCols = intl?.row ? [intl.sn || '', intl.row.reg, intl.row.flightNo, `${intl.row.from}-${intl.row.to}`, intl.row.std, intl.row.eta, intl.row.pax] : ['', '', '', '', '', '', ''];
      lines.push([...dCols, '', ...iCols].join('\t'));
    }
    navigator.clipboard.writeText(lines.join('\n'));
    toast.success('Table copied to clipboard');
  };

  const handleDownloadExcel = () => {
    const data = [];
    if (dateLabel) data.push([dateLabel]);
    data.push([]);
    data.push(['DOMESTIC', '', '', '', '', '', '', '', 'INTERNATIONAL']);
    data.push([...headers, '', ...headers]);

    for (let i = 0; i < maxRows; i++) {
      const d = domesticRows[i];
      const intl = intlRows[i];

      const dCols = d?.row ? [d.sn || '', d.row.reg, d.row.flightNo, `${d.row.from}-${d.row.to}`, d.row.std, d.row.eta, d.row.pax] : ['', '', '', '', '', '', ''];
      const iCols = intl?.row ? [intl.sn || '', intl.row.reg, intl.row.flightNo, `${intl.row.from}-${intl.row.to}`, intl.row.std, intl.row.eta, intl.row.pax] : ['', '', '', '', '', '', ''];
      data.push([...dCols, '', ...iCols]);
    }

    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Flight Split');
    XLSX.writeFile(wb, `flight_split_${format(new Date(), 'yyyyMMdd')}.xlsx`);
    toast.success('Excel downloaded');
  };

  const handleSaveImage = async () => {
    if (!containerRef.current) return;
    try {
      const dataUrl = await toPng(containerRef.current, { backgroundColor: '#ffffff', pixelRatio: 2 });
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = 'flight_split.png';
      a.click();
      toast.success('Image downloaded');
    } catch {
      toast.error('Failed to generate image');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3">
        <Button onClick={handleCopyTable} variant="outline" size="sm" className="gap-2 h-9 text-[10px] font-black uppercase tracking-widest border-white/10 hover:bg-white/5 transition-all">
          <Copy className="w-3.5 h-3.5 text-primary" /> <span className="hidden sm:inline">Copy Telemetry</span><span className="sm:hidden">Copy</span>
        </Button>
        <Button onClick={handleDownloadExcel} variant="outline" size="sm" className="gap-2 h-9 text-[10px] font-black uppercase tracking-widest border-white/10 hover:bg-white/5 transition-all">
          <FileSpreadsheet className="w-3.5 h-3.5 text-secondary" /> <span className="hidden sm:inline">Export XLSX</span><span className="sm:hidden">Excel</span>
        </Button>
        <Button onClick={handleSaveImage} variant="outline" size="sm" className="gap-2 h-9 text-[10px] font-black uppercase tracking-widest border-white/10 hover:bg-white/5 transition-all">
          <Image className="w-3.5 h-3.5 text-primary" /> <span className="hidden sm:inline">Snapshot PNG</span><span className="sm:hidden">Image</span>
        </Button>
      </div>

      <div ref={containerRef} className="space-y-6 p-1">
        {dateLabel && (
          <div className="text-center py-3 bg-white/5 border border-white/5 rounded-2xl glass-card relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-secondary/5 opacity-50"></div>
            <div className="relative text-[10px] font-black uppercase tracking-[0.4em] text-primary/80">
              {dateLabel}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-[1fr,12px,1fr] gap-6 xl:gap-0">
          {/* Domestic Table */}
          <div className="glass-card rounded-2xl border border-white/5 overflow-hidden flex flex-col group">
            <div className="bg-primary/10 border-b border-primary/20 text-primary text-center py-2 text-[9px] font-black uppercase tracking-[0.3em] glow-cyan">
              Domestic Operational Matrix
            </div>
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-[10px] border-collapse min-w-[500px]">
                <thead>
                  <tr className="bg-white/5 text-slate-500 border-b border-white/5">
                    {headers.map(h => <th key={`d-h-${h}`} className="px-2 py-3 border-r border-white/5 text-center text-[9px] font-black uppercase tracking-wider">{h}</th>)}
                  </tr>
                </thead>
                <tbody className="font-mono text-slate-300">
                  {domesticRows.map((d, i) => (
                    <tr key={`d-row-${i}`} className="border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors group/row">
                      {d.isFirstInPair && (
                        <td rowSpan={d.pairLength} className="px-2 py-3 font-black text-center w-8 border-r border-white/5 bg-white/5 text-[10px] text-primary transition-colors group-hover/row:text-white">
                          {d.sn}
                        </td>
                      )}
                      {d.isFirstInPair && (
                        <td rowSpan={d.pairLength} className="px-2 py-3 border-r border-white/5 text-center bg-white/2">
                          {d.row && d.sn ? (
                             <input
                              type="text"
                              value={d.row.reg}
                              onChange={(e) => onUpdateReg(d.row!.flightNo, 0, e.target.value.toUpperCase())}
                              className="w-12 bg-black/40 border border-white/10 focus:outline-none focus:border-primary rounded-lg text-center text-[10px] py-1 text-white font-black glow-cyan/20"
                            />
                          ) : (
                            <div className="text-center text-[10px] font-black text-slate-400">{d.row?.reg || ''}</div>
                          )}
                        </td>
                      )}
                      <td className="px-2 py-3 font-black text-center text-[10px] border-r border-white/5 text-white/90">{d.row?.flightNo || ''}</td>
                      <td className="px-2 py-3 whitespace-nowrap text-center text-[10px] text-slate-400 border-r border-white/5">{d.row ? `${d.row.from}-${d.row.to}` : ''}</td>
                      <td className="px-2 py-3 text-center text-[10px] text-slate-500 border-r border-white/5">{d.row?.std || ''}</td>
                      <td className="px-2 py-3 text-center text-[10px] text-primary font-black border-r border-white/5 text-shadow-neon">{d.row?.eta || ''}</td>
                      <td className={cn(
                        "px-2 py-3 font-black text-center text-sm",
                        d.row && d.row.pax < 60 ? 'text-rose-500 text-shadow-neon' : 'text-slate-200'
                      )}>
                        {d.row?.pax || ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Spacer */}
          <div className="hidden xl:block w-3 bg-transparent" />

          {/* International Table */}
          <div className="glass-card rounded-2xl border border-white/5 overflow-hidden flex flex-col group">
            <div className="bg-secondary/10 border-b border-secondary/20 text-secondary text-center py-2 text-[9px] font-black uppercase tracking-[0.3em] glow-magenta">
              International Operational Matrix
            </div>
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-[10px] border-collapse min-w-[500px]">
                <thead>
                  <tr className="bg-white/5 text-slate-500 border-b border-white/5">
                    {headers.map(h => <th key={`i-h-${h}`} className="px-2 py-3 border-r border-white/5 text-center text-[9px] font-black uppercase tracking-wider">{h}</th>)}
                  </tr>
                </thead>
                <tbody className="font-mono text-slate-300">
                  {intlRows.map((intl, i) => (
                    <tr key={`i-row-${i}`} className="border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors group/row">
                      {intl.isFirstInPair && (
                        <td rowSpan={intl.pairLength} className="px-2 py-3 font-black text-center w-8 border-r border-white/5 bg-white/5 text-[10px] text-secondary transition-colors group-hover/row:text-white">
                          {intl.sn}
                        </td>
                      )}
                      {intl.isFirstInPair && (
                        <td rowSpan={intl.pairLength} className="px-2 py-3 border-r border-white/5 text-center bg-white/2">
                          {intl.row && intl.sn ? (
                            <input
                              type="text"
                              value={intl.row.reg}
                              onChange={(e) => onUpdateReg(intl.row!.flightNo, 0, e.target.value.toUpperCase())}
                              className="w-12 bg-black/40 border border-white/10 focus:outline-none focus:border-secondary rounded-lg text-center text-[10px] py-1 text-white font-black glow-magenta/20"
                            />
                          ) : (
                            <div className="text-center text-[10px] font-black text-slate-400">{intl.row?.reg || ''}</div>
                          )}
                        </td>
                      )}
                      <td className="px-2 py-3 font-black text-center text-[10px] border-r border-white/5 text-white/90">{intl.row?.flightNo || ''}</td>
                      <td className="px-2 py-3 whitespace-nowrap text-center text-[10px] text-slate-400 border-r border-white/5">{intl.row ? `${intl.row.from}-${intl.row.to}` : ''}</td>
                      <td className="px-2 py-3 text-center text-[10px] text-slate-500 border-r border-white/5">{intl.row?.std || ''}</td>
                      <td className="px-2 py-3 text-center text-[10px] text-secondary font-black border-r border-white/5 text-shadow-neon">{intl.row?.eta || ''}</td>
                      <td className={cn(
                        "px-2 py-3 font-black text-center text-sm",
                        intl.row && intl.row.pax < 60 ? 'text-rose-500 text-shadow-neon' : 'text-slate-200'
                      )}>
                        {intl.row?.pax || ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PairedFlightView;

