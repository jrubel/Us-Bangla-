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
import { Plane, Table, RefreshCw, Trash2, Copy, Globe, MapPin, LayoutGrid, BarChart3, Settings, CalendarIcon, Menu, Plus, Check, ChevronsUpDown, LogOut } from 'lucide-react';

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
    
    if (field === 'std' || field === 'duration') {
      if (updated.std && updated.duration !== undefined) {
        updated.eta = calculateETAFromDuration(updated.std, updated.duration);
      }
    }

    setReturnFlight(updated);
  };

  const handleManualAdd = () => {
    if (!newFlight.flightNo || !newFlight.from || !newFlight.to) {
      toast.error('Flight No and Vector are required');
      return;
    }

    const flightsToAdd: FlightRow[] = [];
    
    if (isViaCGPEnabled) {
      // Logic for multi-sector via CGP: from -> CGP -> to
      // Outbound Leg 1: from -> CGP
      const sector1Dur = getSectorDuration(newFlight.from || '', 'CGP') || 55;
      const sector1Eta = calculateETAFromDuration(newFlight.std || '00:00', sector1Dur);
      
      const outboundSector1: FlightRow = {
        flightNo: `BS${newFlight.flightNo}`,
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
        flightNo: `BS${newFlight.flightNo}`,
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
          flightNo: `BS${returnFlight.flightNo}`,
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
          flightNo: `BS${returnFlight.flightNo}`,
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
        flightNo: `BS${newFlight.flightNo}`,
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
          flightNo: `BS${returnFlight.flightNo}`,
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
                <Label htmlFor="flightNo" className="text-right text-[10px] font-black uppercase tracking-widest">Flight No</Label>
                <div className="col-span-3 flex items-center">
                  <span className="bg-foreground/10 h-8 px-3 flex items-center text-[10px] font-black border border-r-0 border-border rounded-l-md text-primary">BS</span>
                  <Input 
                    id="flightNo" 
                    value={newFlight.flightNo} 
                    onChange={e => updateNewFlightField('flightNo', e.target.value.toUpperCase())}
                    className="h-8 text-xs bg-background/50 border-border rounded-l-none" 
                    placeholder="101"
                  />
                </div>
              </div>

              <div className="grid grid-cols-12 items-center gap-4">
                <Label className="col-span-3 text-right text-[10px] font-black uppercase tracking-widest">Vector</Label>
                <div className="col-span-9 flex items-center gap-2">
                  <Popover open={originComboboxOpen} onOpenChange={setOriginComboboxOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={originComboboxOpen}
                        className="flex-1 h-8 text-xs bg-background/50 border-border justify-between font-bold"
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
                        className="flex-1 h-8 text-xs bg-background/50 border-border justify-between font-bold"
                      >
                        {newFlight.to ? (
                          <div className="flex items-center gap-2">
                            <span className="font-black">{newFlight.to}</span>
                            <span className="text-[9px] text-muted-foreground hidden sm:inline">{getSectorName(newFlight.from || 'DAC', newFlight.to)}</span>
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
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right text-[10px] font-black uppercase tracking-widest">Telemetry</Label>
                <div className="col-span-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 space-y-1">
                      <Label className="text-[9px] uppercase font-bold text-muted-foreground ml-1">Departure</Label>
                      <Input 
                        value={newFlight.std} 
                        onChange={e => updateNewFlightField('std', e.target.value)}
                        className="h-8 text-xs bg-background/50 border-border text-center px-1" 
                        placeholder="STD"
                        type="time"
                      />
                    </div>
                    <div className="flex-1 space-y-1">
                      <Label className="text-[9px] uppercase font-bold text-muted-foreground ml-1">Block Time</Label>
                      <Input 
                        value={newFlight.duration || ''} 
                        onChange={e => updateNewFlightField('duration', Number(e.target.value))}
                        className="h-8 text-xs bg-background/50 border-border text-center px-1" 
                        placeholder="MIN"
                        type="number"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[9px] uppercase font-bold text-muted-foreground ml-1">Arrival (Auto)</Label>
                    <Input 
                      value={newFlight.eta} 
                      onChange={e => updateNewFlightField('eta', e.target.value)}
                      className="h-8 text-xs bg-background/50 border-border text-center px-1" 
                      placeholder="ETA"
                      type="time"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="pax" className="text-right text-[10px] font-black uppercase tracking-widest">Payload</Label>
                <Input 
                  id="pax" 
                  type="number"
                  value={newFlight.pax} 
                  onChange={e => updateNewFlightField('pax', Number(e.target.value))}
                  className="col-span-3 h-8 text-xs bg-background/50 border-border" 
                />
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
                    <div className="col-span-3 flex items-center">
                      <span className="bg-foreground/10 h-8 px-3 flex items-center text-[10px] font-black border border-r-0 border-border rounded-l-md text-secondary">BS</span>
                      <Input 
                        id="ret-flightNo" 
                        value={returnFlight.flightNo} 
                        onChange={e => updateReturnFlightField('flightNo', e.target.value.toUpperCase())}
                        className="h-8 text-xs bg-background/50 border-border rounded-l-none" 
                        placeholder="102"
                      />
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
                    <div className="col-span-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 space-y-1">
                          <Label className="text-[9px] uppercase font-bold text-muted-foreground ml-1">DEP FROM {newFlight.to || 'DEST'}</Label>
                          <Input 
                            value={returnFlight.std} 
                            onChange={e => updateReturnFlightField('std', e.target.value)}
                            className="h-8 text-xs bg-background/50 border-border text-center px-1 font-bold" 
                            placeholder="STD"
                            type="time"
                          />
                        </div>
                        <div className="flex-1 space-y-1">
                          <Label className="text-[9px] uppercase font-bold text-muted-foreground ml-1">Block Time</Label>
                          <Input 
                            value={returnFlight.duration || ''} 
                            onChange={e => updateReturnFlightField('duration', Number(e.target.value))}
                            className="h-8 text-xs bg-background/50 border-border text-center px-1 font-bold" 
                            placeholder="MIN"
                            type="number"
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[9px] uppercase font-bold text-muted-foreground ml-1">ARR AT DAC (Auto)</Label>
                        <Input 
                          value={returnFlight.eta} 
                          onChange={e => updateReturnFlightField('eta', e.target.value)}
                          className="h-8 text-xs bg-background/50 border-border text-center px-1 font-bold" 
                          placeholder="ETA"
                          type="time"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="ret-pax" className="text-right text-[10px] font-black uppercase tracking-widest">Payload</Label>
                    <Input 
                      id="ret-pax" 
                      type="number"
                      value={returnFlight.pax} 
                      onChange={e => updateReturnFlightField('pax', Number(e.target.value))}
                      className="col-span-3 h-8 text-xs bg-background/50 border-border" 
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Shared Registry */}
            <div className="pt-2 border-t border-border mt-2">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="reg" className="text-right text-[10px] font-black uppercase tracking-widest">Registry</Label>
                <div className="col-span-3 flex items-center">
                  <span className="bg-foreground/10 h-8 px-3 flex items-center text-[10px] font-black border border-r-0 border-border rounded-l-md text-muted-foreground">S2-</span>
                  <Input 
                    id="reg" 
                    value={newFlight.reg} 
                    maxLength={3}
                    onChange={e => updateNewFlightField('reg', e.target.value.toUpperCase())}
                    className="h-8 text-xs bg-background/50 border-border rounded-l-none" 
                    placeholder="AFF"
                  />
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
