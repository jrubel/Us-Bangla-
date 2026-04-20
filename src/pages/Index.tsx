import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { parseFlightData, FlightRow, refreshFlightETAs, isInternationalFlight } from '@/lib/parseFlightData';
import FlightTable from '@/components/FlightTable';
import PairedFlightView from '@/components/PairedFlightView';
import FlightCharts from '@/components/FlightCharts';
import FlightMap from '@/components/FlightMap';
import SectorDurationManager from '@/components/SectorDurationManager';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Plane, Table, RefreshCw, Trash2, Copy, Globe, MapPin, LayoutGrid, BarChart3, Settings, CalendarIcon, Menu } from 'lucide-react';

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
    setData(prev => {
      const updated = refreshFlightETAs(prev);
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
    <div className="flex flex-col h-full bg-black/40 backdrop-blur-xl overflow-y-auto custom-scrollbar">
      <div className="p-6">
        <div className="flex items-center gap-3 mb-10 group">
          <div className="p-2.5 rounded-xl bg-primary/20 text-primary glow-cyan transition-transform group-hover:scale-110">
            <Plane className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-base font-black tracking-tighter text-white uppercase leading-none">Us Bangla</h1>
            <p className="text-xs font-bold text-primary/70 uppercase tracking-widest mt-1">Flight Analysis</p>
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

      <div className="mt-auto p-6 border-t border-white/5 bg-white/5">
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-wider text-slate-400 font-bold">Roster Input</p>
              <Button variant="ghost" size="icon" className="h-5 w-5 text-slate-500 hover:text-rose-500" onClick={() => handleInputChange('')}>
                <Trash2 size={14} />
              </Button>
            </div>
            <Textarea
              value={input}
              onChange={e => handleInputChange(e.target.value)}
              placeholder="Paste roster data here..."
              className="h-32 text-sm bg-black/40 border-white/20 text-slate-200 placeholder:text-slate-600 focus-visible:ring-primary/30 rounded-xl font-mono"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Button onClick={handleGenerate} size="sm" className="w-full h-10 text-xs font-bold uppercase tracking-wider glow-cyan">Process</Button>
            <Button onClick={handleClear} variant="outline" size="sm" className="w-full h-10 text-xs font-bold uppercase tracking-wider border-white/20 text-slate-400 hover:bg-white/5">Reset</Button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex selection:bg-primary/30">
      {/* Sidebar for Desktop */}
      <aside className="hidden lg:flex w-64 border-r border-white/5 bg-black/20 flex-col shrink-0">
        <SidebarContent />
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <div className={cn(
          "absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none mix-blend-overlay",
          (theme === 'minimal-dark' || theme === 'classic') && "hidden"
        )}></div>
        
        <header className="h-16 border-b border-white/5 bg-black/20 backdrop-blur-md flex items-center justify-between px-4 sm:px-8 shrink-0 z-10">
          <div className="flex items-center gap-2 sm:gap-4 overflow-hidden">
            <Sheet open={isMobileSidebarOpen} onOpenChange={setIsMobileSidebarOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden shrink-0 text-slate-400">
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 bg-slate-900 border-r-0 w-[240px]">
                <SheetHeader className="sr-only">
                  <SheetTitle>Navigation Menu</SheetTitle>
                  <SheetDescription>Access dashboard views and flight operations input.</SheetDescription>
                </SheetHeader>
                <SidebarContent />
              </SheetContent>
            </Sheet>

            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-primary truncate">
              {activeTab === 'paired' ? 'MORNING LOAD' : activeTab === 'table' ? 'Operations' : activeTab === 'charts' ? 'Analytics' : activeTab === 'map' ? 'Network Map' : 'Config'}
            </h2>
            <div className="hidden sm:block h-3 w-px bg-white/10" />
            <div className="hidden sm:flex items-center gap-2 text-[10px] uppercase font-bold text-slate-500 tracking-wider shrink-0">
              <CalendarIcon className="w-3 h-3 text-slate-600" />
              {formattedDate}
            </div>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-4">
             <div className="hidden md:flex items-center gap-1 p-1 bg-white/5 rounded-full border border-white/5">
                <button onClick={() => setTheme('cyberpunk')} className={cn("w-6 h-6 rounded-full bg-[#00f3ff] transition-transform hover:scale-110", theme === 'cyberpunk' && "ring-2 ring-white ring-offset-2 ring-offset-black")} title="Cyberpunk" />
                <button onClick={() => setTheme('midnight')} className={cn("w-6 h-6 rounded-full bg-[#0ea5e9] transition-transform hover:scale-110", theme === 'midnight' && "ring-2 ring-white ring-offset-2 ring-offset-black")} title="Midnight" />
                <button onClick={() => setTheme('emerald')} className={cn("w-6 h-6 rounded-full bg-[#10b981] transition-transform hover:scale-110", theme === 'emerald' && "ring-2 ring-white ring-offset-2 ring-offset-black")} title="Emerald" />
                <button onClick={() => setTheme('classic')} className={cn("w-6 h-6 rounded-full bg-slate-200 border border-slate-400 transition-transform hover:scale-110", theme === 'classic' && "ring-2 ring-blue-500 ring-offset-2 ring-offset-white")} title="Classic" />
             </div>

             <Select value={shift} onValueChange={(v) => handleShiftChange(v as ShiftMode)}>
                <SelectTrigger className="w-[110px] sm:w-[130px] h-9 text-xs font-bold uppercase bg-white/5 border-white/20 text-slate-400">
                  <SelectValue placeholder="Shift" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-white/20 text-slate-200">
                  <SelectItem value="all">Full Day</SelectItem>
                  <SelectItem value="morning">Morning</SelectItem>
                  <SelectItem value="evening">Evening</SelectItem>
                </SelectContent>
             </Select>

             <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="text-xs font-bold uppercase tracking-wider text-slate-500 hover:text-primary hover:bg-primary/5 h-9 px-4">
                  <CalendarIcon className="w-4 h-4 mr-2" />
                  <span className="hidden sm:inline">Set Date</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-slate-900 border-white/10" align="end">
                <Calendar mode="single" selected={selectedDate} onSelect={handleDateChange} initialFocus className="bg-slate-900 text-slate-200" />
              </PopoverContent>
            </Popover>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-8 z-10 custom-scrollbar">
          {/* Operational Metrics */}
          <div className="space-y-6">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-3">
                <div className="h-1 w-10 bg-primary rounded-full shadow-[0_0_10px_black] dark:shadow-[0_0_10px_var(--neon-cyan)]"></div>
                <h3 className="text-xs font-black text-foreground/40 uppercase tracking-[0.25em]">Fleet Operational Pulse</h3>
              </div>
              <div className="flex items-center gap-3 bg-foreground/5 px-5 py-2 rounded-full border border-border">
                <span className="text-[10px] font-black text-foreground/50 uppercase tracking-widest">Aggregate</span>
                <span className="text-sm font-black text-foreground">{stats.totalCount} MVMT</span>
                <span className="h-3 w-px bg-border mx-1" />
                <span className="text-sm font-black text-primary">{stats.totalPax.toLocaleString()} PAX</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-primary/60 uppercase tracking-[0.4em] pl-1">Domestic Operational Pulse</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <StatCard label="Total Dom" value={stats.totalDomCount} subValue={stats.totalDomPax} icon={<Table className="glow-cyan" size={16} />} variant="cyan" />
                  <StatCard label="Ex-DAC" value={stats.domDacDepsCount} subValue={stats.domDacDepsPax} icon={<Plane className="rotate-[-45deg]" size={16} />} variant="slate" />
                  <StatCard label="In-DAC" value={stats.domDacArrsCount} subValue={stats.domDacArrsPax} icon={<Plane className="rotate-[135deg]" size={16} />} variant="slate" />
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-secondary/60 uppercase tracking-[0.4em] pl-1">International Operational Pulse</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <StatCard label="Total Intl" value={stats.totalIntlCount} subValue={stats.totalIntlPax} icon={<Globe className="glow-magenta" size={16} />} variant="magenta" />
                  <StatCard label="Ex-DAC" value={stats.intlDacDepsCount} subValue={stats.intlDacDepsPax} icon={<Plane className="rotate-[-45deg]" size={16} />} variant="slate" />
                  <StatCard label="In-DAC" value={stats.intlDacArrsCount} subValue={stats.intlDacArrsPax} icon={<Plane className="rotate-[135deg]" size={16} />} variant="slate" />
                </div>
              </div>
            </div>
          </div>

          <div className="glass-card rounded-2xl p-1 sm:p-2 min-h-[500px] border border-white/5 relative group">
            <div className="absolute -inset-px rounded-2xl bg-gradient-to-tr from-primary/10 via-transparent to-secondary/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
            
            <div className="p-3 sm:p-6 h-full">
              {activeTab === 'paired' && (
                <PairedFlightView domestic={domesticFlights} international={internationalFlights} onUpdateReg={handleUpdateReg} dateLabel={formattedDate} />
              )}
              
              {activeTab === 'table' && (
                 <div className="space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-2">
                        <Select value={filter} onValueChange={(v) => setFilter(v as FilterMode)}>
                          <SelectTrigger className="w-[140px] h-9 text-xs font-bold uppercase bg-white/5 border-white/20 text-slate-400 px-4">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-slate-900 border-white/20 text-slate-200">
                            <SelectItem value="all">Full Traffic</SelectItem>
                            <SelectItem value="departure">Departures</SelectItem>
                            <SelectItem value="arrival">Arrivals</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center gap-3">
                        <Button onClick={handleRefresh} variant="ghost" size="sm" className="h-9 text-xs font-bold uppercase tracking-wider text-slate-500 hover:text-primary hover:bg-white/5 gap-2 px-4 shadow-sm">
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
                          <span className="text-xs font-black uppercase tracking-[0.2em] text-foreground/80">Domestic Payload Matrix</span>
                        </div>
                        {domesticFlights.length > 0 ? (
                          <FlightTable data={domesticFlights} />
                        ) : (
                          <div className="h-40 flex items-center justify-center border border-border rounded-[var(--radius)] bg-foreground/2 text-xs uppercase font-black tracking-widest text-foreground/40">No Domestic Traffic</div>
                        )}
                      </div>

                      {/* International Table */}
                      <div className="space-y-4">
                        <div className="flex items-center gap-3 px-1">
                          <div className="w-2.5 h-2.5 rounded-full bg-secondary shadow-[0_0_8px_black] dark:shadow-[0_0_10px_var(--neon-magenta)]"></div>
                          <span className="text-xs font-black uppercase tracking-[0.2em] text-foreground/80">International Payload Matrix</span>
                        </div>
                        {internationalFlights.length > 0 ? (
                          <FlightTable data={internationalFlights} />
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
                  <div className="glass-card rounded-2xl border border-white/5 p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-[10px] font-black text-foreground uppercase tracking-[0.3em] flex items-center gap-2">
                          <span className="w-2 h-2 bg-secondary rounded-full glow-magenta" />
                          Visual Telemetry Options
                        </h3>
                        <p className="text-[8px] text-slate-500 font-black mt-1 uppercase tracking-widest">Interface aesthetic configuration.</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between p-4 bg-white/2 rounded-xl border border-white/5">
                      <div className="space-y-0.5">
                        <label className="text-[10px] font-black text-slate-200 uppercase tracking-widest">Simplified Dark Mode</label>
                        <p className="text-[8px] text-slate-500 font-bold uppercase">Disables neon glows and complex gradients.</p>
                      </div>
                      <Switch 
                        checked={theme === 'minimal-dark'} 
                        onCheckedChange={(checked) => {
                          setTheme(checked ? 'minimal-dark' : lastNeonTheme);
                        }}
                      />
                    </div>

                    <div className="flex items-center justify-between p-4 bg-white/2 rounded-xl border border-white/5">
                      <div className="space-y-0.5">
                        <label className="text-[10px] font-black text-slate-200 uppercase tracking-widest">Enterprise Classic Theme</label>
                        <p className="text-[8px] text-slate-500 font-bold uppercase">Standard aviation professional interface.</p>
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
        : "text-slate-500 hover:text-primary hover:bg-white/5"
    )}
  >
    <span className={cn("transition-colors", active ? "text-primary-foreground" : "text-slate-600 group-hover:text-primary")}>
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
    <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
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
        <p className="text-[11px] font-black text-foreground/40 uppercase tracking-widest">
          {subValue.toLocaleString()} PAX
        </p>
      )}
    </div>
    <div className="overflow-hidden relative z-10">
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/50 mb-1 truncate">{label}</p>
      <p className="text-2xl font-black text-foreground leading-none tracking-tight">{value}</p>
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
