import { FlightRow, isInternationalFlight } from "@/lib/parseFlightData";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { Globe } from "lucide-react";

interface FlightTableProps {
  data: FlightRow[];
}

const FlightTable = ({ data }: FlightTableProps) => {
  return (
    <div className="rounded-2xl border border-white/5 overflow-hidden glass-card">
      <div className="overflow-x-auto custom-scrollbar">
        <Table className="min-w-[800px] lg:min-w-0">
        <TableHeader className="bg-white/5">
          <TableRow className="hover:bg-transparent border-white/5">
            <TableHead className="w-[60px] text-center text-[9px] font-black uppercase tracking-widest h-11 text-slate-500">SN</TableHead>
            <TableHead className="text-[9px] font-black uppercase tracking-widest h-11 text-slate-500">Flight Telemetry</TableHead>
            <TableHead className="text-[9px] font-black uppercase tracking-widest h-11 text-slate-500">Vector</TableHead>
            <TableHead className="text-[9px] font-black uppercase tracking-widest h-11 text-slate-500">STD</TableHead>
            <TableHead className="text-[9px] font-black uppercase tracking-widest h-11 text-slate-500">ETA</TableHead>
            <TableHead className="text-[9px] font-black uppercase tracking-widest h-11 text-slate-500">Platform</TableHead>
            <TableHead className="text-[9px] font-black uppercase tracking-widest h-11 text-slate-500">Registry</TableHead>
            <TableHead className="text-right text-[10px] font-black uppercase tracking-widest h-11 pr-8 text-slate-500">Payload</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="font-mono">
          {data.map((row) => {
            const isIntl = isInternationalFlight(row);
            return (
              <TableRow 
                key={`${row.flightNo}-${row.from}-${row.to}`}
                className="hover:bg-white/5 transition-colors border-white/5 group"
              >
                <TableCell className="text-center font-black text-slate-600 text-[10px] py-3">{row.sn}</TableCell>
                <TableCell className="font-black text-white/90 text-[10px] py-3">
                  <div className="flex items-center gap-2">
                    <span className="group-hover:text-primary transition-colors">{row.flightNo}</span>
                    {isIntl && <Globe size={10} className="text-secondary glow-magenta" />}
                  </div>
                </TableCell>
                <TableCell className="text-[10px] py-3">
                  <div className="flex items-center gap-1.5 font-black">
                    <span className="text-white/80">{row.from}</span>
                    <span className="text-slate-700">⇢</span>
                    <span className="text-white/80">{row.to}</span>
                  </div>
                </TableCell>
                <TableCell className="text-[10px] font-black text-slate-500 py-3">{row.std}</TableCell>
                <TableCell className="text-[10px] font-black text-primary py-3 text-shadow-neon">{row.eta}</TableCell>
                <TableCell className="text-[9px] text-slate-500 py-3 uppercase tracking-wider">{row.aircraft}</TableCell>
                <TableCell className="text-[10px] font-black text-slate-400 py-3 group-hover:text-white transition-colors">{row.reg}</TableCell>
                <TableCell className={cn(
                  "text-right text-sm font-black pr-8 py-3",
                  row.pax < 60 ? 'text-rose-500 text-shadow-neon' : 'text-slate-200'
                )}>
                  {row.pax}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      </div>
    </div>
  );
};

export default FlightTable;
