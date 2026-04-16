import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getAllSectors } from '@/lib/sectorDuration';
import { toast } from 'sonner';
import { Save, RotateCcw } from 'lucide-react';

const STORAGE_KEY = 'sectorDurationOverrides';

export function getSectorOverrides(): Record<string, number> {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch { return {}; }
}

export function getEffectiveDuration(from: string, to: string): number | null {
  const key = `${from.toUpperCase()}-${to.toUpperCase()}`;
  const overrides = getSectorOverrides();
  if (key in overrides) return overrides[key];
  const all = getAllSectors();
  return all[key] ?? null;
}

interface Props {
  onUpdate?: () => void;
}

const SectorDurationManager = ({ onUpdate }: Props) => {
  const defaults = useMemo(() => getAllSectors(), []);
  const [overrides, setOverrides] = useState<Record<string, number>>(getSectorOverrides);
  const [editValues, setEditValues] = useState<Record<string, string>>({});

  const allKeys = useMemo(() => [...new Set([...Object.keys(defaults), ...Object.keys(overrides)])].sort(), [defaults, overrides]);

  useEffect(() => {
    const init: Record<string, string> = {};
    for (const key of allKeys) {
      init[key] = String(overrides[key] ?? defaults[key] ?? '');
    }
    setEditValues(init);
  }, [allKeys, overrides, defaults]);

  const handleSave = (key: string) => {
    const val = parseInt(editValues[key], 10);
    if (isNaN(val) || val <= 0) { toast.error('Enter a valid duration in minutes'); return; }
    const updated = { ...overrides, [key]: val };
    setOverrides(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    toast.success(`${key} updated to ${val} min`);
    if (onUpdate) onUpdate();
  };

  const handleReset = (key: string) => {
    const updated = { ...overrides };
    delete updated[key];
    setOverrides(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setEditValues(prev => ({ ...prev, [key]: String(defaults[key] ?? '') }));
    toast.success(`${key} reset to default`);
    if (onUpdate) onUpdate();
  };

  return (
    <div className="space-y-6 glass-card rounded-2xl border border-white/5 p-6 group">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-[10px] font-black text-white uppercase tracking-[0.3em] flex items-center gap-2">
            <span className="w-2 h-2 bg-primary rounded-full glow-cyan" />
            Sector Duration Config
          </h3>
          <p className="text-[8px] text-slate-500 font-black mt-1 uppercase tracking-widest leading-relaxed">Customize block time telemetry. Persistent configuration overrides.</p>
        </div>
      </div>
      
      <div className="max-h-[500px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
        {allKeys.map(key => {
          const isOverridden = key in overrides;
          const defaultVal = defaults[key];
          return (
            <div key={key} className="flex items-center gap-4 py-2 px-3 bg-white/2 rounded-xl border border-white/5 hover:bg-white/5 transition-all group/item">
              <span className="text-[10px] font-black text-slate-400 group-hover/item:text-primary transition-colors min-w-[80px] tracking-widest">{key}</span>
              <div className="flex items-center gap-2 flex-1">
                <Input
                  value={editValues[key] ?? ''}
                  onChange={e => setEditValues(prev => ({ ...prev, [key]: e.target.value }))}
                  className="w-20 h-8 text-[10px] font-black bg-black/40 border-white/10 text-white text-center focus:border-primary glow-cyan"
                />
                <span className="text-[9px] font-black text-slate-600 uppercase tracking-tighter w-8">MIN</span>
              </div>
              <div className="flex items-center gap-1">
                <Button onClick={() => handleSave(key)} size="sm" variant="ghost" className="h-8 w-8 p-0 text-slate-500 hover:text-primary hover:bg-primary/10">
                  <Save className="w-3.5 h-3.5" />
                </Button>
                {isOverridden && defaultVal !== undefined && (
                  <Button onClick={() => handleReset(key)} size="sm" variant="ghost" className="h-8 w-8 p-0 text-slate-500 hover:text-rose-500 hover:bg-rose-500/10">
                    <RotateCcw className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
              <div className="w-12 text-center">
                {isOverridden && <span className="text-[8px] font-black text-primary uppercase tracking-widest glow-cyan">Override</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SectorDurationManager;
