import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { parseFlightData, FlightRow, refreshFlightETAs, isInternationalFlight } from '@/lib/parseFlightData';
import { getSectorDuration, getAvailableDestinations, AIRPORT_NAMES, getSectorName, getSectorOverrides } from '@/lib/sectorDuration';
import FlightTable from '@/components/FlightTable';
import PairedFlightView from '@/components/PairedFlightView';
import FlightCharts from '@/components/FlightCharts';
import FlightMap from '@/components/FlightMap';
import SectorDurationManager from '@/components/SectorDurationManager';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plane, Table, RefreshCw, Trash2, Copy, Globe, MapPin, LayoutGrid, BarChart3, Settings, CalendarIcon, Menu, Plus, Check, ChevronsUpDown, LogOut, Clock, ChevronUp, ChevronDown } from 'lucide-react';

type FilterMode = 'all' | 'departure' | 'arrival';
type RouteType = 'all' | 'domestic' | 'international';
type ShiftMode = 'all' | 'morning' | 'evening';
type AppTheme = 'cyberpunk' | 'midnight' | 'emerald' | 'minimal-dark' | 'classic';

const timeToMinutes = (timeStr: string) => {
  if (!timeStr) return 0;
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + (minutes || 0);
};

const isFlightInShift = (flight: FlightRow, shift: ShiftMode): boolean => {
  if (shift === 'all') return true;
  
  let timeStr = '';
  if (flight.from === 'DAC') {
    timeStr = flight.std;
  } else if (flight.to === 'DAC') {
    timeStr = flight.eta;
  } else {
    timeStr = flight.std;
  }

  const mins = timeToMinutes(timeStr);
  const morningStart = 2 * 60; // 02:00
  const morningEnd = 14 * 60;  // 14:00

  if (shift === 'morning') {
    return mins >= morningStart && mins < morningEnd;
  }
  
  if (shift === 'evening') {
    return mins >= morningEnd || mins < morningStart;
  }

  return true;
};


const NiceTimeInput = ({ 
  label, 
  value, 
  onChange, 
  className,
  error
}: { 
  label: string; 
  value: string; 
  onChange: (val: string) => void;
  className?: string;
  error?: string;
}) => {
  const [h, m] = value && value.includes(':') ? value.split(':').map(Number) : [0, 0];
  const [pickerMode, setPickerMode] = useState<'shortcuts' | 'clock'>('clock');

  const adjust = (type: 'h' | 'm', amount: number) => {
    if (type === 'h') {
      const newH = (h + amount + 24) % 24;
      onChange(`${String(newH).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    } else {
      const newM = (m + amount + 60) % 60;
      onChange(`${String(h).padStart(2, '0')}:${String(newM).padStart(2, '0')}`);
    }
  };

  const handleType = (type: 'h' | 'm', val: string) => {
    const num = parseInt(val.replace(/\D/g, '').slice(0, 2)) || 0;
    if (type === 'h') {
      const clamped = Math.min(23, Math.max(0, num));
      onChange(`${String(clamped).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    } else {
      const clamped = Math.min(59, Math.max(0, num));
      onChange(`${String(h).padStart(2, '0')}:${String(clamped).padStart(2, '0')}`);
    }
  };

  const ClockFace = ({ type, val, onSel }: { type: 'h' | 'm', val: number, onSel: (v: number) => void }) => {
    const items = type === 'h' ? [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] : [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
    return (
      <div className="relative w-32 h-32 rounded-full border border-primary/20 bg-primary/5 flex items-center justify-center m-auto">
        <div className="absolute w-1 h-1 rounded-full bg-primary z-10" />
        {items.map((item, i) => {
          const angle = (i * 30 - 90) * (Math.PI / 180);
          const x = Math.cos(angle) * 50;
          const y = Math.sin(angle) * 50;
          const isSelected = type === 'h' ? (val % 12 === item % 12) : val === item;
          return (
            <button
              key={item}
              onClick={() => onSel(item)}
              className={cn(
                "absolute w-5 h-5 rounded-full text-[9px] font-black transition-all flex items-center justify-center",
                isSelected ? "bg-primary text-primary-foreground scale-110 shadow-lg z-20" : "hover:bg-primary/20 text-muted-foreground"
              )}
              style={{ transform: `translate(${x}px, ${y}px)` }}
            >
              {item === 0 && type === 'm' ? '00' : item}
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div className={cn("space-y-1", className)}>
      <Label className="text-[9px] uppercase font-black text-primary/70 ml-1">{label}</Label>
      <div className={cn(
        "flex items-center gap-1 p-1 bg-foreground/5 rounded-lg border border-border/50 transition-colors", 
        error && "border-destructive ring-1 ring-destructive"
      )}>
        <div className="flex flex-col items-center">
           <Button variant="ghost" size="icon" className="h-4 w-6 p-0 hover:bg-primary/20" onClick={() => adjust('h', 1)}>
             <ChevronUp className="h-3 w-3" />
           </Button>
           <input
             className="h-7 w-8 bg-transparent border-none focus:ring-0 text-center font-black text-xs text-primary p-0"
             value={String(h).padStart(2, '0')}
             onChange={(e) => handleType('h', e.target.value)}
             maxLength={2}
           />
           <Button variant="ghost" size="icon" className="h-4 w-6 p-0 hover:bg-primary/20" onClick={() => adjust('h', -1)}>
             <ChevronDown className="h-3 w-3" />
           </Button>
        </div>
        <span className="font-black text-xs self-center -mt-1">:</span>
        <div className="flex flex-col items-center">
           <Button variant="ghost" size="icon" className="h-4 w-6 p-0 hover:bg-primary/20" onClick={() => adjust('m', 5)}>
              <ChevronUp className="h-3 w-3" />
           </Button>
           <input
             className="h-7 w-8 bg-transparent border-none focus:ring-0 text-center font-black text-xs text-primary p-0"
             value={String(m).padStart(2, '0')}
             onChange={(e) => handleType('m', e.target.value)}
             maxLength={2}
           />
           <Button variant="ghost" size="icon" className="h-4 w-6 p-0 hover:bg-primary/20" onClick={() => adjust('m', -5)}>
              <ChevronDown className="h-3 w-3" />
           </Button>
        </div>
        <div className="flex flex-col gap-1 ml-1">
           <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-primary"><Clock className="h-3 w-3" /></Button>
              </PopoverTrigger>
              <PopoverContent className="w-[180px] p-2 bg-background border-border shadow-2xl z-[150]" align="end">
                <Tabs value={pickerMode} onValueChange={(v: any) => setPickerMode(v)} className="w-full">
                  <TabsList className="grid grid-cols-2 h-7 bg-muted/50 mb-2">
                    <TabsTrigger value="clock" className="text-[8px] font-black uppercase">Clock</TabsTrigger>
                    <TabsTrigger value="shortcuts" className="text-[8px] font-black uppercase">Shortcuts</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="clock" className="space-y-3 mt-0">
                    <div className="flex flex-col items-center gap-2">
                      <ClockFace type="h" val={h} onSel={(v) => onChange(`${String(v).padStart(2, '0')}:${String(m).padStart(2, '0')}`)} />
                      <div className="w-full h-px bg-border/50" />
                      <div className="flex gap-1 flex-wrap justify-center">
                        {[0, 15, 30, 45].map(min => (
                          <Button 
                            key={min} 
                            variant="ghost" 
                            className={cn("h-6 text-[9px] font-black px-2 bg-primary/10", m === min && "bg-primary text-primary-foreground")}
                            onClick={() => onChange(`${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`)}
                          >
                            :{String(min).padStart(2, '0')}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="shortcuts" className="mt-0">
                    <div className="grid grid-cols-3 gap-1">
                      {["02:00", "04:30", "06:00", "08:15", "10:00", "12:00", "14:00", "16:00", "18:00"].map(t => (
                        <Button 
                          key={t} 
                          variant="ghost" 
                          className="h-6 text-[9px] font-bold p-1 bg-foreground/5 hover:bg-primary/20" 
                          onClick={() => onChange(t)}
                        >
                          {t}
                        </Button>
                      ))}
                      <Button 
                        variant="destructive" 
                        className="h-6 text-[9px] font-bold p-1 col-span-3 mt-1 uppercase tracking-widest" 
                        onClick={() => onChange("00:00")}
                      >
                        Reset
                      </Button>
                    </div>
                  </TabsContent>
                </Tabs>
              </PopoverContent>
           </Popover>
        </div>
      </div>
      {error && <p className="text-[9px] font-bold text-destructive uppercase tracking-widest pl-1 mt-0.5">{error}</p>}
    </div>
  );
};

const LiveClock = () => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (d: Date, utc = false) => {
    const hours = utc ? d.getUTCHours() : d.getHours();
    const minutes = utc ? d.getUTCMinutes() : d.getMinutes();
    const seconds = utc ? d.getUTCSeconds() : d.getSeconds();
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  return (
    <div className="flex gap-4 items-center bg-black/40 backdrop-blur-xl border border-white/10 px-4 py-1.5 rounded-xl shadow-[0_0_20px_rgba(0,0,0,0.5)] ring-1 ring-inset ring-white/5">
      <div className="flex flex-col">
        <span className="text-[7px] font-black uppercase tracking-[0.2em] text-primary/40 leading-none mb-1">UTC ZULU</span>
        <div className="flex items-baseline gap-1">
          <span className="text-sm font-mono font-black text-primary leading-none tracking-tighter drop-shadow-[0_0_8px_rgba(var(--primary),0.5)]">
            {formatTime(time, true).split(':').slice(0, 2).join(':')}
          </span>
          <span className="text-[10px] font-mono font-black text-primary/50 leading-none">
            {formatTime(time, true).split(':')[2]}
          </span>
        </div>
      </div>
      <div className="w-px h-6 bg-white/10 self-center" />
      <div className="flex flex-col">
        <span className="text-[7px] font-black uppercase tracking-[0.2em] text-secondary/40 leading-none mb-1">LOCAL BST</span>
        <div className="flex items-baseline gap-1">
          <span className="text-sm font-mono font-black text-secondary leading-none tracking-tighter">
            {formatTime(time).split(':').slice(0, 2).join(':')}
          </span>
          <span className="text-[10px] font-mono font-black text-secondary/50 leading-none">
            {formatTime(time).split(':')[2]}
          </span>
        </div>
      </div>
    </div>
  );
};

const Index = () => {
  const [activeTab, setActiveTab] = useState('paired');
  const [input, setInput] = useState(() => localStorage.getItem('flightInput') || '');
  const [data, setData] = useState<FlightRow[]>(() => {
    const saved = localStorage.getItem('flightData');
    return saved ? JSON.parse(saved) : [];
  });
  const [filter, setFilter] = useState<FilterMode>('all');
  const [routeType, setRouteType] = useState<RouteType>('all');
  const [shift, setShift] = useState<ShiftMode>(() => (localStorage.getItem('flightShift') as ShiftMode) || 'all');
  const [theme, setTheme] = useState<AppTheme>(() => (localStorage.getItem('appTheme') as AppTheme) || 'cyberpunk');
  const [lastNeonTheme, setLastNeonTheme] = useState<AppTheme>(() => {
    const saved = localStorage.getItem('appTheme') as AppTheme;
    return (saved && saved !== 'minimal-dark') ? saved : 'cyberpunk';
  });
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const saved = localStorage.getItem('flightDate');
    return saved ? new Date(saved) : new Date();
  });
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isManualEntryOpen, setIsManualEntryOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isReturnLegEnabled, setIsReturnLegEnabled] = useState(false);
  const [isViaCGPEnabled, setIsViaCGPEnabled] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [newFlight, setNewFlight] = useState<Partial<FlightRow & { duration: number }>>({
    flightNo: '',
    from: 'DAC',
    to: '',
    std: '',
    eta: '',
    duration: 0,
    aircraft: '-',
    reg: '',
    pax: 0,
    sn: 0
  });

  const [returnFlight, setReturnFlight] = useState<Partial<FlightRow & { duration: number }>>({
    flightNo: '',
    std: '',
    eta: '',
    duration: 0,
    pax: 0
  });

  const calculateETAFromDuration = (std: string, duration: number): string => {
    if (!std || isNaN(duration)) return '';
    const [h, m] = std.split(':').map(Number);
    const totalMins = h * 60 + (m || 0) + duration;
    const etaH = Math.floor(totalMins / 60) % 24;
    const etaM = totalMins % 60;
    return `${String(etaH).padStart(2, '0')}:${String(etaM).padStart(2, '0')}`;
  };

  const [originComboboxOpen, setOriginComboboxOpen] = useState(false);
  const [comboboxOpen, setComboboxOpen] = useState(false);
  const [destRefreshTrigger, setDestRefreshTrigger] = useState(0);

  const origins = useMemo(() => {
    const s = new Set<string>();
    const overrides = getSectorOverrides();
    Object.keys(overrides).forEach(key => {
      const from = key.split('-')[0];
      if (from) s.add(from);
    });
    // Always include DAC
    s.add('DAC');
    return Array.from(s).sort();
  }, [destRefreshTrigger]);

  const destinations = useMemo(() => getAvailableDestinations(newFlight.from || 'DAC'), [newFlight.from, destRefreshTrigger]);

  const calculateReturnFlightNo = (flightNo: string): string => {
    const match = flightNo.match(/\d+/);
    if (!match) return '';
    const num = parseInt(match[0], 10);
    // Always add +1, if result is odd, add another +1 to make it even
    const nextNum = (num + 1) % 2 === 0 ? num + 1 : num + 2;
    return nextNum.toString();
  };

  const updateNewFlightField = (field: keyof (FlightRow & { duration: number }), value: string | number) => {
    const updated = { ...newFlight, [field]: value };
    
    // Clear error for this field
    if (formErrors[field]) {
      setFormErrors(prev => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
    if (field === 'from' || field === 'to') {
      const dur = getSectorDuration(updated.from || '', updated.to || '');
      if (dur) {
        updated.duration = dur;
        if (updated.std) {
          updated.eta = calculateETAFromDuration(updated.std, dur);
        }
        // Sync duration to return leg if enabled
        if (isReturnLegEnabled) {
          const returnDur = getSectorDuration(updated.to || '', updated.from || '') || dur;
          setReturnFlight(prev => {
            const newReturn = { ...prev, duration: returnDur };
            if (newReturn.std) {
              newReturn.eta = calculateETAFromDuration(newReturn.std, returnDur);
            }
            return newReturn;
          });
        }
      }
      if (field === 'to' && !['DXB', 'AUH', 'MCT', 'DOH'].includes(updated.to || '')) {
        setIsViaCGPEnabled(false);
      }
    }
    
    if (field === 'std' || field === 'duration') {
      if (updated.std && updated.duration !== undefined) {
        updated.eta = calculateETAFromDuration(updated.std, updated.duration);
      }
      
      // If duration changed, sync to return leg
      if (field === 'duration' && isReturnLegEnabled) {
        setReturnFlight(prev => {
          const newReturn = { ...prev, duration: Number(updated.duration) };
          if (newReturn.std) {
            newReturn.eta = calculateETAFromDuration(newReturn.std, Number(updated.duration));
          }
          return newReturn;
        });
      }
    }

    if (field === 'flightNo' && isReturnLegEnabled) {
      const returnNo = calculateReturnFlightNo(value.toString());
      setReturnFlight(prev => ({ ...prev, flightNo: returnNo }));
    }

    setNewFlight(updated);
  };

  const updateReturnFlightField = (field: keyof (FlightRow & { duration: number }), value: string | number) => {
    const updated = { ...returnFlight, [field]: value };
    
    // Clear error for this field
    const errorKey = field === 'flightNo' ? 'retFlightNo' : 
                     field === 'std' ? 'retStd' : 
                     field === 'duration' ? 'retDuration' : 
                     field === 'pax' ? 'retPax' : null;
    
    if (errorKey && formErrors[errorKey]) {
      setFormErrors(prev => {
        const next = { ...prev };
        delete next[errorKey];
        return next;
      });
    }
    if (field === 'std' || field === 'duration') {
      if (updated.std && updated.duration !== undefined) {
        updated.eta = calculateETAFromDuration(updated.std, updated.duration);
      }
    }

    setReturnFlight(updated);
  };

  const handleManualAdd = () => {
    // Validation
    const errors: Record<string, string> = {};
    const timeRegex = /^([01]\d|2[0-3]):?([0-5]\d)$/;
    
    // Main Leg Validation
    if (!newFlight.flightNo) {
      errors.flightNo = 'BS number required';
    } else if (!/^\d+$/.test(String(newFlight.flightNo))) {
      errors.flightNo = 'Must be numbers only';
    }

    if (!newFlight.from) errors.from = 'Required';
    if (!newFlight.to) errors.to = 'Required';
    
    if (!newFlight.std || newFlight.std === '00:00') {
      errors.std = 'Field required';
    } else if (!timeRegex.test(newFlight.std)) {
      errors.std = 'Invalid HH:MM';
    }

    if (!newFlight.aircraft || newFlight.aircraft === '-') errors.aircraft = 'Required';
    if (!newFlight.reg) errors.reg = 'Required';
    
    if (!newFlight.duration || newFlight.duration <= 0) errors.duration = 'Required';
    if (newFlight.pax !== undefined && Number(newFlight.pax) < 0) errors.pax = 'Invalid';

    // Return Leg Validation
    if (isReturnLegEnabled) {
      if (!returnFlight.flightNo) {
        errors.retFlightNo = 'BS number required';
      } else if (!/^\d+$/.test(String(returnFlight.flightNo))) {
        errors.retFlightNo = 'Must be numbers only';
      }

      if (!returnFlight.std || returnFlight.std === '00:00') {
        errors.retStd = 'Field required';
      } else if (!timeRegex.test(returnFlight.std || '')) {
        errors.retStd = 'Invalid HH:MM';
      }

      if (!returnFlight.duration || returnFlight.duration <= 0) errors.retDuration = 'Required';
      if (returnFlight.pax !== undefined && Number(returnFlight.pax) < 0) errors.retPax = 'Invalid';
    }

    setFormErrors(errors);

    if (Object.keys(errors).length > 0) {
      toast.error('Check form fields');
      return;
    }

    const flightsToAdd: FlightRow[] = [];
    
    if (isViaCGPEnabled) {
      // Logic for multi-sector via CGP: from -> CGP -> to
      // Outbound Leg 1: from -> CGP
      const sector1Dur = getSectorDuration(newFlight.from || '', 'CGP') || 55;
      const sector1Eta = calculateETAFromDuration(newFlight.std || '00:00', sector1Dur);
      
      const outboundSector1: FlightRow = {
        flightNo: `BS ${newFlight.flightNo}`,
        from: newFlight.from || '',
        to: 'CGP',
        std: newFlight.std || '',
        eta: sector1Eta,
        aircraft: newFlight.aircraft || '-',
        reg: `S2-${newFlight.reg || ''}`,
        pax: Math.floor(Number(newFlight.pax) * 0.4) || 0, // Assume some split or let user edit later
        sn: data.length + 1
      };
      flightsToAdd.push(outboundSector1);

      // Outbound Leg 2: CGP -> to
      // 60 min ground time at CGP
      const groundTime = 60;
      const sector2Std = calculateETAFromDuration(sector1Eta, groundTime);
      const sector2Dur = getSectorDuration('CGP', newFlight.to || '') || 360;
      const sector2Eta = calculateETAFromDuration(sector2Std, sector2Dur);

      const outboundSector2: FlightRow = {
        flightNo: `BS ${newFlight.flightNo}`,
        from: 'CGP',
        to: newFlight.to || '',
        std: sector2Std,
        eta: sector2Eta,
        aircraft: newFlight.aircraft || '-',
        reg: `S2-${newFlight.reg || ''}`,
        pax: Number(newFlight.pax) || 0,
        sn: data.length + 2
      };
      flightsToAdd.push(outboundSector2);

      // Return Leg via CGP
      if (isReturnLegEnabled) {
        // Return Leg 1: to -> CGP
        const retSector1Dur = getSectorDuration(newFlight.to || '', 'CGP') || 360;
        const retSector1Eta = calculateETAFromDuration(returnFlight.std || '00:00', retSector1Dur);

        const returnSector1: FlightRow = {
          flightNo: `BS ${returnFlight.flightNo}`,
          from: newFlight.to || '',
          to: 'CGP',
          std: returnFlight.std || '',
          eta: retSector1Eta,
          aircraft: newFlight.aircraft || '-',
          reg: `S2-${newFlight.reg || ''}`,
          pax: Number(returnFlight.pax) || 0,
          sn: data.length + 3
        };
        flightsToAdd.push(returnSector1);

        // Return Leg 2: CGP -> from
        const retSector2Std = calculateETAFromDuration(retSector1Eta, groundTime);
        const retSector2Dur = getSectorDuration('CGP', newFlight.from || '') || 55;
        const retSector2Eta = calculateETAFromDuration(retSector2Std, retSector2Dur);

        const returnSector2: FlightRow = {
          flightNo: `BS ${returnFlight.flightNo}`,
          from: 'CGP',
          to: newFlight.from || '',
          std: retSector2Std,
          eta: retSector2Eta,
          aircraft: newFlight.aircraft || '-',
          reg: `S2-${newFlight.reg || ''}`,
          pax: Math.floor(Number(returnFlight.pax) * 0.4) || 0,
          sn: data.length + 4
        };
        flightsToAdd.push(returnSector2);
      }
    } else {
      // Standard Direct Flight
      const flightToAdd: FlightRow = {
        flightNo: `BS ${newFlight.flightNo}`,
        from: newFlight.from || '',
        to: newFlight.to || '',
        std: newFlight.std || '',
        eta: newFlight.eta || '',
        aircraft: newFlight.aircraft || '-',
        reg: `S2-${newFlight.reg || ''}`,
        pax: Number(newFlight.pax) || 0,
        sn: data.length + 1
      };
      flightsToAdd.push(flightToAdd);

      if (isReturnLegEnabled) {
        const retFlightToAdd: FlightRow = {
          flightNo: `BS ${returnFlight.flightNo}`,
          from: newFlight.to || '',
          to: newFlight.from || '',
          std: returnFlight.std || '',
          eta: returnFlight.eta || '',
          aircraft: newFlight.aircraft || '-',
          reg: `S2-${newFlight.reg || ''}`,
          pax: Number(returnFlight.pax) || 0,
          sn: data.length + 2
        };
        flightsToAdd.push(retFlightToAdd);
      }
    }

    const updated = [...data, ...flightsToAdd];
    setData(updated);
    localStorage.setItem('flightData', JSON.stringify(updated));
    toast.success(isReturnLegEnabled ? 'Flights added with return' : 'Flight added');
    
    setIsManualEntryOpen(false);
    setIsReturnLegEnabled(false);
    setIsViaCGPEnabled(false);
    
    // Reset state
    setNewFlight({
      flightNo: '',
      from: 'DAC',
      to: '',
      std: '',
      eta: '',
      duration: 0,
      aircraft: '-',
      reg: '',
      pax: 0,
      sn: 0
    });
    setReturnFlight({
      flightNo: '',
      std: '',
      eta: '',
      duration: 0,
      pax: 0
    });
  };

  useEffect(() => {
    if (isManualEntryOpen) {
      setFormErrors({});
    }
  }, [isManualEntryOpen]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('appTheme', theme);
    if (theme !== 'minimal-dark') {
      setLastNeonTheme(theme);
    }
  }, [theme]);

  const handleDateChange = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(date);
      localStorage.setItem('flightDate', date.toISOString());
    }
  };

  const handleInputChange = (val: string) => {
    setInput(val);
    localStorage.setItem('flightInput', val);
  };

  const formattedDate = format(selectedDate, 'EEE, dd MMM yyyy');

  const shiftFilteredData = useMemo(() => {
    return data.filter(r => isFlightInShift(r, shift));
  }, [data, shift]);

  const filteredData = useMemo(() => {
    let result = shiftFilteredData;
    if (filter === 'departure') result = result.filter(r => r.from === 'DAC');
    if (filter === 'arrival') result = result.filter(r => r.to === 'DAC');

    if (routeType === 'domestic') {
      result = result.filter(r => !isInternationalFlight(r));
    } else if (routeType === 'international') {
      result = result.filter(r => isInternationalFlight(r));
    }

    return result;
  }, [shiftFilteredData, filter, routeType]);

  const renumbered = useMemo(() => filteredData.map((r, i) => ({ ...r, sn: i + 1 })), [filteredData]);

  const domesticFlights = useMemo(() => shiftFilteredData.filter(r => !isInternationalFlight(r)), [shiftFilteredData]);
  const internationalFlights = useMemo(() => shiftFilteredData.filter(r => isInternationalFlight(r)), [shiftFilteredData]);

  const stats = useMemo(() => {
    const totalCount = shiftFilteredData.length;
    const totalPax = shiftFilteredData.reduce((sum, r) => sum + (r.pax || 0), 0);

    // Dhaka Departures
    const dacDeps = shiftFilteredData.filter(r => r.from === 'DAC');
    const dacDepsCount = dacDeps.length;
    const dacDepsPax = dacDeps.reduce((sum, r) => sum + (r.pax || 0), 0);
    
    const domDacDeps = dacDeps.filter(r => !isInternationalFlight(r));
    const domDacDepsCount = domDacDeps.length;
    const domDacDepsPax = domDacDeps.reduce((sum, r) => sum + (r.pax || 0), 0);
    
    const intlDacDeps = dacDeps.filter(r => isInternationalFlight(r));
    const intlDacDepsCount = intlDacDeps.length;
    const intlDacDepsPax = intlDacDeps.reduce((sum, r) => sum + (r.pax || 0), 0);

    // Dhaka Arrivals
    const dacArrs = shiftFilteredData.filter(r => r.to === 'DAC');
    const dacArrsCount = dacArrs.length;
    const dacArrsPax = dacArrs.reduce((sum, r) => sum + (r.pax || 0), 0);

    const domDacArrs = dacArrs.filter(r => !isInternationalFlight(r));
    const domDacArrsCount = domDacArrs.length;
    const domDacArrsPax = domDacArrs.reduce((sum, r) => sum + (r.pax || 0), 0);
    
    const intlDacArrs = dacArrs.filter(r => isInternationalFlight(r));
    const intlDacArrsCount = intlDacArrs.length;
    const intlDacArrsPax = intlDacArrs.reduce((sum, r) => sum + (r.pax || 0), 0);

    const totalDomCount = domDacDepsCount + domDacArrsCount;
    const totalDomPax = domDacDepsPax + domDacArrsPax;

    const totalIntlCount = intlDacDepsCount + intlDacArrsCount;
    const totalIntlPax = intlDacDepsPax + intlDacArrsPax;

    return { 
      totalCount, totalPax,
      totalDomCount, totalDomPax,
      totalIntlCount, totalIntlPax,
      domDacDepsCount, domDacDepsPax,
      intlDacDepsCount, intlDacDepsPax,
      domDacArrsCount, domDacArrsPax,
      intlDacArrsCount, intlDacArrsPax
    };
  }, [shiftFilteredData]);

  const handleShiftChange = (s: ShiftMode) => {
    setShift(s);
    localStorage.setItem('flightShift', s);
  };

  const handleGenerate = () => {
    const rows = parseFlightData(input);
    if (rows.length === 0) {
      toast.error('No valid flight data found. Check your input format.');
      return;
    }
    setData(rows);
    localStorage.setItem('flightData', JSON.stringify(rows));
    toast.success(`Parsed ${rows.length} flight(s)`);
    setIsMobileSidebarOpen(false);
  };

  const handleClear = () => {
    setInput('');
    setData([]);
    setFilter('all');
    setRouteType('all');
    setShift('all');
    localStorage.removeItem('flightDate');
    setSelectedDate(new Date());
  };

  const handleUpdateReg = (flightNo: string, sectorIndex: number, newReg: string) => {
    setData(prev => {
      const updated = prev.map(row => 
        row.flightNo === flightNo ? { ...row, reg: newReg } : row
      );
      localStorage.setItem('flightData', JSON.stringify(updated));
      return updated;
    });
  };

  const handleRefresh = () => {
    if (input.trim()) {
      const rows = parseFlightData(input);
      setData(rows);
      toast.success('Table refreshed');
    }
  };

  const handleDurationUpdate = () => {
    setDestRefreshTrigger(prev => prev + 1);
    setData(prev => {
      const updated = refreshFlightETAs(prev);
      localStorage.setItem('flightData', JSON.stringify(updated));
      return updated;
    });
  };

  const handleDeleteFlight = (flightNo: string, from: string, to: string) => {
    const updated = data.filter(r => !(r.flightNo === flightNo && r.from === from && r.to === to));
    setData(updated);
    localStorage.setItem('flightData', JSON.stringify(updated));
    toast.success('Flight removed');
  };
  
  const handleUpdateFlight = (flightNo: string, from: string, to: string, field: 'std' | 'eta' | 'pax', value: string | number) => {
    setData(prev => {
      const updated = prev.map(row => 
        (row.flightNo === flightNo && row.from === from && row.to === to) 
          ? { ...row, [field]: value } 
          : row
      );
      localStorage.setItem('flightData', JSON.stringify(updated));
      return updated;
    });
  };

  const handleCopy = () => {
    if (renumbered.length === 0) return;
    const headers = ['SN', 'Flight No', 'From', 'To', 'STD', 'ETA', 'Aircraft', 'Reg', 'Pax'];
    const tsv = [
      headers.join('\t'),
      ...renumbered.map(r => [r.sn, r.flightNo, r.from, r.to, r.std, r.eta, r.aircraft, r.reg, r.pax].join('\t'))
    ].join('\n');
    navigator.clipboard.writeText(tsv);
    toast.success('Table copied to clipboard');
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-[var(--sidebar-bg)] backdrop-blur-xl overflow-y-auto custom-scrollbar">
      <div className="p-6">
        <div className="flex items-center gap-3 mb-10 group">
          <div className="p-2.5 rounded-xl bg-primary/20 text-primary glow-cyan transition-transform group-hover:scale-110">
            <Plane className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-foreground uppercase leading-none">Us Bangla</h1>
            <p className="text-[11px] font-bold text-primary/70 uppercase tracking-[0.2em] mt-1">Morning Load Project</p>
          </div>
        </div>
        
        <nav className="space-y-2">
          <SidebarBtn 
            active={activeTab === 'paired'} 
            onClick={() => { setActiveTab('paired'); setIsMobileSidebarOpen(false); }} 
            icon={<LayoutGrid size={18} />} 
            label="MORNING LOAD" 
          />
          <SidebarBtn 
            active={activeTab === 'table'} 
            onClick={() => { setActiveTab('table'); setIsMobileSidebarOpen(false); }} 
            icon={<Table size={18} />} 
            label="Operations" 
          />
          <SidebarBtn 
            active={activeTab === 'charts'} 
            onClick={() => { setActiveTab('charts'); setIsMobileSidebarOpen(false); }} 
            icon={<BarChart3 size={18} />} 
            label="Analytics" 
          />
          <SidebarBtn 
            active={activeTab === 'map'} 
            onClick={() => { setActiveTab('map'); setIsMobileSidebarOpen(false); }} 
            icon={<Globe size={18} />} 
            label="Network Map" 
          />
          <SidebarBtn 
            active={activeTab === 'settings'} 
            onClick={() => { setActiveTab('settings'); setIsMobileSidebarOpen(false); }} 
            icon={<Settings size={18} />} 
            label="Config" 
          />
        </nav>
      </div>

      <div className="mt-auto p-6 border-t border-border bg-foreground/5">
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Roster Input</p>
              <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-rose-500" onClick={() => handleInputChange('')}>
                <Trash2 size={14} />
              </Button>
            </div>
            <Textarea
              value={input}
              onChange={e => handleInputChange(e.target.value)}
              placeholder="Paste roster data here..."
              className="h-32 text-sm bg-background/50 border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-primary/30 rounded-xl font-mono"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Button onClick={handleGenerate} size="sm" className="w-full h-10 text-xs font-bold uppercase tracking-wider glow-cyan">Process</Button>
            <Button onClick={handleClear} variant="outline" size="sm" className="w-full h-10 text-xs font-bold uppercase tracking-wider border-border text-muted-foreground hover:bg-foreground/5">Reset</Button>
          </div>

          <Button 
            variant="outline" 
            size="sm" 
            className="w-full h-10 text-xs font-bold uppercase tracking-wider border-primary/30 text-primary hover:bg-primary/5 gap-2"
            onClick={() => setIsManualEntryOpen(true)}
          >
            <Plus size={14} /> New Flight
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex selection:bg-primary/30 transition-colors duration-300">
      {/* Sidebar for Desktop */}
      <aside className="hidden lg:flex w-64 border-r border-border bg-[var(--sidebar-bg)] flex-col shrink-0">
        <SidebarContent />
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <div className={cn(
          "absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none mix-blend-overlay",
          (theme === 'minimal-dark' || theme === 'classic') && "hidden"
        )}></div>
        
        <header className="h-16 border-b border-border bg-[var(--header-bg)] backdrop-blur-md flex items-center justify-between px-4 sm:px-8 shrink-0 z-10 transition-colors duration-300">
          <div className="flex items-center gap-2 sm:gap-4 overflow-hidden">
            <Sheet open={isMobileSidebarOpen} onOpenChange={setIsMobileSidebarOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden shrink-0 text-muted-foreground">
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 bg-background border-r border-border w-[240px]">
                <SheetHeader className="sr-only">
                  <SheetTitle>Navigation Menu</SheetTitle>
                  <SheetDescription>Access dashboard views and flight operations input.</SheetDescription>
                </SheetHeader>
                <SidebarContent />
              </SheetContent>
            </Sheet>

            <h2 className="text-sm font-black uppercase tracking-[0.25em] text-primary truncate">
              {activeTab === 'paired' ? 'MORNING LOAD' : activeTab === 'table' ? 'Operations' : activeTab === 'charts' ? 'Analytics' : activeTab === 'map' ? 'Network Map' : 'Config'}
            </h2>
            <div className="hidden md:block">
              <LiveClock />
            </div>
            <div className="hidden sm:block h-3 w-px bg-border" />
            <div className="hidden sm:flex items-center gap-2 text-[10px] uppercase font-bold text-muted-foreground tracking-wider shrink-0">
              <CalendarIcon className="w-3 h-3 text-muted-foreground/60" />
              {formattedDate}
            </div>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-4">
             <div className="hidden md:flex items-center gap-1 p-1 bg-foreground/5 rounded-full border border-border">
                <button onClick={() => setTheme('cyberpunk')} className={cn("w-6 h-6 rounded-full bg-[#00f3ff] transition-transform hover:scale-110", theme === 'cyberpunk' && "ring-2 ring-foreground ring-offset-2 ring-offset-background")} title="Cyberpunk" />
                <button onClick={() => setTheme('midnight')} className={cn("w-6 h-6 rounded-full bg-[#0ea5e9] transition-transform hover:scale-110", theme === 'midnight' && "ring-2 ring-foreground ring-offset-2 ring-offset-background")} title="Midnight" />
                <button onClick={() => setTheme('emerald')} className={cn("w-6 h-6 rounded-full bg-[#10b981] transition-transform hover:scale-110", theme === 'emerald' && "ring-2 ring-foreground ring-offset-2 ring-offset-background")} title="Emerald" />
                <button onClick={() => setTheme('classic')} className={cn("w-6 h-6 rounded-full bg-slate-200 border border-slate-400 transition-transform hover:scale-110", theme === 'classic' && "ring-2 ring-blue-500 ring-offset-2 ring-offset-background")} title="Classic" />
             </div>

             <Select value={shift} onValueChange={(v) => handleShiftChange(v as ShiftMode)}>
                <SelectTrigger className="w-[110px] sm:w-[130px] h-9 text-xs font-bold uppercase bg-foreground/5 border-border text-muted-foreground">
                  <SelectValue placeholder="Shift" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border text-popover-foreground">
                  <SelectItem value="all">Full Day</SelectItem>
                  <SelectItem value="morning">Morning</SelectItem>
                  <SelectItem value="evening">Evening</SelectItem>
                </SelectContent>
             </Select>

             <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-primary hover:bg-primary/5 h-9 px-4">
                  <CalendarIcon className="w-4 h-4 mr-2" />
                  <span className="hidden sm:inline">Set Date</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-popover border-border" align="end">
                <Calendar mode="single" selected={selectedDate} onSelect={handleDateChange} initialFocus className="bg-popover text-popover-foreground" />
              </PopoverContent>
            </Popover>

            <div className="flex items-center space-x-2 bg-background/50 border border-border/50 rounded-lg px-3 h-9 shrink-0">
              <Label htmlFor="edit-mode" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground whitespace-nowrap">Edit Mode</Label>
              <Switch 
                id="edit-mode" 
                checked={isEditMode} 
                onCheckedChange={setIsEditMode}
                className="data-[state=checked]:bg-primary"
              />
            </div>

            <Button 
              variant="ghost" 
              size="icon" 
              className="h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
              onClick={() => {
                localStorage.removeItem('auth_session');
                window.location.reload();
              }}
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-8 z-10 custom-scrollbar">
          {/* Operational Metrics */}
          <div className="space-y-6">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-3">
                <div className="h-1 w-10 bg-primary rounded-full shadow-[0_0_10px_black] dark:shadow-[0_0_10px_var(--neon-cyan)]"></div>
                <h3 className="text-sm font-black text-foreground/50 uppercase tracking-[0.25em]">Fleet Operational Pulse</h3>
              </div>
              <div className="flex items-center gap-3 bg-foreground/5 px-6 py-2.5 rounded-full border border-border">
                <span className="text-xs font-black text-foreground/40 uppercase tracking-widest">Aggregate</span>
                <span className="text-base font-black text-foreground font-mono">{stats.totalCount} MVMT</span>
                <span className="h-4 w-px bg-border mx-1" />
                <span className="text-base font-black text-primary font-mono">{stats.totalPax.toLocaleString()} PAX</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <h4 className="text-xs font-black text-primary/60 uppercase tracking-[0.4em] pl-1 font-sans">Domestic Operational Pulse</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <StatCard label="Total Dom" value={stats.totalDomCount} subValue={stats.totalDomPax} icon={<Table className="glow-cyan" size={16} />} variant="cyan" />
                  <StatCard label="Ex-DAC" value={stats.domDacDepsCount} subValue={stats.domDacDepsPax} icon={<Plane className="rotate-[-45deg]" size={16} />} variant="slate" />
                  <StatCard label="In-DAC" value={stats.domDacArrsCount} subValue={stats.domDacArrsPax} icon={<Plane className="rotate-[135deg]" size={16} />} variant="slate" />
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-xs font-black text-secondary/60 uppercase tracking-[0.4em] pl-1 font-sans">International Operational Pulse</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <StatCard label="Total Intl" value={stats.totalIntlCount} subValue={stats.totalIntlPax} icon={<Globe className="glow-magenta" size={16} />} variant="magenta" />
                  <StatCard label="Ex-DAC" value={stats.intlDacDepsCount} subValue={stats.intlDacDepsPax} icon={<Plane className="rotate-[-45deg]" size={16} />} variant="slate" />
                  <StatCard label="In-DAC" value={stats.intlDacArrsCount} subValue={stats.intlDacArrsPax} icon={<Plane className="rotate-[135deg]" size={16} />} variant="slate" />
                </div>
              </div>
            </div>
          </div>

          <div className="glass-card rounded-2xl p-1 sm:p-2 min-h-[500px] border border-border relative group">
            <div className="absolute -inset-px rounded-2xl bg-gradient-to-tr from-primary/10 via-transparent to-secondary/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
            
            <div className="p-3 sm:p-6 h-full">
               {activeTab === 'paired' && (
                <PairedFlightView 
                  domestic={domesticFlights} 
                  international={internationalFlights} 
                  onUpdateReg={handleUpdateReg} 
                  onDelete={handleDeleteFlight}
                  onUpdateFlight={handleUpdateFlight}
                  isEditMode={isEditMode}
                  dateLabel={formattedDate}
                  onAddFlight={() => setIsManualEntryOpen(true)} 
                />
              )}
              
              {activeTab === 'table' && (
                 <div className="space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-2">
                        <Select value={filter} onValueChange={(v) => setFilter(v as FilterMode)}>
                          <SelectTrigger className="w-[140px] h-9 text-xs font-bold uppercase bg-foreground/5 border-border text-muted-foreground px-4">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-popover border-border text-popover-foreground">
                            <SelectItem value="all">Full Traffic</SelectItem>
                            <SelectItem value="departure">Departures</SelectItem>
                            <SelectItem value="arrival">Arrivals</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center gap-3">
                        <Button onClick={handleRefresh} variant="ghost" size="sm" className="h-9 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-primary hover:bg-foreground/5 gap-2 px-4 shadow-sm">
                          <RefreshCw className="w-4 h-4" /> Sync
                        </Button>
                        <Button onClick={handleCopy} size="sm" className="h-9 text-xs font-bold uppercase tracking-wider glow-cyan gap-2 px-5" disabled={renumbered.length === 0}>
                          <Copy className="w-4 h-4" /> CopyTSV
                        </Button>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      {/* Domestic Table */}
                      <div className="space-y-4">
                        <div className="flex items-center gap-3 px-1">
                          <div className="w-2.5 h-2.5 rounded-full bg-primary shadow-[0_0_8px_black] dark:shadow-[0_0_10px_var(--neon-cyan)]"></div>
                          <span className="text-sm font-black uppercase tracking-[0.2em] text-foreground/80">Domestic Payload Matrix</span>
                        </div>
                        {domesticFlights.length > 0 ? (
                          <FlightTable data={domesticFlights} onDelete={handleDeleteFlight} />
                        ) : (
                          <div className="h-40 flex items-center justify-center border border-border rounded-[var(--radius)] bg-foreground/2 text-xs uppercase font-black tracking-widest text-foreground/40">No Domestic Traffic</div>
                        )}
                      </div>

                      {/* International Table */}
                      <div className="space-y-4">
                        <div className="flex items-center gap-3 px-1">
                          <div className="w-2.5 h-2.5 rounded-full bg-secondary shadow-[0_0_8px_black] dark:shadow-[0_0_10px_var(--neon-magenta)]"></div>
                          <span className="text-sm font-black uppercase tracking-[0.2em] text-foreground/80">International Payload Matrix</span>
                        </div>
                        {internationalFlights.length > 0 ? (
                          <FlightTable data={internationalFlights} onDelete={handleDeleteFlight} />
                        ) : (
                          <div className="h-40 flex items-center justify-center border border-border rounded-[var(--radius)] bg-foreground/2 text-xs uppercase font-black tracking-widest text-foreground/40">No Intl Traffic</div>
                        )}
                      </div>
                    </div>
                 </div>
              )}

              {activeTab === 'charts' && (
                <FlightCharts data={shiftFilteredData} />
              )}

              {activeTab === 'map' && (
                <div className="h-full">
                  <FlightMap flights={shiftFilteredData} />
                </div>
              )}

              {activeTab === 'settings' && (
                <div className="space-y-8 max-w-2xl mx-auto">
                  <div className="glass-card rounded-2xl border border-border p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-xs font-black text-foreground uppercase tracking-[0.3em] flex items-center gap-2">
                          <span className="w-2 h-2 bg-secondary rounded-full glow-magenta" />
                          Visual Telemetry Options
                        </h3>
                        <p className="text-[10px] text-muted-foreground font-black mt-1 uppercase tracking-widest">Interface aesthetic configuration.</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between p-4 bg-foreground/5 rounded-xl border border-border">
                      <div className="space-y-0.5">
                        <label className="text-xs font-black text-foreground uppercase tracking-widest">Simplified Dark Mode</label>
                        <p className="text-[10px] text-muted-foreground font-bold uppercase">Disables neon glows and complex gradients.</p>
                      </div>
                      <Switch 
                        checked={theme === 'minimal-dark'} 
                        onCheckedChange={(checked) => {
                          setTheme(checked ? 'minimal-dark' : lastNeonTheme);
                        }}
                      />
                    </div>

                    <div className="flex items-center justify-between p-4 bg-foreground/5 rounded-xl border border-border">
                      <div className="space-y-0.5">
                        <label className="text-xs font-black text-foreground uppercase tracking-widest">Enterprise Classic Theme</label>
                        <p className="text-[10px] text-muted-foreground font-bold uppercase">Standard aviation professional interface.</p>
                      </div>
                      <Switch 
                        checked={theme === 'classic'} 
                        onCheckedChange={(checked) => {
                          setTheme(checked ? 'classic' : lastNeonTheme);
                        }}
                      />
                    </div>
                  </div>

                  <SectorDurationManager onUpdate={handleDurationUpdate} />
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <Dialog open={isManualEntryOpen} onOpenChange={setIsManualEntryOpen}>
        <DialogContent className="bg-popover border-border text-popover-foreground sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xs font-black uppercase tracking-[0.3em] text-primary">New Flight Entry</DialogTitle>
            <DialogDescription className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest mt-1">Manual telemetry injection</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Primary Leg */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-primary/70">Main Sector</span>
                <div className="h-px flex-1 bg-primary/10 ml-4"></div>
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="aircraft" className="text-right text-[10px] font-black uppercase tracking-widest">Aircraft</Label>
                <div className="col-span-3 space-y-1">
                  <Select 
                    value={newFlight.aircraft} 
                    onValueChange={val => updateNewFlightField('aircraft', val)}
                  >
                    <SelectTrigger id="aircraft" className={cn("h-8 text-xs bg-background/50 border-border", formErrors.aircraft && "border-destructive ring-1 ring-destructive")}>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent className="z-[110]">
                      <SelectItem value="ATR 72-600">ATR 72-600</SelectItem>
                      <SelectItem value="Boeing 737-800">Boeing 737-800</SelectItem>
                      <SelectItem value="Airbus A330">Airbus A330</SelectItem>
                    </SelectContent>
                  </Select>
                  {formErrors.aircraft && <p className="text-[9px] font-bold text-destructive uppercase tracking-widest">{formErrors.aircraft}</p>}
                </div>
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="flightNo" className="text-right text-[10px] font-black uppercase tracking-widest">Flight No</Label>
                <div className="col-span-3 space-y-1">
                  <div className="flex items-center">
                    <span className={cn("bg-foreground/10 h-8 px-3 flex items-center text-[10px] font-black border border-r-0 border-border rounded-l-md text-primary", formErrors.flightNo && "border-destructive")}>BS</span>
                    <Input 
                      id="flightNo" 
                      value={newFlight.flightNo} 
                      onChange={e => updateNewFlightField('flightNo', e.target.value.toUpperCase())}
                      className={cn("h-8 text-xs bg-background/50 border-border rounded-l-none", formErrors.flightNo && "border-destructive ring-1 ring-destructive")}
                      placeholder="101"
                    />
                  </div>
                  {formErrors.flightNo && <p className="text-[9px] font-bold text-destructive uppercase tracking-widest">{formErrors.flightNo}</p>}
                </div>
              </div>

              <div className="grid grid-cols-12 items-center gap-4">
                <Label className="col-span-3 text-right text-[10px] font-black uppercase tracking-widest">Vector</Label>
                <div className="col-span-9 space-y-1">
                  <div className="flex items-center gap-2">
                    <Popover open={originComboboxOpen} onOpenChange={setOriginComboboxOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={originComboboxOpen}
                          className={cn("flex-1 h-8 text-xs bg-background/50 border-border justify-between font-bold", formErrors.from && "border-destructive")}
                        >
                          <span className="font-black">{newFlight.from}</span>
                          <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[120px] p-0 z-[110]" align="start">
                        <Command className="bg-background border-none">
                          <CommandInput placeholder="..." className="h-8 text-xs" />
                          <CommandList className="max-h-[200px]">
                            <CommandGroup>
                              {origins.map((code) => (
                                <CommandItem
                                  key={code}
                                  value={code}
                                  onSelect={() => {
                                    updateNewFlightField('from', code);
                                    setOriginComboboxOpen(false);
                                  }}
                                  className="text-[10px] font-bold py-2"
                                >
                                  {code}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <span className="text-muted-foreground text-xs font-bold">/</span>
                    <Popover open={comboboxOpen} onOpenChange={setComboboxOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={comboboxOpen}
                          className={cn("flex-1 h-8 text-xs bg-background/50 border-border justify-between font-bold", formErrors.to && "border-destructive")}
                        >
                          {newFlight.to ? (
                            <div className="flex items-center gap-2">
                              <span className="font-black">{newFlight.to}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">DEST</span>
                          )}
                          <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[240px] p-0 z-[110]" align="start">
                        <Command className="bg-background border-none">
                          <CommandInput placeholder="Search destination..." className="h-8 text-xs" />
                          <CommandList className="max-h-[300px]">
                            <CommandEmpty className="text-[10px] py-2 px-3">No destination found.</CommandEmpty>
                            <CommandGroup>
                              {destinations.map((dest) => (
                                <CommandItem
                                  key={dest.code}
                                  value={`${dest.code} ${dest.name}`}
                                  onSelect={() => {
                                    updateNewFlightField('to', dest.code);
                                    setComboboxOpen(false);
                                  }}
                                  className="text-[10px] font-bold py-2"
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-3 w-3",
                                      newFlight.to === dest.code ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  <div className="flex flex-col flex-1">
                                    <div className="flex items-center justify-between">
                                      <span className="font-black text-xs leading-none">{dest.code}</span>
                                      <span className="text-[10px] font-mono font-black text-primary/70">{dest.duration}m</span>
                                    </div>
                                    <span className="text-[8px] text-muted-foreground uppercase leading-tight mt-0.5 truncate">
                                      {dest.name}
                                    </span>
                                  </div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                  {(formErrors.from || formErrors.to) && (
                    <p className="text-[9px] font-bold text-destructive uppercase tracking-widest">{formErrors.from || formErrors.to}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right text-[10px] font-black uppercase tracking-widest">Telemetry</Label>
                <div className="col-span-3 space-y-3">
                  <div className="flex items-start gap-4">
                    <NiceTimeInput 
                      label="Departure (STD)" 
                      value={newFlight.std || "00:00"} 
                      onChange={val => updateNewFlightField('std', val)}
                      className="flex-1"
                      error={formErrors.std}
                    />
                    
                    <div className="flex-1 space-y-1">
                      <Label className="text-[9px] uppercase font-black text-primary/70 ml-1">Block Time (Min)</Label>
                      <div className={cn(
                        "flex flex-col gap-1.5 p-1 bg-foreground/5 rounded-lg border border-border/50",
                        formErrors.duration && "border-destructive ring-1 ring-destructive"
                      )}>
                        <Input 
                          value={newFlight.duration || ''} 
                          onChange={e => updateNewFlightField('duration', Number(e.target.value))}
                          className="h-7 text-xs bg-transparent border-none text-center px-1 font-black text-primary focus-visible:ring-0" 
                          placeholder="0"
                          type="number"
                          min="0"
                        />
                        <div className="flex gap-1">
                          {[10, 60].map(val => (
                            <Button 
                              key={val}
                              variant="ghost" 
                              className="h-5 flex-1 text-[8px] font-black p-0 hover:bg-primary/20 bg-primary/5"
                              onClick={() => {
                                const current = Number(newFlight.duration) || 0;
                                updateNewFlightField('duration', current + val);
                              }}
                            >
                              +{val}
                            </Button>
                          ))}
                          <Button 
                            variant="ghost" 
                            className="h-5 flex-1 text-[8px] font-black p-0 hover:bg-destructive/20 bg-destructive/5 text-destructive"
                            onClick={() => updateNewFlightField('duration', 0)}
                          >
                            CLR
                          </Button>
                        </div>
                      </div>
                      {formErrors.duration && <p className="text-[9px] font-bold text-destructive uppercase tracking-widest pl-1">{formErrors.duration}</p>}
                    </div>
                  </div>
                  <NiceTimeInput 
                    label="Arrival (ETA - Computed)" 
                    value={newFlight.eta || "00:00"} 
                    onChange={val => updateNewFlightField('eta', val)}
                    className="w-full"
                    error={formErrors.eta}
                  />
                </div>
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="pax" className="text-right text-[10px] font-black uppercase tracking-widest">Payload</Label>
                <div className="col-span-3 space-y-1">
                  <Input 
                    id="pax" 
                    type="number"
                    min="0"
                    value={newFlight.pax} 
                    onChange={e => updateNewFlightField('pax', Number(e.target.value))}
                    className={cn("h-8 text-xs bg-background/50 border-border", formErrors.pax && "border-destructive ring-1 ring-destructive")} 
                  />
                  {formErrors.pax && <p className="text-[9px] font-bold text-destructive uppercase tracking-widest leading-none">{formErrors.pax}</p>}
                </div>
              </div>
            </div>

            {/* Return Leg Toggle */}
            <div className="flex flex-col gap-3 p-3 bg-foreground/5 rounded-xl border border-border">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-[10px] font-black text-foreground uppercase tracking-widest cursor-pointer" htmlFor="return-leg">Add Return Leg</Label>
                  <p className="text-[9px] text-muted-foreground font-bold uppercase">Automated pair creation</p>
                </div>
                <Switch 
                  id="return-leg"
                  checked={isReturnLegEnabled}
                  onCheckedChange={(checked) => {
                    setIsReturnLegEnabled(checked);
                    if (checked) {
                      const returnNo = newFlight.flightNo ? calculateReturnFlightNo(newFlight.flightNo) : '';
                      const returnDur = (newFlight.from && newFlight.to) 
                        ? (getSectorDuration(newFlight.to, newFlight.from) || newFlight.duration || 0) 
                        : (newFlight.duration || 0);
                      
                      setReturnFlight(prev => {
                        const newReturn = { 
                          ...prev, 
                          flightNo: returnNo,
                          duration: returnDur
                        };
                        if (newReturn.std && newReturn.duration) {
                          newReturn.eta = calculateETAFromDuration(newReturn.std, newReturn.duration);
                        }
                        return newReturn;
                      });
                    }
                  }}
                />
              </div>

              {/* Via CGP Toggle - Only for specific destinations or from DAC */}
              {['DXB', 'AUH', 'MCT', 'DOH'].includes(newFlight.to || '') && (
                <div className="flex items-center justify-between pt-2 border-t border-border/50">
                  <div className="space-y-0.5">
                    <Label className="text-[10px] font-black text-foreground uppercase tracking-widest cursor-pointer" htmlFor="via-cgp">Via CGP (Chittagong)</Label>
                    <p className="text-[9px] text-muted-foreground font-bold uppercase">Multi-sector connecting flight</p>
                  </div>
                  <Switch 
                    id="via-cgp"
                    checked={isViaCGPEnabled}
                    onCheckedChange={setIsViaCGPEnabled}
                  />
                </div>
              )}
            </div>

            {/* Return Leg Details */}
            <AnimatePresence>
              {isReturnLegEnabled && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="space-y-4 overflow-hidden"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest text-secondary/70">Return Leg</span>
                    <div className="h-px flex-1 bg-secondary/10 ml-4"></div>
                  </div>

                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="ret-flightNo" className="text-right text-[10px] font-black uppercase tracking-widest">Flight No</Label>
                    <div className="col-span-3 space-y-1">
                      <div className="flex items-center">
                        <span className={cn("bg-foreground/10 h-8 px-3 flex items-center text-[10px] font-black border border-r-0 border-border rounded-l-md text-secondary", formErrors.retFlightNo && "border-destructive")}>BS</span>
                        <Input 
                          id="ret-flightNo" 
                          value={returnFlight.flightNo} 
                          onChange={e => updateReturnFlightField('flightNo', e.target.value.toUpperCase())}
                          className={cn("h-8 text-xs bg-background/50 border-border rounded-l-none", formErrors.retFlightNo && "border-destructive ring-1 ring-destructive")} 
                          placeholder="102"
                        />
                      </div>
                      {formErrors.retFlightNo && <p className="text-[9px] font-bold text-destructive uppercase tracking-widest">{formErrors.retFlightNo}</p>}
                    </div>
                  </div>

                  <div className="grid grid-cols-12 items-center gap-4">
                    <Label className="col-span-3 text-right text-[10px] font-black uppercase tracking-widest">Vector</Label>
                    <div className="col-span-9 flex items-center gap-2 opacity-80">
                      <div className="flex-1 h-8 bg-foreground/5 border border-border rounded-md flex items-center justify-center text-[10px] font-black text-secondary">
                        {newFlight.to || 'DEST'}
                      </div>
                      <span className="text-muted-foreground text-xs font-bold">/</span>
                      <div className="flex-1 h-8 bg-foreground/5 border border-border rounded-md flex items-center justify-center text-[10px] font-black text-secondary">
                        DAC
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right text-[10px] font-black uppercase tracking-widest">Telemetry</Label>
                    <div className="col-span-3 space-y-3">
                      <div className="flex items-start gap-4">
                          <NiceTimeInput 
                            label={`DEP FROM ${newFlight.to || 'DEST'}`} 
                            value={returnFlight.std || "00:00"} 
                            onChange={val => updateReturnFlightField('std', val)}
                            className="flex-1"
                            error={formErrors.retStd}
                          />
                          
                          <div className="flex-1 space-y-1">
                            <Label className="text-[9px] uppercase font-black text-secondary/70 ml-1">Block Time (Min)</Label>
                            <div className={cn(
                              "flex flex-col gap-1.5 p-1 bg-foreground/5 rounded-lg border border-border/50",
                              formErrors.retDuration && "border-destructive ring-1 ring-destructive"
                            )}>
                              <Input 
                                value={returnFlight.duration || ''} 
                                onChange={e => updateReturnFlightField('duration', Number(e.target.value))}
                                className="h-7 text-xs bg-transparent border-none text-center px-1 font-black text-secondary focus-visible:ring-0" 
                                placeholder="0"
                                type="number"
                                min="0"
                              />
                              <div className="flex gap-1">
                                {[10, 60].map(val => (
                                  <Button 
                                    key={val}
                                    variant="ghost" 
                                    className="h-5 flex-1 text-[8px] font-black p-0 hover:bg-secondary/20 bg-secondary/5"
                                    onClick={() => {
                                      const current = Number(returnFlight.duration) || 0;
                                      updateReturnFlightField('duration', current + val);
                                    }}
                                  >
                                    +{val}
                                  </Button>
                                ))}
                                <Button 
                                  variant="ghost" 
                                  className="h-5 flex-1 text-[8px] font-black p-0 hover:bg-destructive/20 bg-destructive/5 text-destructive"
                                  onClick={() => updateReturnFlightField('duration', 0)}
                                >
                                  CLR
                                </Button>
                              </div>
                            </div>
                            {formErrors.retDuration && <p className="text-[9px] font-bold text-destructive uppercase tracking-widest pl-1">{formErrors.retDuration}</p>}
                          </div>
                        </div>
  
                        <NiceTimeInput 
                          label="ARR AT DAC (Computed)" 
                          value={returnFlight.eta || "00:00"} 
                          onChange={val => updateReturnFlightField('eta', val)}
                          className="w-full"
                          error={formErrors.retEta}
                        />
                    </div>
                  </div>

                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="ret-pax" className="text-right text-[10px] font-black uppercase tracking-widest">Payload</Label>
                    <div className="col-span-3 space-y-1">
                      <Input 
                        id="ret-pax" 
                        type="number"
                        min="0"
                        value={returnFlight.pax} 
                        onChange={e => updateReturnFlightField('pax', Number(e.target.value))}
                        className={cn("h-8 text-xs bg-background/50 border-border", formErrors.retPax && "border-destructive ring-1 ring-destructive")} 
                      />
                      {formErrors.retPax && <p className="text-[9px] font-bold text-destructive uppercase tracking-widest leading-none">{formErrors.retPax}</p>}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Shared Registry */}
            <div className="pt-2 border-t border-border mt-2">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="reg" className="text-right text-[10px] font-black uppercase tracking-widest">Registry</Label>
                <div className="col-span-3 space-y-1">
                  <div className="flex items-center">
                    <span className={cn("bg-foreground/10 h-8 px-3 flex items-center text-[10px] font-black border border-r-0 border-border rounded-l-md text-muted-foreground", formErrors.reg && "border-destructive")}>S2-</span>
                    <Input 
                      id="reg" 
                      value={newFlight.reg} 
                      maxLength={3}
                      onChange={e => updateNewFlightField('reg', e.target.value.toUpperCase())}
                      className={cn("h-8 text-xs bg-background/50 border-border rounded-l-none", formErrors.reg && "border-destructive ring-1 ring-destructive")}
                      placeholder="AFF"
                    />
                  </div>
                  {formErrors.reg && <p className="text-[9px] font-bold text-destructive uppercase tracking-widest">{formErrors.reg}</p>}
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={handleManualAdd} className="w-full text-xs font-black uppercase tracking-widest glow-cyan h-10">Commit {isReturnLegEnabled ? 'Paired Leg' : 'Sector'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const SidebarBtn = ({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) => (
  <button
    onClick={onClick}
    className={cn(
      "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-black uppercase tracking-[0.2em] transition-all group",
      active 
        ? "bg-primary text-primary-foreground glow-cyan scale-[1.02]" 
        : "text-muted-foreground hover:text-primary hover:bg-foreground/5"
    )}
  >
    <span className={cn("transition-colors", active ? "text-primary-foreground" : "text-muted-foreground group-hover:text-primary")}>
      {icon}
    </span>
    {label}
  </button>
);

const StatCard = ({ label, value, subValue, icon, variant }: { label: string, value: string | number, subValue?: number, icon: React.ReactNode, variant: 'cyan' | 'magenta' | 'slate' }) => (
  <motion.div 
    whileHover={{ scale: 1.02, translateY: -2 }}
    whileTap={{ scale: 0.98 }}
    className={cn(
      "glass-card p-4 rounded-[var(--radius)] border border-border flex flex-col gap-4 group transition-all duration-300 relative overflow-hidden",
      "hover:border-primary/50 hover:shadow-[0_0_20px_rgba(0,243,255,0.15)]",
      variant === 'magenta' && "hover:border-secondary/50 hover:shadow-[0_0_20px_rgba(236,72,153,0.15)]"
    )}
  >
    <div className="absolute inset-0 bg-gradient-to-br from-foreground/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
    <div className="flex items-center justify-between relative z-10">
      <div className={cn(
        "p-2.5 rounded-[var(--radius)] shadow-sm border border-border transition-all duration-300",
        variant === 'cyan' ? 'bg-primary/20 text-primary group-hover:shadow-[0_0_10px_var(--neon-cyan)]' : 
        variant === 'magenta' ? 'bg-secondary/20 text-secondary group-hover:shadow-[0_0_10px_var(--neon-magenta)]' : 
        'bg-background/40 text-foreground/40'
      )}>
        {icon}
      </div>
      {subValue !== undefined && (
        <p className="text-xs font-black text-foreground/40 uppercase tracking-widest font-mono">
          {subValue.toLocaleString()} PAX
        </p>
      )}
    </div>
    <div className="overflow-hidden relative z-10">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-foreground/50 mb-1 truncate">{label}</p>
      <p className="text-2xl font-black text-foreground leading-none tracking-tight font-mono">{value}</p>
    </div>
  </motion.div>
);

const RouteFilterBtn = ({ active, onClick, label }: { active: boolean, onClick: () => void, label: string }) => (
  <button
    onClick={onClick}
    className={cn(
      "px-5 py-2 rounded-[var(--radius)] text-xs font-black uppercase tracking-widest transition-all",
      active ? "bg-foreground/10 text-primary border border-border" : "text-foreground/60 hover:text-foreground/80"
    )}
  >
    {label}
  </button>
);

export default Index;
