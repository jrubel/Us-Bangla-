import { FlightRow, isInternationalFlight } from "@/lib/parseFlightData";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { Globe, Trash2 } from "lucide-react";
import { Button } from "./ui/button";
import { getSectorName } from "@/lib/sectorDuration";

interface FlightTableProps {
  data: FlightRow[];
  onDelete?: (flightNo: string, from: string, to: string) => void;
  isEditMode?: boolean;
  onUpdateFlight?: (flightNo: string, from: string, to: string, field: keyof FlightRow, value: string | number) => void;
}

const FlightTable = ({ data, onDelete, isEditMode, onUpdateFlight }: FlightTableProps) => {
  return (
    <div className="rounded-2xl border-2 border-black overflow-hidden glass-card">
      <div className="overflow-x-auto custom-scrollbar">
        <Table className="min-w-[900px]">
        <TableHeader className="bg-foreground/5">
          <TableRow className="hover:bg-transparent border-b-2 border-black font-bold overflow-hidden">
            <TableHead className="w-[70px] text-center text-sm font-black uppercase tracking-widest h-14 text-black border-r-2 border-black">SN</TableHead>
            <TableHead className="text-sm font-black uppercase tracking-widest h-14 text-black border-r-2 border-black px-5">Flight Telemetry</TableHead>
            <TableHead className="text-sm font-black uppercase tracking-widest h-14 text-black border-r-2 border-black px-5">Vector & Sector</TableHead>
            <TableHead className="text-sm font-black uppercase tracking-widest h-14 text-black border-r-2 border-black text-center">STD</TableHead>
            <TableHead className="text-sm font-black uppercase tracking-widest h-14 text-black border-r-2 border-black text-center">ETA</TableHead>
            <TableHead className="text-sm font-black uppercase tracking-widest h-14 text-black border-r-2 border-black text-center">Platform</TableHead>
            <TableHead className="text-sm font-black uppercase tracking-widest h-14 text-black border-r-2 border-black text-center">Registry</TableHead>
            <TableHead className="text-right text-base font-black uppercase tracking-widest h-14 pr-10 text-black">Payload</TableHead>
            {onDelete && <TableHead className="w-10" />}
          </TableRow>
        </TableHeader>
        <TableBody className="font-mono">
          {data.map((row) => {
            const isIntl = isInternationalFlight(row);
            const sectorName = getSectorName(row.from, row.to);
            return (
              <TableRow 
                key={`${row.sn}-${row.from}-${row.to}`}
                className="hover:bg-foreground/5 transition-colors border-b-2 border-black group"
              >
                <TableCell className="text-center font-black text-black text-sm py-4 border-r-2 border-black">{row.sn}</TableCell>
                <TableCell className="font-black text-black text-base py-4 border-r-2 border-black px-4">
                  <div className="flex items-center gap-2">
                    {isEditMode ? (
                      <input
                        type="text"
                        className="bg-background/50 border border-black/50 rounded px-1 text-base focus:outline-none focus:border-primary w-24"
                        value={row.flightNo}
                        onChange={(e) => onUpdateFlight?.(row.flightNo, row.from, row.to, 'flightNo', e.target.value)}
                      />
                    ) : (
                      <span className="group-hover:text-primary transition-colors text-lg">{row.flightNo}</span>
                    )}
                    {isIntl && <Globe size={14} className="text-secondary" />}
                  </div>
                </TableCell>
                <TableCell className="text-base py-4 border-r-2 border-black px-4">
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-1.5 font-black uppercase">
                      <span className="text-black">{row.from}</span>
                      <span className="text-foreground/40">⇢</span>
                      <span className="text-black">{row.to}</span>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-base font-black text-black py-4 border-r-2 border-black text-center">
                  {isEditMode ? (
                    <input
                      type="text"
                      className="w-16 bg-background/50 border border-black/50 rounded px-1 text-center font-mono focus:outline-none focus:border-primary text-base"
                      value={row.std}
                      onChange={(e) => onUpdateFlight?.(row.flightNo, row.from, row.to, 'std', e.target.value)}
                    />
                  ) : (
                    row.std
                  )}
                </TableCell>
                <TableCell className="text-lg font-black text-black py-4 border-r-2 border-black text-center">
                  {isEditMode ? (
                    <input
                      type="text"
                      className="w-16 bg-background/50 border border-black/50 rounded px-1 text-center font-mono focus:outline-none focus:border-primary text-lg"
                      value={row.eta}
                      onChange={(e) => onUpdateFlight?.(row.flightNo, row.from, row.to, 'eta', e.target.value)}
                    />
                  ) : (
                    row.eta
                  )}
                </TableCell>
                <TableCell className="text-sm text-black py-4 uppercase tracking-widest font-black border-r-2 border-black text-center">{row.aircraft}</TableCell>
                <TableCell className="text-base font-black text-black py-4 transition-colors border-r-2 border-black text-center">
                  {isEditMode ? (
                    <input
                      type="text"
                      className="w-16 bg-background/50 border border-black/50 rounded px-1 text-center font-mono focus:outline-none focus:border-primary text-base"
                      value={row.reg}
                      onChange={(e) => onUpdateFlight?.(row.flightNo, row.from, row.to, 'reg', e.target.value)}
                    />
                  ) : (
                    row.reg
                  )}
                </TableCell>
                <TableCell className={cn(
                  "text-right text-xl font-black pr-10 py-4",
                  row.pax < 60 ? 'text-rose-500 text-shadow-neon' : 'text-black'
                )}>
                  {isEditMode ? (
                    <div className="flex justify-end">
                      <input
                        type="number"
                        className="w-16 bg-background/50 border border-black/50 rounded px-1 text-center font-mono focus:outline-none focus:border-primary text-lg"
                        value={row.pax}
                        onChange={(e) => onUpdateFlight?.(row.flightNo, row.from, row.to, 'pax', parseInt(e.target.value) || 0)}
                      />
                    </div>
                  ) : (
                    row.pax
                  )}
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
