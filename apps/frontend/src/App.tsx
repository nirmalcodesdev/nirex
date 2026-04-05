import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import NotFound from "./pages/NotFound.tsx";
import LandingPage from "./pages/Landingpage.tsx";
import { TooltipProvider } from "@nirex/ui/tooltip";
import { SonnerToaster } from "@nirex/ui";
import { Toaster } from "@nirex/ui/toaster";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <SonnerToaster />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
