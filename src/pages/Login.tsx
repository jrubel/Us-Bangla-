import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Lock, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

interface LoginProps {
  onLogin: () => void;
}

const Login = ({ onLogin }: LoginProps) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [attempts, setAttempts] = useState(0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    // Get password from env or default to admin123
    const envPassword = import.meta.env.VITE_APP_PASSWORD;
    const enteredPassword = password.trim();
    
    // We allow either the environment password OR the default admin123 as a safety fallback
    const isCorrect = 
      (enteredPassword === 'admin123') || 
      (envPassword && enteredPassword === envPassword.trim());
    
    setTimeout(() => {
      if (isCorrect) {
        localStorage.setItem('auth_session', 'true');
        onLogin();
        toast.success('Access granted');
      } else {
        setError(true);
        setAttempts(prev => prev + 1);
        toast.error('Invalid password');
      }
      setIsLoading(false);
    }, 600);
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-background">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <Card className="border-border/50 bg-card/50 backdrop-blur-xl shadow-2xl">
          <CardHeader className="space-y-1 items-center pb-8 text-center">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
              <Lock className="w-6 h-6 text-primary" />
            </div>
            <CardTitle className="text-2xl font-black tracking-tightest uppercase">Restricted Access</CardTitle>
            <CardDescription className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Please enter the password to continue
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                  Password
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setError(false);
                    }}
                    className={`h-12 bg-background/50 border-border text-center font-bold tracking-widest transition-all duration-300 pr-10 ${
                      error ? 'border-destructive ring-destructive/20' : 'focus:ring-primary/20'
                    }`}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex flex-col gap-2"
                  >
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-[10px] font-black uppercase tracking-wider">
                      <AlertCircle className="w-4 h-4" />
                      Incorrect password. Access denied.
                    </div>
                    {attempts >= 3 && (
                      <div className="p-3 rounded-lg bg-primary/10 text-primary text-[9px] font-bold uppercase tracking-widest text-center animate-pulse">
                        Hint: Try "admin123"
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              <Button 
                type="submit" 
                className="w-full h-12 font-black uppercase tracking-widest text-xs"
                disabled={isLoading || !password}
              >
                {isLoading ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                    className="w-4 h-4 border-2 border-background/20 border-t-background rounded-full"
                  />
                ) : (
                  'Unlock Access'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
        
        <p className="mt-8 text-center text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-50">
          Us Bangla Morning Load Project
        </p>
      </motion.div>
    </div>
  );
};

export default Login;
