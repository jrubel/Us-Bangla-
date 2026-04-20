import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { FlightRow } from '@/lib/parseFlightData';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Plane, Play, Pause, FastForward, SkipBack, Clock, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';

// Fix for Leaflet default icon issues in React
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

interface Airport {
  code: string;
  name: string;
  lat: number;
  lng: number;
  isDomestic: boolean;
}

const AIRPORTS: Record<string, Airport> = {
  // Domestic
  'DAC': { code: 'DAC', name: 'Dhaka', lat: 23.8433, lng: 90.3978, isDomestic: true },
  'CGP': { code: 'CGP', name: 'Chittagong', lat: 22.2496, lng: 91.8133, isDomestic: true },
  'ZYL': { code: 'ZYL', name: 'Sylhet', lat: 24.8961, lng: 91.8672, isDomestic: true },
  'CXB': { code: 'CXB', name: 'Cox\'s Bazar', lat: 21.4522, lng: 91.9644, isDomestic: true },
  'SPD': { code: 'SPD', name: 'Saidpur', lat: 25.7592, lng: 88.9039, isDomestic: true },
  'BZL': { code: 'BZL', name: 'Barisal', lat: 22.7214, lng: 90.3014, isDomestic: true },
  'JSR': { code: 'JSR', name: 'Jessore', lat: 23.1843, lng: 89.1601, isDomestic: true },
  'RJH': { code: 'RJH', name: 'Rajshahi', lat: 24.3644, lng: 88.6164, isDomestic: true },
  
  // International
  'DXB': { code: 'DXB', name: 'Dubai', lat: 25.2532, lng: 55.3657, isDomestic: false },
  'MCT': { code: 'MCT', name: 'Muscat', lat: 23.5933, lng: 58.2844, isDomestic: false },
  'KUL': { code: 'KUL', name: 'Kuala Lumpur', lat: 2.7456, lng: 101.7072, isDomestic: false },
  'SIN': { code: 'SIN', name: 'Singapore', lat: 1.3644, lng: 103.9915, isDomestic: false },
  'BKK': { code: 'BKK', name: 'Bangkok', lat: 13.6900, lng: 100.7501, isDomestic: false },
  'CCU': { code: 'CCU', name: 'Kolkata', lat: 22.6548, lng: 88.4467, isDomestic: false },
  'CAN': { code: 'CAN', name: 'Guangzhou', lat: 23.3924, lng: 113.2988, isDomestic: false },
  'JED': { code: 'JED', name: 'Jeddah', lat: 21.6796, lng: 39.1565, isDomestic: false },
  'AUH': { code: 'AUH', name: 'Abu Dhabi', lat: 24.4330, lng: 54.6511, isDomestic: false },
  'DOH': { code: 'DOH', name: 'Doha', lat: 25.2731, lng: 51.6081, isDomestic: false },
  'KTM': { code: 'KTM', name: 'Kathmandu', lat: 27.6966, lng: 85.3591, isDomestic: false },
  'KMG': { code: 'KMG', name: 'Kunming', lat: 25.1019, lng: 102.9291, isDomestic: false },
  'DMM': { code: 'DMM', name: 'Dammam', lat: 26.4711, lng: 49.7978, isDomestic: false },
  'RUH': { code: 'RUH', name: 'Riyadh', lat: 24.9576, lng: 46.6988, isDomestic: false },
  'SHJ': { code: 'SHJ', name: 'Sharjah', lat: 25.3286, lng: 55.5172, isDomestic: false },
  'MED': { code: 'MED', name: 'Medina', lat: 24.5535, lng: 39.7051, isDomestic: false },
  'MLE': { code: 'MLE', name: 'Male', lat: 4.1918, lng: 73.5291, isDomestic: false },
  'CMB': { code: 'CMB', name: 'Colombo', lat: 7.1811, lng: 79.8837, isDomestic: false },
};

interface FlightMapProps {
  flights: FlightRow[];
}

const MapController = ({ flights }: { flights: FlightRow[] }) => {
  const map = useMap();

  useEffect(() => {
    if (flights.length === 0) return;

    const points: [number, number][] = [];
    flights.forEach(f => {
      if (AIRPORTS[f.from]) points.push([AIRPORTS[f.from].lat, AIRPORTS[f.from].lng]);
      if (AIRPORTS[f.to]) points.push([AIRPORTS[f.to].lat, AIRPORTS[f.to].lng]);
    });

    if (points.length > 0) {
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [flights, map]);

  return null;
};

const timeToMinutes = (timeStr: string) => {
  if (!timeStr) return 0;
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + (minutes || 0);
};

const minutesToTime = (totalMinutes: number) => {
  const hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = Math.floor(totalMinutes % 60);
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
};

// Memoized Flight Marker for performance
const AircraftMarker = React.memo(({ 
  flight, 
  simTime, 
  isSelected, 
  onSelect 
}: { 
  flight: FlightRow; 
  simTime: number; 
  isSelected: boolean; 
  onSelect: (f: FlightRow) => void;
}) => {
  const startMins = timeToMinutes(flight.std);
  const endMins = timeToMinutes(flight.eta);
  
  if (simTime < startMins || simTime > endMins) return null;

  const from = AIRPORTS[flight.from];
  const to = AIRPORTS[flight.to];
  if (!from || !to) return null;

  const progress = (simTime - startMins) / (endMins - startMins);
  const lat = from.lat + (to.lat - from.lat) * progress;
  const lng = from.lng + (to.lng - from.lng) * progress;

  // Calculate rotation (Bearing)
  const y = Math.sin(to.lng - from.lng) * Math.cos(to.lat);
  const x = Math.cos(from.lat) * Math.sin(to.lat) -
            Math.sin(from.lat) * Math.cos(to.lat) * Math.cos(to.lng - from.lng);
  const bearing = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;

  return (
    <Marker
      position={[lat, lng]}
      zIndexOffset={isSelected ? 2000 : 1000}
      eventHandlers={{ click: () => onSelect(flight) }}
      icon={L.divIcon({
        className: 'custom-plane-icon',
        html: `
          <div class="relative group">
            <div class="absolute -top-10 left-1/2 -translate-x-1/2 bg-black/95 text-[8px] font-black text-white px-2 py-1 rounded border border-white/20 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all duration-300 transform group-hover:-translate-y-1 shadow-2xl z-50 pointer-events-none">
              <div class="text-primary mb-0.5 tracking-tighter">${flight.flightNo}</div>
              <div class="text-[7px] text-white/50 tracking-widest uppercase">${flight.from} &rarr; ${flight.to}</div>
            </div>
            <div style="transform: rotate(${bearing - 45}deg)" class="transition-all duration-300 ${isSelected ? 'text-primary scale-125 drop-shadow-[0_0_8px_var(--primary)]' : 'text-primary/60 hover:text-primary hover:scale-110'}">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" stroke="none">
                <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
              </svg>
            </div>
          </div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      })}
    />
  );
});

AircraftMarker.displayName = 'AircraftMarker';

const FlightMap: React.FC<FlightMapProps> = ({ flights }) => {
  const [selectedFlight, setSelectedFlight] = useState<FlightRow | null>(null);
  const [showAllPaths, setShowAllPaths] = useState(false);
  
  // Simulation State
  const [isSimulating, setIsSimulating] = useState(false);
  const [isLiveMode, setIsLiveMode] = useState(false);
  const [simTime, setSimTime] = useState(0);
  const [simSpeed, setSimSpeed] = useState(1); // Minutes per tick
  const [localFlights, setLocalFlights] = useState<FlightRow[]>(flights);
  const [isFetching, setIsFetching] = useState(false);
  const [telemetryLogs, setTelemetryLogs] = useState<{ id: string; msg: string; type: 'info' | 'warn' | 'success' }[]>([]);

  const addLog = (msg: string, type: 'info' | 'warn' | 'success' = 'info') => {
    setTelemetryLogs(prev => [{ id: Math.random().toString(36), msg, type }, ...prev].slice(0, 5));
  };

  // Initialize local flights when props change
  useEffect(() => {
    setLocalFlights(flights);
  }, [flights]);

  const { startTime, endTime } = useMemo(() => {
    if (localFlights.length === 0) return { startTime: 0, endTime: 1440 };
    const times = localFlights.flatMap(f => [timeToMinutes(f.std), timeToMinutes(f.eta)]);
    const start = Math.min(...times) - 30; // 30 mins before first flight
    const end = Math.max(...times) + 30;   // 30 mins after last flight
    return { startTime: Math.max(0, start), endTime: Math.min(1440, end) };
  }, [localFlights]);

  // Live Mode: Sync simTime to real clock
  useEffect(() => {
    let interval: number;
    if (isLiveMode) {
      interval = window.setInterval(() => {
        const now = new Date();
        setSimTime(now.getHours() * 60 + now.getMinutes());
      }, 1000);
      setIsSimulating(true);
      setSimSpeed(1);
    }
    return () => clearInterval(interval);
  }, [isLiveMode]);

  // Periodic Data Refresh Simulation
  useEffect(() => {
    let interval: number;
    if (isLiveMode || isSimulating) {
      interval = window.setInterval(() => {
        setIsFetching(true);
        addLog("Initiating ADS-B Data Sync...", "info");
        
        setTimeout(() => {
          setIsFetching(false);
          const updatedFlights: string[] = [];
          
          setLocalFlights(prev => prev.map(f => {
            const roll = Math.random();
            if (roll > 0.7) { // 30% chance of a minor update
              const jitter = Math.floor(Math.random() * 5) - 2; // -2 to +2 min
              if (jitter === 0) return f;
              
              const currentEta = timeToMinutes(f.eta);
              const newEta = minutesToTime(currentEta + jitter);
              updatedFlights.push(`${f.flightNo}: ETA adjusted (${jitter > 0 ? '+' : ''}${jitter}m)`);
              return { ...f, eta: newEta };
            }
            return f;
          }));

          if (updatedFlights.length > 0) {
            addLog(`Received ${updatedFlights.length} track updates`, "success");
            updatedFlights.slice(0, 2).forEach(msg => addLog(msg, "info"));
          } else {
            addLog("No changes in fleet positions", "info");
          }
        }, 1500);
      }, 15000); // Check for updates every 15s
    }
    return () => clearInterval(interval);
  }, [isLiveMode, isSimulating]);

  useEffect(() => {
    if (localFlights.length > 0 && simTime < startTime && !isLiveMode) {
      setSimTime(startTime);
    }
  }, [startTime, localFlights.length, isLiveMode, simTime]);

  useEffect(() => {
    let interval: number;
    if (isSimulating && !isLiveMode) {
      interval = window.setInterval(() => {
        setSimTime(prev => {
          const next = prev + (simSpeed / 10); // Update every 100ms
          if (next >= endTime) {
            setIsSimulating(false);
            return endTime;
          }
          return next;
        });
      }, 100);
    }
    return () => clearInterval(interval);
  }, [isSimulating, simSpeed, endTime, isLiveMode]);

  const activeAirports = useMemo(() => {
    return Array.from(new Set(localFlights.flatMap(f => [f.from, f.to])))
      .map(code => AIRPORTS[code])
      .filter((a): a is Airport => !!a);
  }, [localFlights]);

  const mapCenter: [number, number] = [23.6850, 90.3563]; // Center of Bangladesh

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[700px]">
      <div className="lg:col-span-3 relative rounded-2xl overflow-hidden border border-border shadow-2xl glass-card">
        <MapContainer 
          center={mapCenter} 
          zoom={6} 
          style={{ height: '100%', width: '100%', background: '#0b0e14' }}
          zoomControl={false}
        >
          <TileLayer
            attribution='&copy; OpenStreetMap contributors &copy; CARTO'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />
          
          <MapController flights={localFlights} />

          {/* Radar Scanning Effect */}
          {isFetching && (
            <div className="absolute inset-0 pointer-events-none z-[400] overflow-hidden opacity-30">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200%] h-[200%] bg-[conic-gradient(from_0deg,transparent_0deg,var(--primary)_360deg)] animate-[spin_4s_linear_infinite]" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_40%,#0b0e14_100%)]" />
            </div>
          )}

          {/* Telemetry Log Overlay */}
          <div className="absolute top-4 left-4 z-[1000] w-64 pointer-events-none hidden md:block">
            <div className="space-y-1.5">
              <AnimatePresence mode="popLayout">
                {telemetryLogs.map((log) => (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0, x: -20, filter: 'blur(10px)' }}
                    animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
                    exit={{ opacity: 0, transition: { duration: 0.2 } }}
                    className={cn(
                      "text-[9px] font-mono px-2 py-1 rounded bg-black/60 border-l-2 backdrop-blur-sm shadow-xl",
                      log.type === 'success' ? "border-primary text-primary" : 
                      log.type === 'warn' ? "border-amber-500 text-amber-500" : "border-white/20 text-white/60"
                    )}
                  >
                    <span className="opacity-40 mr-1">[{new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}]</span>
                    {log.msg}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>

          {/* Simulated Moving Aircraft */}
          {isSimulating && localFlights.map((flight, idx) => (
            <AircraftMarker 
              key={`sim-plane-${flight.flightNo}-${idx}`}
              flight={flight}
              simTime={simTime}
              isSelected={selectedFlight?.flightNo === flight.flightNo}
              onSelect={setSelectedFlight}
            />
          ))}

          {activeAirports.map(airport => (
            <React.Fragment key={`frag-airport-${airport.code}`}>
              <Marker 
                position={[airport.lat, airport.lng]}
                icon={L.divIcon({
                  className: 'custom-div-icon',
                  html: `
                    <div class="relative">
                      <div class="w-3 h-3 rounded-full ${airport.isDomestic ? 'bg-primary' : 'bg-secondary'} ring-4 ring-black/50 shadow-[0_0_10px_currentColor]"></div>
                      <div class="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] font-black uppercase text-white/40 tracking-tighter whitespace-nowrap">
                        ${airport.code}
                      </div>
                    </div>
                  `,
                  iconSize: [12, 12],
                  iconAnchor: [6, 6]
                })}
              >
                <Popup className="custom-popup">
                  <div className="p-2">
                    <div className="font-bold text-lg">{airport.name}</div>
                    <div className="text-xs text-muted-foreground">{airport.code} Airport</div>
                  </div>
                </Popup>
              </Marker>
            </React.Fragment>
          ))}

          {localFlights
            .filter(flight => showAllPaths || selectedFlight?.flightNo === flight.flightNo)
            .map((flight, idx) => {
              const from = AIRPORTS[flight.from];
              const to = AIRPORTS[flight.to];
              if (!from || !to) return null;

              const isSelected = selectedFlight?.flightNo === flight.flightNo;

              return (
                <React.Fragment key={`frag-line-${flight.flightNo}-${idx}`}>
                  <Polyline
                    positions={[
                      [from.lat, from.lng],
                      [to.lat, to.lng]
                    ]}
                    className={isSelected ? "polyline-tracking" : ""}
                    color={isSelected ? 'var(--primary)' : 'rgba(148, 163, 184, 0.3)'}
                    weight={isSelected ? 4 : 2}
                    opacity={isSelected ? 1 : 0.6}
                    dashArray={isSelected ? "12, 20" : "5, 10"}
                    eventHandlers={{
                      click: () => setSelectedFlight(flight)
                    }}
                  >
                    <Popup>
                      <div className="p-1">
                        <div className="font-bold text-primary">{flight.flightNo}</div>
                        <div className="text-xs">
                          {flight.from} → {flight.to}
                        </div>
                      </div>
                    </Popup>
                  </Polyline>
                </React.Fragment>
              );
            })}
        </MapContainer>

        {/* Simulation Controls Overlay */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[1000] w-[90%] max-w-md space-y-3">
          <AnimatePresence>
            {selectedFlight && (
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="glass-card bg-primary/10 backdrop-blur-xl border border-primary/30 rounded-2xl p-4 shadow-[0_0_30px_rgba(0,243,255,0.15)] relative overflow-hidden group"
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent animate-[shimmer_2s_infinite]" />
                
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Track Focus: {selectedFlight.flightNo}</span>
                  </div>
                  <div className="text-[9px] font-black uppercase text-white/40 tracking-wider">
                    {selectedFlight.from} &rarr; {selectedFlight.to}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-end">
                    <div className="space-y-0.5">
                      <div className="text-[8px] font-bold text-white/40 uppercase">Departure</div>
                      <div className="text-xs font-black text-white">{selectedFlight.std}</div>
                    </div>
                    
                    {/* Progress Percentage */}
                    <div className="text-center pb-1">
                      {(() => {
                        const start = timeToMinutes(selectedFlight.std);
                        const end = timeToMinutes(selectedFlight.eta);
                        const current = Math.max(start, Math.min(end, simTime));
                        const pct = Math.round(((current - start) / (end - start)) * 100);
                        return (
                          <div className="flex flex-col items-center">
                            <span className="text-[9px] font-black text-primary">{pct}%</span>
                            <div className="w-12 h-0.5 bg-white/10 mt-0.5 relative overflow-hidden">
                              <div className="absolute inset-0 bg-primary transition-all duration-300" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    <div className="space-y-0.5 text-right">
                      <div className="text-[8px] font-bold text-white/40 uppercase">Arrival</div>
                      <div className="text-xs font-black text-white">{selectedFlight.eta}</div>
                    </div>
                  </div>

                  <Slider
                    value={[simTime]}
                    min={timeToMinutes(selectedFlight.std)}
                    max={timeToMinutes(selectedFlight.eta)}
                    step={1}
                    onValueChange={([val]) => {
                      setIsLiveMode(false);
                      setSimTime(val);
                    }}
                    className="py-1 [&_[role=slider]]:bg-primary [&_[role=slider]]:border-primary [&_.relative]:h-1.5"
                    disabled={isLiveMode}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="glass-card bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <div className={cn(
                  "p-2 rounded-lg transition-colors duration-500",
                  isFetching ? "bg-primary/40 text-primary" : "bg-primary/20 text-primary"
                )}>
                  {isFetching ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Clock size={16} className={cn(isSimulating && "animate-pulse")} />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <div className="text-[10px] font-black uppercase tracking-widest text-white/50">
                      {isLiveMode ? "System Time" : "Sim Time"}
                    </div>
                    {isLiveMode && <Badge variant="outline" className="h-4 text-[7px] font-black bg-rose-500/20 text-rose-500 border-rose-500/30 animate-pulse px-1">LIVE</Badge>}
                  </div>
                  <div className="text-sm font-black text-white font-mono flex items-center gap-1.5">
                    {minutesToTime(simTime)}
                    {isFetching && <span className="text-[8px] text-primary animate-bounce">SYNCING</span>}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button 
                  size="sm" 
                  variant="ghost" 
                  className={cn(
                    "h-8 px-2 text-[10px] font-black border border-white/5",
                    isLiveMode ? "bg-rose-500/20 text-rose-500 border-rose-500/40" : "text-white/60 hover:bg-white/5"
                  )}
                  onClick={() => setIsLiveMode(!isLiveMode)}
                >
                  LIVE
                </Button>
                
                <div className="h-6 w-px bg-white/10 mx-1" />

                <div className="flex items-center gap-1">
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    className="h-8 w-8 text-white/70 hover:text-white"
                    onClick={() => {
                      setIsLiveMode(false);
                      setSimTime(startTime);
                    }}
                    disabled={isLiveMode}
                  >
                    <SkipBack size={16} />
                  </Button>
                  <Button 
                    size="icon" 
                    className={cn(
                      "h-10 w-10 rounded-full transition-all duration-500",
                      isSimulating ? "bg-primary text-primary-foreground glow-cyan" : "bg-white/10 text-white hover:bg-white/20"
                    )}
                    onClick={() => setIsSimulating(!isSimulating)}
                    disabled={isLiveMode}
                  >
                    {isSimulating ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-1" />}
                  </Button>
                </div>
                
                {!isLiveMode && (
                  <div className="flex flex-col items-center">
                    <div className="text-[8px] font-black uppercase text-white/40 mb-1">Speed</div>
                    <div className="flex items-center gap-1">
                      {[1, 10, 60].map(s => (
                        <Button 
                          key={`speed-${s}`}
                          size="sm" 
                          variant="ghost" 
                          className={cn("h-6 px-1.5 text-[10px] font-black", simSpeed === s && "text-primary bg-primary/10")}
                          onClick={() => setSimSpeed(s)}
                        >{s}x</Button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between gap-4">
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-7 text-[8px] font-black tracking-widest border border-white/5",
                  showAllPaths ? "bg-primary/20 text-primary" : "text-white/40"
                )}
                onClick={() => setShowAllPaths(!showAllPaths)}
              >
                {showAllPaths ? "HIDE ALL PATHS" : "SHOW ALL PATHS"}
              </Button>
              <Slider 
                value={[simTime]} 
                min={startTime} 
                max={endTime} 
                step={1} 
                onValueChange={([val]) => {
                  setIsLiveMode(false);
                  setSimTime(val);
                }}
                className="flex-1"
                disabled={isLiveMode}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="lg:col-span-1 space-y-4 overflow-y-auto pr-2 custom-scrollbar">
        <h3 className="text-sm font-black uppercase tracking-widest text-foreground/60 px-2 py-1 border-b border-border mb-4 flex items-center justify-between">
          Live Traffic Matrix
          {isFetching && <RefreshCw className="w-3 h-3 text-primary animate-spin" />}
        </h3>
        
        {localFlights.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center glass-card rounded-xl border border-dashed border-border text-foreground">
            <div className="text-muted-foreground text-xs uppercase font-bold tracking-widest">No Traffic Data</div>
          </div>
        ) : (
          localFlights.map((flight, idx) => {
            const isSelected = selectedFlight?.flightNo === flight.flightNo;
            return (
              <motion.div
                key={`motion-card-${flight.flightNo}-${idx}`}
                whileHover={{ scale: 1.02, translateY: -2 }}
                whileTap={{ scale: 0.98 }}
                className="w-full"
              >
                <Card 
                  key={`${flight.flightNo}-${idx}`}
                  className={cn(
                    "cursor-pointer transition-all border-border/50 overflow-hidden group relative",
                    isSelected ? 'ring-2 ring-primary border-primary bg-primary/5 shadow-[0_0_15px_rgba(0,243,255,0.1)]' : 'glass-card hover:border-primary/30',
                  )}
                  onClick={() => setSelectedFlight(flight)}
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="p-4 space-y-3 relative z-10">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="font-black tracking-tighter bg-primary/10 text-primary border-primary/20 group-hover:shadow-[0_0_8px_var(--neon-cyan)] transition-shadow">
                        {flight.flightNo}
                      </Badge>
                      <span className="text-[10px] font-bold text-muted-foreground uppercase">{flight.aircraft}</span>
                    </div>
                    
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-center">
                        <div className="text-lg font-black">{flight.from}</div>
                        <div className="text-[9px] uppercase text-muted-foreground font-bold">{flight.std}</div>
                      </div>
                      <div className="flex-1 border-b border-dashed border-border relative">
                        <Plane className={cn(
                          "w-3 h-3 absolute top-1/2 left-1/2 -translate-y-1/2 -translate-x-1/2 transition-colors",
                          isSelected ? 'text-primary' : 'text-muted-foreground/30 group-hover:text-primary/50'
                        )} />
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-black">{flight.to}</div>
                        <div className="text-[9px] uppercase text-muted-foreground font-bold">{flight.eta}</div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-border/20">
                      <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-secondary"></div>
                        <span className="text-[10px] font-black">{flight.reg}</span>
                      </div>
                      <div className="text-[10px] font-black text-rose-500 uppercase">
                        PAX: {flight.pax}
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            );
          })
        )}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .leaflet-container {
          font-family: inherit;
        }
        .custom-popup .leaflet-popup-content-wrapper {
          background: #0b0e14;
          color: white;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
        }
        .custom-popup .leaflet-popup-tip {
          background: #0b0e14;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .leaflet-bar a {
          background-color: #0b0e14 !important;
          color: white !important;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1) !important;
        }
        .leaflet-bar a:hover {
          background-color: #1a1f29 !important;
        }
        .custom-plane-icon {
          background: transparent !important;
          border: none !important;
        }
        .polyline-tracking {
          animation: dash-tracking 2s linear infinite;
          filter: drop-shadow(0 0 5px var(--primary));
        }
        @keyframes dash-tracking {
          from {
            stroke-dashoffset: 64;
          }
          to {
            stroke-dashoffset: 0;
          }
        }
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      ` }} />
    </div>
  );
};

const Plane = ({ className }: { className?: string }) => (
  <svg 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3.5c-.5-.5-2.5 0-4 1.5L13.5 8.5 5.3 6.7c-1.1-.3-2.3.2-2.9 1.2-.5 1 0 2.2 1.1 2.5l7 2.4-3.5 3.5-3.7-.8c-.6-.1-1.2.1-1.6.6l-.8.8c-.3.3-.3.8 0 1.1l2.4 2.4c.3.3.8.3 1.1 0l.8-.8c.5-.4.7-1 .6-1.6l-.8-3.7 3.5-3.5 2.4 7c.3 1.1 1.5 1.6 2.5 1.1 1-.5 1.5-1.7 1.2-2.8z" />
  </svg>
);

export default FlightMap;
