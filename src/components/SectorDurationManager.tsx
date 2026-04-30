import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  getAllSectors, 
  getSectorName, 
  getSectorOverrides, 
  getNameOverrides,
  STORAGE_KEY,
  NAME_STORAGE_KEY
} from '@/lib/sectorDuration';
import { toast } from 'sonner';
import { Save, RotateCcw, Download } from 'lucide-react';

interface Props {
  onUpdate?: () => void;
}

const SectorDurationManager = ({ onUpdate }: Props) => {
  const defaults = useMemo(() => getAllSectors(), []);
  const [overrides, setOverrides] = useState<Record<string, number>>(() => getSectorOverrides());
  const [nameOverrides, setNameOverrides] = useState<Record<string, string>>(() => getNameOverrides());
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [editNames, setEditNames] = useState<Record<string, string>>({});
  const [newSector, setNewSector] = useState({ from: 'DAC', to: '', duration: '', name: '' });

  const allKeys = useMemo(() => Object.keys(overrides).sort(), [overrides]);

  useEffect(() => {
    const initEditValues: Record<string, string> = {};
    const initEditNames: Record<string, string> = {};
    for (const key of allKeys) {
      initEditValues[key] = String(overrides[key] ?? defaults[key] ?? '');
      const [from, to] = key.split('-');
      initEditNames[key] = nameOverrides[key] ?? getSectorName(from, to);
    }
    setEditValues(initEditValues);
    setEditNames(initEditNames);
  }, [allKeys, overrides, nameOverrides, defaults]);

  const handleSave = (key: string) => {
    const val = parseInt(editValues[key], 10);
    const name = editNames[key];

    if (isNaN(val) || val <= 0) { toast.error('Enter a valid duration in minutes'); return; }
    
    const updatedOverrides = { ...overrides, [key]: val };
    const updatedNames = { ...nameOverrides, [key]: name };

    setOverrides(updatedOverrides);
    setNameOverrides(updatedNames);

    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedOverrides));
    localStorage.setItem(NAME_STORAGE_KEY, JSON.stringify(updatedNames));

    toast.success(`${key} updated`);
    if (onUpdate) onUpdate();
  };

  const handleReset = (key: string) => {
    const updatedOverrides = { ...overrides };
    delete updatedOverrides[key];
    const updatedNames = { ...nameOverrides };
    delete updatedNames[key];

    setOverrides(updatedOverrides);
    setNameOverrides(updatedNames);

    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedOverrides));
    localStorage.setItem(NAME_STORAGE_KEY, JSON.stringify(updatedNames));

    const [from, to] = key.split('-');
    setEditValues(prev => ({ ...prev, [key]: String(defaults[key] ?? '') }));
    setEditNames(prev => ({ ...prev, [key]: getSectorName(from, to) }));

    toast.success(`${key} reset to default`);
    if (onUpdate) onUpdate();
  };

  const handleAddSector = () => {
    const { from, to, duration, name } = newSector;
    const cleanFrom = from.trim().toUpperCase();
    const cleanTo = to.trim().toUpperCase();
    if (!cleanFrom || !cleanTo) { toast.error('Enter both airport codes'); return; }
    
    const key = `${cleanFrom}-${cleanTo}`;
    const val = parseInt(duration, 10);

    if (isNaN(val) || val <= 0) { toast.error('Enter a valid duration'); return; }

    const updatedOverrides = { ...overrides, [key]: val };
    const updatedNames = { ...nameOverrides, [key]: name || getSectorName(cleanFrom, cleanTo) };

    setOverrides(updatedOverrides);
    setNameOverrides(updatedNames);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedOverrides));
    localStorage.setItem(NAME_STORAGE_KEY, JSON.stringify(updatedNames));

    setNewSector({ from: 'DAC', to: '', duration: '', name: '' });
    toast.success(`New sector ${key} added`);
    if (onUpdate) onUpdate();
  };

  const handleFetchMaster = () => {
    const masterSectors = getAllSectors();
    const updatedOverrides = { ...overrides };
    
    Object.keys(masterSectors).forEach(key => {
      if (!(key in updatedOverrides)) {
        updatedOverrides[key] = masterSectors[key];
      }
    });

    setOverrides(updatedOverrides);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedOverrides));
    
    toast.success('Master sector data imported');
    if (onUpdate) onUpdate();
  };

  return (
    <div className="space-y-6 glass-card rounded-2xl border border-border p-6 group">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-black text-foreground uppercase tracking-[0.3em] flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-primary rounded-full shadow-[0_0_8px_black] dark:shadow-[0_0_10px_var(--neon-cyan)]" />
            Sector Config
          </h3>
          <p className="text-xs text-foreground/40 font-black mt-1 uppercase tracking-widest leading-relaxed">Customize block time telemetry and sector labels.</p>
        </div>
        <Button 
          onClick={handleFetchMaster} 
          variant="outline" 
          size="sm" 
          className="h-8 text-[10px] font-black uppercase border-primary/30 text-primary hover:bg-primary/5 gap-2"
        >
          <Download className="w-3 h-3" /> Fetch Master
        </Button>
      </div>

      <div className="p-3 bg-primary/5 rounded-xl border border-primary/20 space-y-3">
        <h4 className="text-[10px] font-black uppercase tracking-widest text-primary">Add New Sector</h4>
        <div className="grid grid-cols-4 gap-2">
          <Input 
            placeholder="FROM" 
            value={newSector.from} 
            onChange={e => setNewSector(p => ({ ...p, from: e.target.value }))}
            className="h-8 text-[10px] font-black text-center uppercase"
          />
          <Input 
            placeholder="TO" 
            value={newSector.to} 
            onChange={e => setNewSector(p => ({ ...p, to: e.target.value }))}
            className="h-8 text-[10px] font-black text-center uppercase"
          />
          <Input 
            placeholder="MIN" 
            value={newSector.duration} 
            onChange={e => setNewSector(p => ({ ...p, duration: e.target.value }))}
            className="h-8 text-[10px] font-black text-center"
          />
          <Button onClick={handleAddSector} size="sm" className="h-8 text-[10px] font-black uppercase">Add</Button>
        </div>
        <Input 
          placeholder="Sector Display Name (Optional)" 
          value={newSector.name} 
          onChange={e => setNewSector(p => ({ ...p, name: e.target.value }))}
          className="h-8 text-[10px] font-bold"
        />
      </div>
      
      <div className="max-h-[600px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
        {allKeys.map(key => {
          const isOverridden = key in overrides || key in nameOverrides;
          const defaultVal = defaults[key];
          return (
            <div key={key} className="flex flex-col gap-2 p-3 bg-foreground/5 rounded-xl border border-border hover:bg-foreground/10 transition-all group/item">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-foreground/50 group-hover/item:text-primary transition-colors tracking-[0.2em]">{key}</span>
                <div className="flex items-center gap-2">
                  <Button onClick={() => handleSave(key)} size="sm" variant="ghost" className="h-7 w-7 p-0 text-foreground/40 hover:text-primary hover:bg-primary/10">
                    <Save className="w-3.5 h-3.5" />
                  </Button>
                  {isOverridden && (
                    <Button onClick={() => handleReset(key)} size="sm" variant="ghost" className="h-7 w-7 p-0 text-foreground/40 hover:text-rose-500 hover:bg-rose-500/10">
                      <RotateCcw className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-12 gap-2 mt-1">
                <div className="col-span-8">
                  <Input
                    value={editNames[key] ?? ''}
                    onChange={e => setEditNames(prev => ({ ...prev, [key]: e.target.value }))}
                    className="h-8 text-[10px] font-bold bg-background/5 border-border text-foreground focus:border-primary uppercase tracking-wider"
                    placeholder="Sector Name"
                  />
                </div>
                <div className="col-span-4 flex items-center gap-1">
                  <Input
                    value={editValues[key] ?? ''}
                    onChange={e => setEditValues(prev => ({ ...prev, [key]: e.target.value }))}
                    className="h-8 text-xs font-black bg-background/5 border-border text-foreground text-center focus:border-primary font-mono"
                  />
                  <span className="text-[10px] font-black text-foreground/40 uppercase tracking-tighter">MIN</span>
                </div>
              </div>
              
              {isOverridden && (
                <div className="mt-1 text-right">
                  <span className="text-[8px] font-black text-primary uppercase tracking-widest pl-2 border-l border-primary/30">Manual Override</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SectorDurationManager;
