import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import logo from './Solon_White_logo.png';

export default function Waitlist() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !email.includes('@')) {
      toast({
        title: "Invalid email",
        description: "Please enter a valid email address",
        variant: "destructive",
      });
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });
      
      if (response.ok) {
        toast({
          title: "Success!",
          description: "You've been added to our waitlist. We'll notify you when we launch!",
        });
        setEmail("");
      } else {
        const data = await response.json();
        throw new Error(data.message || "Something went wrong");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to join waitlist",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <div className="container mx-auto p-4 flex flex-col items-center justify-center min-h-[80vh]">
      <div className="max-w-3xl text-center mb-8">
        <h1 className="text-4xl font-bold mb-4 flex items-center justify-center space-x-4">
          <span>Welcome to</span>
          <img src={logo} alt="Solon Logo" className="h-10" />
        </h1>
        <p className="text-xl mb-6">
          The first platform that transforms shares from startups backed by prestigious Venture Capitals into tradable tokens.
        </p>
        <div className="bg-muted p-6 rounded-lg text-left mb-8">
          <h2 className="text-2xl font-semibold mb-3">How It Works</h2>
          <ol className="space-y-3 list-decimal pl-5">
            <li><span className="font-medium">Tokenization:</span> We tokenize shares from emerging startups that well-known venture capitals have invested in.</li>
            <li><span className="font-medium">Trading Platform:</span> Our platform allows you to buy and sell these tokens, creating a liquid market for typically illiquid assets.</li>
            <li><span className="font-medium">Portfolio Management:</span> Track your investments and manage your portfolio of startup tokens all in one place.</li>
            <li><span className="font-medium">Early Access:</span> Join the waitlist now to be among the first to access this revolutionary platform.</li>
          </ol>
        </div>
      </div>
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Join our Waitlist</CardTitle>
          <CardDescription>
            Be the first to know when our token trading platform launches
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Input 
                type="email" 
                placeholder="Enter your email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <Button 
              type="submit" 
              className="w-full"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Submitting..." : "Join Waitlist"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
