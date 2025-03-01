import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ZAxis,
  Cell,
  BarChart,
  Bar,
} from "recharts";
import { useEffect, useRef, useState } from "react";

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8", "#82ca9d"];

interface BubbleData {
  name: string;
  value: number;
  quantity: number;
  color: string;
  x: number;
  y: number;
}

export default function Portfolio() {
  const queryClient = useQueryClient();

  const { data: portfolio, isLoading: portfolioLoading, error: portfolioError } = useQuery<{ balance: number }>({
    queryKey: ["/api/portfolio"],
    onError: (error) => {
      console.error("Error fetching portfolio:", error);
    },
  });

  const { data: orders, isLoading: ordersLoading, error: ordersError } = useQuery<any[]>({
    queryKey: ["/api/orders"],
    onError: (error) => {
      console.error("Error fetching orders:", error);
    },
  });

  // Get all unique token symbols from orders
  const tokenSymbols = orders ? 
    [...new Set(orders.map(order => order.symbol))] : 
    [];

  // Fetch prices for each token symbol
  const { data: tokenPrices, isLoading: tokenPricesLoading } = useQuery({
    queryKey: ["/api/token-prices"],
    queryFn: async () => {
      // In a real app, you'd have an API endpoint that returns prices for all tokens
      // For now, we'll simulate it by fetching the latest price and creating a map
      const priceResponse = await fetch('/api/prices/latest');
      const priceData = await priceResponse.json();
      
      // This is a temporary solution - in a real app you would fetch actual prices for each token
      // Create a map of token symbol to price
      const priceMap: Record<string, number> = {};
      
      // Simulate different prices for each token with some variance
      // In a real app, you would get these from your API
      const basePrice = parseFloat(priceData.price || "100");
      
      tokenSymbols.forEach((symbol, index) => {
        // Create some variance in prices based on the symbol (this is just for simulation)
        const variance = 1.2 + (index * 0.1); // Each token will have a different price
        priceMap[symbol] = basePrice * variance;
      });
      
      return priceMap;
    },
    enabled: tokenSymbols.length > 0, // Only run this query if we have token symbols
  });

  // Calculate token quantities from orders
  const tokenQuantities: Record<string, number> =
    orders?.reduce((acc: Record<string, number>, order: { symbol: string; amount: string; type: string; }) => {
      const amount = parseFloat(order.amount);
      if (!acc[order.symbol]) {
        acc[order.symbol] = 0;
      }
      // Track the actual token quantities
      acc[order.symbol] += order.type === "buy" ? amount : -amount;
      return acc;
    }, {}) || {};

  // Calculate net cost (for cost basis)
  const tokenCostData: Record<
    string,
    { symbol: string; cost: number; quantity: number }
  > = {};

  orders?.forEach((order: any) => {
    const symbol = order.symbol;
    const amount = parseFloat(order.amount);
    const price = parseFloat(order.price || "0");

    if (!tokenCostData[symbol]) {
      tokenCostData[symbol] = {
        symbol,
        cost: 0,
        quantity: 0,
      };
    }

    const costChange = price * amount;
    if (order.type === "buy") {
      tokenCostData[symbol].cost += costChange;
      tokenCostData[symbol].quantity += amount;
    } else {
      // For sells, subtract cost and reduce quantity
      tokenCostData[symbol].cost -= costChange;
      tokenCostData[symbol].quantity -= amount;
    }
  });

  // Function to get current price for a specific token
  const getTokenPrice = (symbol: string): number => {
    if (tokenPrices && tokenPrices[symbol]) {
      return tokenPrices[symbol];
    }
    // Fallback to a default price if not found
    return 100;
  };

  // Prepare data for the bubble chart with improved positioning logic
  const generateClusteredBubbleData = () => {
    const tokens = Object.entries(tokenQuantities)
      .filter(([_, quantity]) => quantity > 0)
      .map(([symbol, quantity], index) => ({
        name: symbol,
        value: quantity * getTokenPrice(symbol),
        quantity: quantity,
        color: COLORS[index % COLORS.length],
      }));

    // Sort tokens by value for better positioning (larger bubbles in center)
    tokens.sort((a, b) => b.value - a.value);
    
    // Calculate positions using a circle packing algorithm simulation
    // For simplicity, we'll use a basic approach where bubbles are placed
    // in a circular pattern around the center
    const bubbleData: BubbleData[] = [];
    const centerX = 0.5;
    const centerY = 0.5;
    
    // Place the largest bubble in the center
    if (tokens.length > 0) {
      bubbleData.push({
        ...tokens[0],
        x: centerX,
        y: centerY,
      });
    }
    
    // Place remaining bubbles in a spiral pattern
    const angleStep = (2 * Math.PI) / (tokens.length > 1 ? tokens.length - 1 : 1);
    let radius = 0.15; // Starting radius
    
    for (let i = 1; i < tokens.length; i++) {
      const angle = angleStep * (i - 1);
      // Apply golden ratio for more natural distribution
      const x = centerX + radius * Math.cos(angle) * (1 + (i % 3) * 0.1);
      const y = centerY + radius * Math.sin(angle) * (1 + (i % 2) * 0.1);
      
      bubbleData.push({
        ...tokens[i],
        x,
        y,
      });
      
      // Slightly increase radius for next items to create layers
      if (i % 5 === 0) {
        radius += 0.05;
      }
    }
    
    return bubbleData;
  };

  // Initialize bubble data
  const [bubbleData, setBubbleData] = useState<BubbleData[]>([]);
  const chartRef = useRef<any>(null);
  
  // Update bubble data when token quantities or prices change
  useEffect(() => {
    if (Object.keys(tokenQuantities).length > 0 && tokenPrices) {
      const newBubbleData = generateClusteredBubbleData();
      setBubbleData(newBubbleData);
    }
  }, [tokenQuantities, tokenPrices]);

  // Build data for the Cost-vs-Current-Value comparison chart
  const costValueData = Object.values(tokenCostData)
    .filter((t) => t.quantity > 0)
    .map((t, index) => {
      const currentVal = t.quantity * getTokenPrice(t.symbol);
      return {
        symbol: t.symbol,
        cost: t.cost,
        currentValue: currentVal,
        difference: currentVal - t.cost,
      };
    });

  // Calculate total portfolio value using individual token prices
  const totalPortfolioValue = Object.entries(tokenQuantities).reduce(
    (sum, [symbol, quantity]) => sum + quantity * getTokenPrice(symbol),
    0
  );
  
  const getAdjustedSizeRange = () => {
    const baseSize = 500;
    const bubbleCount = bubbleData.length;
    const minSize = Math.max(100, baseSize / (bubbleCount || 1));
    const maxSize = Math.max(1000, baseSize * 2 / (bubbleCount || 1));
    
    return [minSize, maxSize];
  };

  if (portfolioLoading || ordersLoading || tokenPricesLoading) {
    return <div>Loading...</div>;
  }

  if (portfolioError || ordersError) {
    return <div>Error loading data.</div>;
  }

  // Improved legend to show token names and quantities
  const CustomLegend = (props: any) => {
    const { payload } = props;

    return (
      <ul style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', padding: '8px 0' }}>
        {bubbleData.map((item, index) => (
          <li
            key={`item-${index}`}
            style={{
              color: 'white',
              fontSize: '14px',
              padding: '5px 10px',
              display: 'flex',
              alignItems: 'center',
              marginRight: '10px',
              marginBottom: '6px',
              background: 'rgba(0,0,0,0.1)',
              borderRadius: '16px',
            }}
          >
            <span
              style={{
                display: 'inline-block',
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                backgroundColor: item.color,
                marginRight: '5px',
              }}
            />
            <span style={{ fontWeight: '500' }}>{item.name}</span>
            <span style={{ marginLeft: '4px', opacity: '0.8' }}>
              ({item.quantity.toFixed(0)})
            </span>
          </li>
        ))}
      </ul>
    );
  };

  // Custom Tooltip Component
  const CustomTooltip = (props: any) => {
    const { active, payload } = props;
    
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-card border border-border p-3 rounded-md shadow-lg">
          <p className="text-lg font-bold">{data.name}</p>
          <p className="text-sm">Quantity: {data.quantity.toFixed(0)}</p>
          <p className="text-sm">Value: ${data.value.toFixed(0)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {(data.value / totalPortfolioValue * 100).toFixed(1)}% of portfolio
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div>
      {/* Spacer div to prevent overlap with the header */}
      <div style={{ height: '60px' }}></div>
    
    <div className="container mx-auto p-4 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">My Portfolio</h1>
        <p className="text-muted-foreground">
          View your token holdings and transaction history
        </p>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Holdings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Cash Balance:</span>
                <span className="text-xl font-medium">
                  ${portfolio?.balance?.toFixed(2) || "0.00"}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Token Value:</span>
                <span className="text-xl font-medium">
                  ${totalPortfolioValue.toFixed(2)}
                </span>
              </div>

              <div className="flex justify-between items-center border-t border-gray-200 pt-2 mt-2">
                <span className="text-muted-foreground font-medium">
                  Total Portfolio Value:
                </span>
                <span className="text-xl font-bold text-primary">
                  ${((portfolio?.balance || 0) + totalPortfolioValue).toFixed(2)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bubble Chart (Distribution) */}
        <Card>
          <CardHeader>
            <CardTitle>Portfolio Bubble Map</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[400px] w-full bg-black rounded-md p-4">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart
                  margin={{ top: 20, right: 20, bottom: 10, left: 20 }}
                  ref={chartRef}
                >
                  <XAxis 
                    type="number" 
                    dataKey="x" 
                    name="X" 
                    domain={[0, 1]} 
                    tick={false} 
                    axisLine={false}
                  />
                  <YAxis 
                    type="number" 
                    dataKey="y" 
                    name="Y" 
                    domain={[0, 1]} 
                    tick={false} 
                    axisLine={false}
                  />
                  <ZAxis 
                    type="number" 
                    dataKey="value" 
                    range={getAdjustedSizeRange()} 
                  />
                  {/* Using the custom tooltip component */}
                  <Tooltip content={<CustomTooltip />} />
                  <Legend content={<CustomLegend />} />
                  <Scatter
                    name="Tokens"
                    data={bubbleData}
                    fill="#8884d8"
                    shape="circle"
                  >
                    {bubbleData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Bar Chart (Cost Basis vs Current Value) */}
        <Card>
          <CardHeader>
            <CardTitle>Cost vs Market Value</CardTitle>
          </CardHeader>
          <CardContent>
            {costValueData.length > 0 ? (
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={costValueData}>
                    <XAxis dataKey="symbol" />
                    <YAxis />
                    <Tooltip
                      formatter={(value, name) =>
                        name === "difference"
                          ? [`$${(value as number).toFixed(2)}`, "Profit/Loss"]
                          : [`$${(value as number).toFixed(2)}`, name]
                      }
                      contentStyle={{
                        backgroundColor: "hsl(var(--background))",
                        border: "1px solid hsl(var(--border))",
                      }}
                    />
                    <Legend />
                    <Bar dataKey="cost" fill="#8884d8" name="Total Cost" />
                    <Bar
                      dataKey="currentValue"
                      fill="#82ca9d"
                      name="Current Value"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-muted-foreground">No token data to display.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Token Holdings</CardTitle>
          </CardHeader>
          <CardContent>
            {Object.entries(tokenQuantities).length > 0 ? (
              <div className="space-y-2">
                {Object.entries(tokenQuantities)
                  .filter(([_, quantity]) => quantity > 0)
                  .map(([symbol, quantity]) => (
                    <div
                      key={symbol}
                      className="flex justify-between items-center p-2 border-b"
                    >
                      <div>
                        <span className="font-medium">{symbol}</span>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-base">
                          {(quantity as number).toFixed(2)} tokens
                        </span>
                        <span className="text-sm text-muted-foreground">
                          ${(quantity * getTokenPrice(symbol)).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="text-muted-foreground">No tokens in your portfolio yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Transaction History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {orders
                ?.slice()
                .sort(
                  (a: any, b: any) =>
                    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
                )
                .map((order: any) => (
                  <div
                    key={order.id}
                    className="flex items-center justify-between py-2 border-b last:border-0"
                  >
                    <div>
                      <span
                        className={`font-medium ${
                          order.type === "buy" ? "text-green-500" : "text-red-500"
                        }`}
                      >
                        {order.type.toUpperCase()} {order.symbol}
                      </span>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(order.timestamp), "MMM d, yyyy HH:mm")}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">
                        {order.amount} {order.symbol}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        @ ${parseFloat(order.price).toFixed(2)}
                      </p>
                    </div>
                  </div>
                ))}
              {(!orders || (orders as any[]).length === 0) && (
                <p className="text-center text-muted-foreground py-4">
                  No transactions yet
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      </div>
    </div>
  );
}