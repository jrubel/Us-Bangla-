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
    <div className="space-y-6 glass-card rounded-2xl border border-border p-6 group">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-black text-foreground uppercase tracking-[0.3em] flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-primary rounded-full shadow-[0_0_8px_black] dark:shadow-[0_0_10px_var(--neon-cyan)]" />
            Sector Duration Config
          </h3>
          <p className="text-xs text-foreground/40 font-black mt-1 uppercase tracking-widest leading-relaxed">Customize block time telemetry. Persistent configuration overrides.</p>
        </div>
      </div>
      
      <div className="max-h-[500px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
        {allKeys.map(key => {
          const isOverridden = key in overrides;
          const defaultVal = defaults[key];
          return (
            <div key={key} className="flex items-center gap-4 py-2.5 px-3 bg-foreground/5 rounded-xl border border-border hover:bg-foreground/10 transition-all group/item">
              <span className="text-xs font-black text-foreground/50 group-hover/item:text-primary transition-colors min-w-[80px] tracking-widest">{key}</span>
              <div className="flex items-center gap-2 flex-1">
                <Input
                  value={editValues[key] ?? ''}
                  onChange={e => setEditValues(prev => ({ ...prev, [key]: e.target.value }))}
                  className="w-20 h-9 text-xs font-black bg-background/5 border-border text-foreground text-center focus:border-primary font-mono"
                />
                <span className="text-xs font-black text-foreground/40 uppercase tracking-tighter w-10">MIN</span>
              </div>
              <div className="flex items-center gap-2">
                <Button onClick={() => handleSave(key)} size="sm" variant="ghost" className="h-9 w-9 p-0 text-foreground/40 hover:text-primary hover:bg-primary/10">
                  <Save className="w-4 h-4" />
                </Button>
                {isOverridden && defaultVal !== undefined && (
                  <Button onClick={() => handleReset(key)} size="sm" variant="ghost" className="h-9 w-9 p-0 text-foreground/40 hover:text-rose-500 hover:bg-rose-500/10">
                    <RotateCcw className="w-4 h-4" />
                  </Button>
                )}
              </div>
              <div className="w-20 text-center">
                {isOverridden && <span className="text-[10px] font-black text-primary uppercase tracking-widest">Override</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SectorDurationManager;
