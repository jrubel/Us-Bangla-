import { FlightRow } from '@/lib/parseFlightData';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend, CartesianGrid } from 'recharts';

const COLORS = [
  '#00f3ff', '#ff00f7', '#39ff14', '#0066ff', '#facc15', '#f87171', '#a78bfa', '#2dd4bf', '#fb923c', '#e879f9'
];

interface Props {
  data: FlightRow[];
}

const timeToMinutes = (timeStr: string) => {
  if (!timeStr) return 0;
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + (minutes || 0);
};

const minutesToTime = (minutes: number) => {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

const FlightCharts = ({ data }: Props) => {
  if (data.length === 0) return (
    <div className="flex flex-col items-center justify-center py-32 text-slate-600">
      <BarChart3 className="w-12 h-12 mb-4 opacity-10" />
      <p className="text-xs uppercase font-black tracking-widest opacity-20">No telemetry data available for analysis</p>
    </div>
  );

  // Sector-wise
  const sectorMap = new Map<string, { count: number; totalPax: number }>();
  for (const r of data) {
    const sector = `${r.from}-${r.to}`;
    const existing = sectorMap.get(sector) || { count: 0, totalPax: 0 };
    existing.count++;
    existing.totalPax += r.pax;
    sectorMap.set(sector, existing);
  }
  const sectorData = Array.from(sectorMap.entries())
    .map(([sector, v]) => ({ sector, flights: v.count, pax: v.totalPax }))
    .sort((a, b) => b.flights - a.flights)
    .slice(0, 10); 

  // Aircraft Type-wise
  const typeMap = new Map<string, number>();
  for (const r of data) {
    const type = r.aircraft || 'Unknown';
    typeMap.set(type, (typeMap.get(type) || 0) + 1);
  }
  const typeData = Array.from(typeMap.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  // Timeline Data
  const timelineData = data.map(r => {
    const start = timeToMinutes(r.std);
    let end = timeToMinutes(r.eta);
    if (end < start) end += 1440;
    
    return {
      reg: r.reg || 'UNKNOWN',
      flightNo: r.flightNo,
      start,
      duration: end - start,
      displayStd: r.std,
      displayEta: r.eta,
      route: `${r.from}-${r.to}`
    };
  }).sort((a, b) => a.start - b.start);

  return (
    <div className="space-y-12">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* Sector Distribution */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-black text-foreground uppercase tracking-[0.3em] flex items-center gap-2">
                <span className="w-2.5 h-2.5 bg-primary rounded-full shadow-[0_0_8px_black] dark:shadow-[0_0_10px_var(--neon-cyan)]" />
                Sector Volume Matrix
              </h3>
              <p className="text-[10px] text-foreground/40 font-black mt-1 uppercase tracking-widest">Operational flight frequency per route</p>
            </div>
          </div>
          <div className="glass-card p-6 rounded-2xl border border-border h-[380px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sectorData} layout="vertical" margin={{ left: 20, right: 30 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="currentColor" opacity={0.1} />
                <XAxis type="number" hide />
                <YAxis dataKey="sector" type="category" tick={{ fontSize: 10, fontWeight: 900, fill: 'currentColor', opacity: 0.6 }} axisLine={false} tickLine={false} width={80} />
                <Tooltip 
                  cursor={{ fill: 'currentColor', opacity: 0.05 }}
                  contentStyle={{ backgroundColor: 'var(--card)', borderRadius: '12px', border: '1px solid var(--border)', color: 'var(--foreground)' }}
                />
                <Bar dataKey="flights" fill="var(--primary)" radius={[0, 4, 4, 0]} barSize={16}>
                   {sectorData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} opacity={0.6} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Aircraft Type Distribution */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-black text-foreground uppercase tracking-[0.3em] flex items-center gap-2">
                <span className="w-2.5 h-2.5 bg-secondary rounded-full shadow-[0_0_8px_black] dark:shadow-[0_0_10px_var(--neon-magenta)]" />
                Fleet Deployment Schema
              </h3>
              <p className="text-[10px] text-foreground/40 font-black mt-1 uppercase tracking-widest">Aircraft platform utilization architecture</p>
            </div>
          </div>
          <div className="glass-card p-6 rounded-2xl border border-border h-[380px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={typeData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" opacity={0.1} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: 900, fill: 'currentColor', opacity: 0.6 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.6, fontWeight: 900 }} axisLine={false} tickLine={false} />
                <Tooltip 
                  cursor={{ fill: 'currentColor', opacity: 0.05 }}
                  contentStyle={{ backgroundColor: 'var(--card)', borderRadius: '12px', border: '1px solid var(--border)', color: 'var(--foreground)' }}
                  formatter={(v: number) => [v, 'Sorties']} 
                />
                <Bar dataKey="value" fill="var(--secondary)" radius={[4, 4, 0, 0]} barSize={24}>
                  {typeData.map((_, i) => (
                    <Cell key={i} fill={COLORS[(i + 2) % COLORS.length]} opacity={0.6} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Flight Schedule Timeline */}
      <div className="space-y-6 pb-8">
        <div>
          <h3 className="text-xs font-black text-foreground uppercase tracking-[0.3em] flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-primary rounded-full shadow-[0_0_8px_black] dark:shadow-[0_0_10px_var(--neon-cyan)]" />
            Tactical Asset Timeline
          </h3>
          <p className="text-[10px] text-foreground/40 font-black mt-1 uppercase tracking-widest">24-hour synchronized aircraft rotation lifecycle</p>
        </div>
        <div className="glass-card p-6 rounded-2xl border border-border overflow-x-auto">
          <div className="min-w-[900px]">
            <ResponsiveContainer width="100%" height={Math.max(400, timelineData.length * 50)}>
              <BarChart 
                data={timelineData} 
                layout="vertical" 
                margin={{ left: 60, right: 40, top: 20, bottom: 20 }}
                barGap={0}
              >
                <XAxis 
                  type="number" 
                  domain={[0, 1440]} 
                  ticks={[0, 180, 360, 540, 720, 900, 1080, 1260, 1440]}
                  tickFormatter={minutesToTime}
                  tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.6, fontWeight: 900 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis 
                  type="category" 
                  dataKey="reg" 
                  tick={{ fontSize: 11, fontWeight: 900, fill: 'currentColor', opacity: 0.8 }} 
                  width={80}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip 
                  cursor={{ fill: 'currentColor', opacity: 0.05 }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload;
                      return (
                        <div className="glass-card bg-card/95 text-foreground p-4 rounded-xl border border-border shadow-2xl text-[10px] space-y-3 min-w-[200px]">
                          <div className="flex justify-between items-center border-b border-border pb-2">
                            <span className="font-black text-xs text-primary">{d.flightNo}</span>
                            <span className="px-2 py-0.5 bg-foreground/5 rounded text-foreground/60 font-bold tracking-widest">{d.reg}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-y-2">
                            <span className="text-foreground/40 font-black uppercase">Sector</span>
                            <span className="text-right font-black text-foreground">{d.route}</span>
                            <span className="text-foreground/40 font-black uppercase">Window</span>
                            <span className="text-right font-mono text-primary font-bold">{d.displayStd} - {d.displayEta}</span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="start" stackId="a" fill="transparent" />
                <Bar dataKey="duration" stackId="a" radius={[12, 12, 12, 12]} barSize={20}>
                  {timelineData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} opacity={0.6} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FlightCharts;

