import { FlightRow, isInternationalFlight } from "@/lib/parseFlightData";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { Globe, Trash2 } from "lucide-react";
import { Button } from "./ui/button";

interface FlightTableProps {
  data: FlightRow[];
  onDelete?: (flightNo: string, from: string, to: string) => void;
}

const FlightTable = ({ data, onDelete }: FlightTableProps) => {
  return (
    <div className="rounded-2xl border-2 border-border overflow-hidden glass-card">
      <div className="overflow-x-auto custom-scrollbar">
        <Table className="min-w-[900px]">
        <TableHeader className="bg-foreground/5">
          <TableRow className="hover:bg-transparent border-b-2 border-border font-bold overflow-hidden">
            <TableHead className="w-[70px] text-center text-xs font-black uppercase tracking-widest h-14 text-foreground/50 border-r-2 border-border">SN</TableHead>
            <TableHead className="text-xs font-black uppercase tracking-widest h-14 text-foreground/50 border-r-2 border-border px-5">Flight Telemetry</TableHead>
            <TableHead className="text-xs font-black uppercase tracking-widest h-14 text-foreground/50 border-r-2 border-border px-5">Vector</TableHead>
            <TableHead className="text-xs font-black uppercase tracking-widest h-14 text-foreground/50 border-r-2 border-border text-center">STD</TableHead>
            <TableHead className="text-xs font-black uppercase tracking-widest h-14 text-foreground/50 border-r-2 border-border text-center">ETA</TableHead>
            <TableHead className="text-xs font-black uppercase tracking-widest h-14 text-foreground/50 border-r-2 border-border text-center">Platform</TableHead>
            <TableHead className="text-xs font-black uppercase tracking-widest h-14 text-foreground/50 border-r-2 border-border text-center">Registry</TableHead>
            <TableHead className="text-right text-sm font-black uppercase tracking-widest h-14 pr-10 text-foreground/50">Payload</TableHead>
            {onDelete && <TableHead className="w-10" />}
          </TableRow>
        </TableHeader>
        <TableBody className="font-mono">
          {data.map((row) => {
            const isIntl = isInternationalFlight(row);
            return (
              <TableRow 
                key={`${row.flightNo}-${row.from}-${row.to}`}
                className="hover:bg-foreground/5 transition-colors border-b-2 border-border group"
              >
                <TableCell className="text-center font-black text-foreground/50 text-xs py-4 border-r-2 border-border">{row.sn}</TableCell>
                <TableCell className="font-black text-foreground text-sm py-4 border-r-2 border-border px-4">
                  <div className="flex items-center gap-2">
                    <span className="group-hover:text-primary transition-colors text-base">{row.flightNo}</span>
                    {isIntl && <Globe size={14} className="text-secondary" />}
                  </div>
                </TableCell>
                <TableCell className="text-sm py-4 border-r-2 border-border px-4">
                  <div className="flex items-center gap-1.5 font-black uppercase">
                    <span className="text-foreground">{row.from}</span>
                    <span className="text-foreground/40">⇢</span>
                    <span className="text-foreground">{row.to}</span>
                  </div>
                </TableCell>
                <TableCell className="text-sm font-black text-foreground py-4 border-r-2 border-border text-center">{row.std}</TableCell>
                <TableCell className="text-base font-black text-foreground py-4 border-r-2 border-border text-center">{row.eta}</TableCell>
                <TableCell className="text-xs text-foreground py-4 uppercase tracking-widest font-black border-r-2 border-border text-center">{row.aircraft}</TableCell>
                <TableCell className="text-sm font-black text-foreground py-4 transition-colors border-r-2 border-border text-center">{row.reg}</TableCell>
                <TableCell className={cn(
                  "text-right text-lg font-black pr-10 py-4",
                  row.pax < 60 ? 'text-rose-500 text-shadow-neon' : 'text-foreground/80'
                )}>
                  {row.pax}
                </TableCell>
                {onDelete && (
                  <TableCell className="py-4 pr-4">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-muted-foreground hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => onDelete(row.flightNo, row.from, row.to)}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </TableCell>
                )}
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
