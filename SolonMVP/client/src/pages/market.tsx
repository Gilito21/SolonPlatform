import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertOrderSchema } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { format } from "date-fns";
import { useState } from "react";

// Mock token data - in a real app, this would come from an API
const tokens = {
  NXP: {
    name: "Nexus Protocol | Andreessen Horowitz",
    symbol: "NXP",
    description: "A decentralized protocol for cross-chain communication and interoperability."
  },
  QTE: {
    name: "Quantum Edge | Sequoia Capital",
    symbol: "QTE",
    description: "Next-generation quantum-resistant blockchain infrastructure."
  },
  STL: {
    name: "Stellar Dynamics | Battery Ventures",
    symbol: "STL",
    description: "Revolutionary DeFi platform powered by advanced stellar mechanics."
  },
  LAI: {
    name: "Luminary AI | Paradigm X",
    symbol: "LAI",
    description: "AI-driven decentralized oracle network for smart contracts."
  },
  NOV: {
    name: "Nova Finance | Lightspeed Alpha",
    symbol: "NOV",
    description: "Innovative DeFi lending and borrowing protocol."
  },
  CIP: {
    name: "Cipher Labs | Polychain Capital",
    symbol: "CIP",
    description: "Privacy-focused blockchain solutions for enterprise."
  }
};

export default function Market() {
  const { toast } = useToast();
  const [timeframe, setTimeframe] = useState<string>("24H");

  // Get token symbol from URL
  const tokenSymbol = window.location.pathname.split('/market/')[1]?.toUpperCase() || 'NXP';
  const token = tokens[tokenSymbol as keyof typeof tokens] || tokens.NXP;

  const form = useForm({
    resolver: zodResolver(insertOrderSchema),
    defaultValues: {
      type: "buy",
      amount: 1,
      price: 0,
    },
  });

  const { data: latestPrice, isLoading: loadingPrice } = useQuery({
    queryKey: ["/api/prices/latest"],
  });

  const { data: priceHistory } = useQuery({
    queryKey: ["/api/prices/history", timeframe],
    queryFn: async () => {
      const res = await fetch(`/api/prices/history?timeframe=${timeframe}`);
      if (!res.ok) throw new Error("Failed to fetch price history");
      return res.json();
    },
  });

  const { data: portfolio } = useQuery({
    queryKey: ["/api/portfolio"],
  });

  const { data: orders } = useQuery({
    queryKey: ["/api/orders"],
  });

  // Calculate token quantities from orders
  const tokenQuantities = orders?.reduce((acc: Record<string, number>, order: any) => {
    // Only count tokens for the current symbol
    if (order.symbol !== tokenSymbol) return acc;

    const amount = parseFloat(order.amount);

    if (!acc[order.symbol]) {
      acc[order.symbol] = 0;
    }

    // Track the actual token quantities
    acc[order.symbol] += order.type === 'buy' ? amount : -amount;
    return acc;
  }, {}) || {};

  // Get the quantity for the current token
  const tokenQuantity = tokenQuantities[tokenSymbol] || 0;

  const currentPrice = parseFloat(latestPrice?.price || "0");

  const orderMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("POST", "/api/orders", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio"] });
      toast({
        title: "Order placed successfully",
        description: "Your order has been submitted",
      });
      form.reset();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to place order",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (type: "buy" | "sell") => (e: React.MouseEvent) => {
    e.preventDefault();
    const amount = form.getValues("amount");

    if (!amount || amount <= 0) {
      toast({
        title: "Invalid amount",
        description: "Please enter a valid amount greater than 0",
        variant: "destructive",
      });
      return;
    }

    const currentPrice = parseFloat(latestPrice?.price || "0");
    if (currentPrice <= 0) {
      toast({
        title: "Invalid price",
        description: "Cannot place order at this time",
        variant: "destructive",
      });
      return;
    }

    const orderValue = amount * currentPrice;

    if (type === "buy" && (portfolio?.balance || 0) < orderValue) {
      toast({
        title: "Insufficient balance",
        description: "You don't have enough cash to make this purchase",
        variant: "destructive",
      });
      return;
    }

    if (type === "sell" && (portfolio?.balance || 0) < amount) {
      toast({
        title: "Insufficient balance",
        description: "You don't have enough tokens to sell",
        variant: "destructive",
      });
      return;
    }

    orderMutation.mutate({
      type,
      amount: parseFloat(amount.toString()),
      price: currentPrice,
      symbol: token.symbol,
    });
  };

  const priceData = priceHistory?.map(price => ({
    ...price,
    price: parseFloat(price.price),
  }));

  const minPrice = Math.min(...(priceData?.map(d => d.price) || [100])) * 0.99;
  const maxPrice = Math.max(...(priceData?.map(d => d.price) || [100])) * 1.01;

  // Format timestamp based on timeframe
  const formatTimestamp = (time: string) => {
    const date = new Date(time);
    switch (timeframe) {
      case "1H":
        return format(date, "HH:mm");
      case "24H":
        return format(date, "HH:mm");
      case "7D":
        return format(date, "MMM d");
      default:
        return format(date, "HH:mm");
    }
  };

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">{token.name}</h1>
        <p className="text-muted-foreground">
          {token.description}
        </p>
      </div>

      <div className="grid gap-6">
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Market Data</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Current Price:</span>
                  <span className="text-xl font-medium">${currentPrice.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Your Cash Balance:</span>
                  <span className="text-xl font-medium">${portfolio?.balance?.toFixed(2) || "0.00"}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Your {tokenSymbol} Tokens:</span>
                  <span className="text-xl font-medium">{tokenQuantity.toFixed(2)} {tokenSymbol}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex justify-between items-center">
                <span>{token.description}</span>
                {loadingPrice ? (
                  <span>Loading...</span>
                ) : (
                  <span className="text-2xl font-bold">
                    ${parseFloat(latestPrice?.price || "0").toFixed(2)}
                  </span>
                )}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Price History</CardTitle>
            <div className="flex gap-2 mt-2">
              {["1H", "24H", "7D"].map((tf) => (
                <Button
                  key={tf}
                  variant={timeframe === tf ? "default" : "outline"}
                  onClick={() => setTimeframe(tf)}
                  size="sm"
                >
                  {tf}
                </Button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="pt-6 h-[300px]">
            {priceData && (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={priceData}>
                  <XAxis
                    dataKey="timestamp"
                    tickFormatter={formatTimestamp}
                    stroke="hsl(var(--muted-foreground))"
                  />
                  <YAxis 
                    domain={[minPrice, maxPrice]}
                    tickFormatter={(value) => `$${value.toFixed(2)}`}
                    stroke="hsl(var(--muted-foreground))"
                  />
                  <Tooltip
                    labelFormatter={(label) => formatTimestamp(label as string)}
                    formatter={(value: any) => [
                      `$${value.toFixed(2)}`,
                      "Price",
                    ]}
                    contentStyle={{
                      backgroundColor: "hsl(var(--background))",
                      border: "1px solid hsl(var(--border))",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="price"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Trade</CardTitle>
            <CardDescription>
              Enter the amount of tokens you want to buy or sell at the current market price.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form className="space-y-4">
                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Amount</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="1" 
                          min="1"
                          placeholder="Enter amount to trade"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex gap-4">
                  <Button
                    className="flex-1"
                    onClick={onSubmit("buy")}
                    disabled={orderMutation.isPending || loadingPrice}
                  >
                    Buy
                  </Button>
                  <Button
                    className="flex-1"
                    variant="secondary"
                    onClick={onSubmit("sell")}
                    disabled={orderMutation.isPending || loadingPrice || (portfolio?.balance || 0) <= 0}
                  >
                    Sell
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
