import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Fingerprint, Lock, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/components/ui/use-toast";

const FingerprintLogin = () => {
  const [isScanning, setIsScanning] = useState(false);
  const [showFallback, setShowFallback] = useState(false);
  
  const { loginWithBiometric, checkBiometric } = useAuth();

  useEffect(() => {
    // Auto-trigger fingerprint scan when component loads
    handleFingerprintScan();
  }, []);

  const handleFingerprintScan = async () => {
    setIsScanning(true);
    
    try {
      const isAvailable = await checkBiometric();
      if (!isAvailable) {
        setShowFallback(true);
        return;
      }

      // Simulate fingerprint scanning delay for better UX
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      await loginWithBiometric();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Fingerprint authentication failed",
        description: "Please try again or use password login"
      });
      setShowFallback(true);
    } finally {
      setIsScanning(false);
    }
  };

  const handleFallbackLogin = () => {
    window.location.href = '/login';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-accent via-secondary to-primary flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md"
      >
        <div className="bg-card/90 backdrop-blur-lg rounded-3xl p-8 shadow-2xl border border-border/50 text-center">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="mb-8"
          >
            <h1 className="text-3xl font-bold text-foreground mb-2">Welcome back!</h1>
            <p className="text-muted-foreground">
              {isScanning ? "Scanning fingerprint..." : "Use your fingerprint to sign in"}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4, duration: 0.8 }}
            className="flex justify-center mb-8"
          >
            <div className="relative">
              <motion.div
                animate={isScanning ? {
                  scale: [1, 1.2, 1],
                  opacity: [0.7, 1, 0.7]
                } : {}}
                transition={{
                  duration: 1.5,
                  repeat: isScanning ? Infinity : 0,
                  ease: "easeInOut"
                }}
                className="w-32 h-32 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center"
              >
                <Fingerprint className="w-16 h-16 text-white" />
              </motion.div>
              
              {isScanning && (
                <motion.div
                  animate={{
                    scale: [1, 2, 1],
                    opacity: [0.3, 0, 0.3]
                  }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                  className="absolute inset-0 rounded-full border-4 border-primary"
                />
              )}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.6 }}
            className="space-y-4"
          >
            {!showFallback ? (
              <>
                <Button
                  onClick={handleFingerprintScan}
                  disabled={isScanning}
                  className="w-full bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 text-primary-foreground font-medium py-6 rounded-xl transition-all duration-300 transform hover:scale-[1.02]"
                >
                  {isScanning ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      className="w-5 h-5 border-2 border-white border-t-transparent rounded-full mr-2"
                    />
                  ) : (
                    <Fingerprint className="w-5 h-5 mr-2" />
                  )}
                  {isScanning ? "Scanning..." : "Touch Sensor"}
                </Button>

                <Button
                  onClick={() => setShowFallback(true)}
                  variant="ghost"
                  className="w-full text-muted-foreground hover:text-foreground"
                >
                  Use password instead
                </Button>
              </>
            ) : (
              <div className="space-y-4">
                <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-xl">
                  <p className="text-sm text-destructive">
                    Fingerprint authentication is not available or failed.
                  </p>
                </div>
                
                <Button
                  onClick={handleFallbackLogin}
                  className="w-full bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 text-primary-foreground font-medium py-6 rounded-xl transition-all duration-300 transform hover:scale-[1.02] group"
                >
                  <Lock className="w-5 h-5 mr-2" />
                  Sign in with password
                  <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>

                <Button
                  onClick={handleFingerprintScan}
                  variant="outline"
                  className="w-full border-border/50 bg-background/50 hover:bg-accent/50 py-6 rounded-xl"
                >
                  <Fingerprint className="w-5 h-5 mr-2" />
                  Try fingerprint again
                </Button>
              </div>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8, duration: 0.6 }}
            className="mt-8"
          >
            <p className="text-xs text-muted-foreground">
              Your biometric data is stored securely on your device and never shared
            </p>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
};

export default FingerprintLogin;