import { FlightRow } from '@/lib/parseFlightData';
import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Copy, Download, Image, FileSpreadsheet, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { toPng } from 'html-to-image';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { getSectorName } from '@/lib/sectorDuration';

const INTERNATIONAL_CONNECTING_FLIGHTS = ['BS 341', 'BS 342', 'BS 321', 'BS 322', 'BS 333', 'BS 334', 'BS 343', 'BS 344', 'BS 349', 'BS 350'];

interface Props {
  domestic: FlightRow[];
  international: FlightRow[];
  onUpdateReg: (flightNo: string, sectorIndex: number, newReg: string) => void;
  dateLabel?: string;
  onAddFlight?: () => void;
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

const PairedFlightView = ({ domestic, international, onUpdateReg, dateLabel, onAddFlight }: Props) => {
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
    
    const toastId = toast.loading('Generating snapshot...');
    
    try {
      const element = containerRef.current;
      
      // Calculate content dimensions
      const innerGrid = element.querySelector('.min-w-\\[1100px\\]') as HTMLElement;
      const scrollableDiv = element.querySelector('.overflow-x-auto') as HTMLElement;
      
      const contentWidth = innerGrid ? Math.max(innerGrid.scrollWidth, 1150) : element.scrollWidth;
      const contentHeight = element.scrollHeight;

      // Temporarily expand the element to its full size to ensure everything is rendered
      const originalScrollStyle = scrollableDiv?.style.overflowX || '';
      const originalWidth = element.style.width;
      
      if (scrollableDiv) scrollableDiv.style.overflowX = 'visible';
      element.style.width = `${contentWidth + 100}px`;

      const dataUrl = await toPng(element, { 
        backgroundColor: 'hsl(var(--background))',
        pixelRatio: 2,
        width: contentWidth + 100,
        height: contentHeight + 50,
        style: {
          padding: '25px 60px 25px 25px',
          margin: '0',
          width: `${contentWidth + 100}px`,
          height: `${contentHeight + 50}px`,
          maxWidth: 'none',
          maxHeight: 'none',
          overflow: 'visible'
        }
      });

      // Restore original styles
      if (scrollableDiv) scrollableDiv.style.overflowX = originalScrollStyle;
      element.style.width = originalWidth;

      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `Morning Book load_${format(new Date(), 'yyyyMMdd_HHmm')}.png`;
      a.click();
      
      toast.dismiss(toastId);
      toast.success('Table snapshot downloaded');
    } catch (error) {
      console.error('Snapshot error:', error);
      toast.dismiss(toastId);
      toast.error('Failed to generate image');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3">
        {onAddFlight && (
          <Button onClick={onAddFlight} variant="outline" size="sm" className="gap-2 h-10 text-xs font-black uppercase tracking-widest border-primary/30 text-primary hover:bg-primary/5 transition-all px-5">
            <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Add Manual Leg</span><span className="sm:hidden">Add</span>
          </Button>
        )}
        <Button onClick={handleCopyTable} variant="outline" size="sm" className="gap-2 h-10 text-xs font-black uppercase tracking-widest border-border hover:bg-foreground/5 transition-all px-5 text-muted-foreground hover:text-foreground">
          <Copy className="w-4 h-4 text-primary" /> <span className="hidden sm:inline">Copy Telemetry</span><span className="sm:hidden">Copy</span>
        </Button>
        <Button onClick={handleDownloadExcel} variant="outline" size="sm" className="gap-2 h-10 text-xs font-black uppercase tracking-widest border-border hover:bg-foreground/5 transition-all px-5 text-muted-foreground hover:text-foreground">
          <FileSpreadsheet className="w-4 h-4 text-secondary" /> <span className="hidden sm:inline">Export XLSX</span><span className="sm:hidden">Excel</span>
        </Button>
        <Button onClick={handleSaveImage} variant="outline" size="sm" className="gap-2 h-10 text-xs font-black uppercase tracking-widest border-border hover:bg-foreground/5 transition-all px-5 text-muted-foreground hover:text-foreground">
          <Image className="w-4 h-4 text-primary" /> <span className="hidden sm:inline">Snapshot PNG</span><span className="sm:hidden">Image</span>
        </Button>
      </div>

      <div ref={containerRef} className="space-y-6 p-1">
        {dateLabel && (
          <div className="text-center py-4 bg-foreground/5 border border-border rounded-2xl glass-card relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-secondary/5 opacity-50"></div>
            <div className="relative text-xs font-black uppercase tracking-[0.4em] text-foreground/80">
              {dateLabel}
            </div>
          </div>
        )}

        <div className="overflow-x-auto pb-2 custom-scrollbar">
          <div className="min-w-[1100px] grid grid-cols-2 gap-8 relative">
            <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-border block" />
            
            {/* Domestic Table - Left Side */}
            <div className="flex flex-col gap-4">
            <div className="glass-card rounded-2xl border-2 border-border overflow-hidden flex flex-col group h-full">
              <div className="bg-primary/10 border-b-2 border-border text-foreground text-center py-4 text-xs font-black uppercase tracking-[0.3em]">
                Domestic
              </div>
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-sm border-collapse min-w-[500px]">
                  <thead>
                    <tr className="bg-foreground/5 text-foreground/60 border-b-2 border-border">
                      {headers.map(h => <th key={`d-h-${h}`} className="px-3 py-4 border-r-2 border-border text-center text-xs font-black uppercase tracking-wider">{h}</th>)}
                    </tr>
                  </thead>
                  <tbody className="font-mono text-foreground/80">
                    {domesticRows.map((d, i) => (
                      <tr key={`d-row-${i}`} className="border-b-2 border-border last:border-0 hover:bg-foreground/5 transition-colors group/row">
                        {d.isFirstInPair && (
                          <td rowSpan={d.pairLength} className="px-3 py-4 font-black text-center w-10 border-r-2 border-border bg-foreground/5 text-xs text-primary transition-colors group-hover/row:text-foreground">
                            {d.sn}
                          </td>
                        )}
                        {d.isFirstInPair && (
                          <td rowSpan={d.pairLength} className="px-3 py-4 border-r-2 border-border text-center bg-foreground/2">
                            {d.row && d.sn ? (
                               <input
                                type="text"
                                value={d.row.reg}
                                onChange={(e) => onUpdateReg(d.row!.flightNo, 0, e.target.value.toUpperCase())}
                                className="w-16 bg-background/60 border-2 border-border focus:outline-none focus:border-primary rounded-md text-center text-sm py-1.5 text-foreground font-black"
                              />
                            ) : (
                              <div className="text-center text-sm font-black text-foreground">{d.row?.reg || ''}</div>
                            )}
                          </td>
                        )}
                        <td className="px-3 py-4 font-black text-center text-sm border-r-2 border-border text-foreground">{d.row?.flightNo || ''}</td>
                        <td className="px-3 py-4 whitespace-nowrap text-center border-r-2 border-border uppercase">
                          {d.row ? (
                            <div className="flex flex-col">
                              <span className="text-sm font-black text-foreground">{d.row.from}-{d.row.to}</span>
                              <span className="text-[9px] font-bold text-foreground/30 truncate max-w-[120px]">{getSectorName(d.row.from, d.row.to)}</span>
                            </div>
                          ) : ''}
                        </td>
                        <td className="px-3 py-4 text-center text-sm text-foreground font-black border-r-2 border-border">{d.row?.std || ''}</td>
                        <td className="px-3 py-4 text-center text-base font-black border-r-2 border-border text-foreground">{d.row?.eta || ''}</td>
                        <td className={cn(
                          "px-3 py-4 font-black text-center text-base border-r-2 border-border",
                          d.row && d.row.pax < 60 ? 'text-rose-500 text-shadow-neon' : 'text-foreground/80'
                        )}>
                          {d.row?.pax || ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>


          {/* International Table - Right Side */}
          <div className="flex flex-col gap-4">
            <div className="glass-card rounded-2xl border-2 border-border overflow-hidden flex flex-col group h-full">
              <div className="bg-secondary/10 border-b-2 border-border text-foreground text-center py-4 text-xs font-black uppercase tracking-[0.3em]">
                International
              </div>
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-sm border-collapse min-w-[500px]">
                  <thead>
                    <tr className="bg-foreground/5 text-foreground/60 border-b-2 border-border">
                      {headers.map(h => <th key={`i-h-${h}`} className="px-3 py-4 border-r-2 border-border text-center text-xs font-black uppercase tracking-wider">{h}</th>)}
                    </tr>
                  </thead>
                  <tbody className="font-mono text-foreground/80">
                    {intlRows.map((intl, i) => (
                      <tr key={`i-row-${i}`} className="border-b-2 border-border last:border-0 hover:bg-foreground/5 transition-colors group/row">
                        {intl.isFirstInPair && (
                          <td rowSpan={intl.pairLength} className="px-3 py-4 font-black text-center w-10 border-r-2 border-border bg-foreground/5 text-xs text-secondary transition-colors group-hover/row:text-foreground">
                            {intl.sn}
                          </td>
                        )}
                        {intl.isFirstInPair && (
                          <td rowSpan={intl.pairLength} className="px-3 py-4 border-r-2 border-border text-center bg-foreground/2">
                            {intl.row && intl.sn ? (
                              <input
                                type="text"
                                value={intl.row.reg}
                                onChange={(e) => onUpdateReg(intl.row!.flightNo, 0, e.target.value.toUpperCase())}
                                className="w-16 bg-background/60 border-2 border-border focus:outline-none focus:border-secondary rounded-md text-center text-sm py-1.5 text-foreground font-black"
                              />
                            ) : (
                              <div className="text-center text-sm font-black text-foreground">{intl.row?.reg || ''}</div>
                            )}
                          </td>
                        )}
                        <td className="px-3 py-4 font-black text-center text-sm border-r-2 border-border text-foreground">{intl.row?.flightNo || ''}</td>
                        <td className="px-3 py-4 whitespace-nowrap text-center border-r-2 border-border uppercase">
                          {intl.row ? (
                            <div className="flex flex-col">
                              <span className="text-sm font-black text-foreground">{intl.row.from}-{intl.row.to}</span>
                              <span className="text-[9px] font-bold text-foreground/30 truncate max-w-[120px]">{getSectorName(intl.row.from, intl.row.to)}</span>
                            </div>
                          ) : ''}
                        </td>
                        <td className="px-3 py-4 text-center text-sm text-foreground font-black border-r-2 border-border">{intl.row?.std || ''}</td>
                        <td className="px-3 py-4 text-center text-base font-black border-r-2 border-border text-foreground">{intl.row?.eta || ''}</td>
                        <td className={cn(
                          "px-3 py-4 font-black text-center text-base border-r-2 border-border",
                          intl.row && intl.row.pax < 60 ? 'text-rose-500 text-shadow-neon' : 'text-foreground/80'
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
    </div>
  </div>
);
};

export default PairedFlightView;

