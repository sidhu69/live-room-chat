import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Login from "./pages/Auth/Login";
import Register from "./pages/Auth/Register";
import YourName from "./pages/Auth/YourName";
import PfpUpload from "./pages/Auth/PfpUpload";
import RoomChat from "./pages/RoomChat";

const queryClient = new QueryClient();

const AppContent = () => {
  const { user, loading } = useAuth();

  console.log('[App] Loading:', loading, 'User:', user?.id);

  if (loading) {
    console.log('[App] Showing loading spinner');
    return (
      <div className="min-h-screen bg-gradient-to-br from-room-primary/20 via-background to-room-primary-glow/20 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-room-primary/30 border-t-room-primary rounded-full animate-spin" />
      </div>
    );
  }

  // If no user is authenticated, show auth pages
  if (!user) {
    console.log('[App] No user - showing auth pages');
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }

  // User is authenticated, show main app with onboarding routes
  console.log('[App] User authenticated - showing main app');
  return (
    <Routes>
      <Route path="/your-name" element={<YourName />} />
      <Route path="/pfp-upload" element={<PfpUpload />} />
      <Route path="/" element={<Index />} />
      <Route path="/rooms" element={<Index />} />
      <Route path="/rooms/:roomId" element={<RoomChat />} />
      <Route path="/ranking" element={<Index />} />
      <Route path="/dm" element={<Index />} />
      <Route path="/profile" element={<Index />} />
      <Route path="/settings" element={<Index />} />
      {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
