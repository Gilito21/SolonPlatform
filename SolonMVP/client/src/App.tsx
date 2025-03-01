import { Switch, Route } from "wouter";
import { queryClient } from "@/lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { Navigation } from "@/components/nav";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Market from "@/pages/market";
import Portfolio from "@/pages/portfolio";
import Waitlist from "@/pages/waitlist"; // Added import for Waitlist page

function Router() {
  return (
    <Switch>
      <Route path="/" component={Waitlist} />
      <Route path="/home" component={Home} />
      <Route path="/market" component={Market} />
      <Route path="/market/:symbol" component={Market} />
      <Route path="/portfolio" component={Portfolio} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-background">
        <Navigation />
        <main>
          <Router />
        </main>
      </div>
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;