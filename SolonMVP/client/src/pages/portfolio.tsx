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
  radius?: number;
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
      tokenCostData[symbol].cost -= costChange;
      tokenCostData[symbol].quantity -= amount;
    }
  });

  // Get latest price to calculate current token values
  const { data: latestPrice, isLoading: priceLoading, error: priceError } = useQuery<{ price: string }>({
    queryKey: ["/api/prices/latest"],
    onError: (error) => {
      console.error("Error fetching latest price:", error);
    },
  });
  const currentPrice = parseFloat(latestPrice?.price || "0");

  // This function will generate a packed bubble layout
  const generatePackedLayout = (data: BubbleData[]): BubbleData[] => {
    if (!data.length) return [];
    
    // Sort by value (largest first) to make sure larger bubbles are placed first
    const sortedData = [...data].sort((a, b) => b.value - a.value);
    
    // Create a container with dimensions 1x1
    const container = { width: 1, height: 1 };
    
    // Set initial positions to center
    const packedData = sortedData.map(item => ({
      ...item,
      // Calculate radius based on value
      radius: Math.sqrt(item.value) / Math.sqrt(sortedData[0].value) * 0.2,
      x: 0.5,
      y: 0.5
    }));
    
    // Simple collision detection and resolution
    const resolveCollisions = () => {
      for (let i = 0; i < packedData.length; i++) {
        for (let j = 0; j < packedData.length; j++) {
          if (i !== j) {
            const a = packedData[i];
            const b = packedData[j];
            
            // Distance between centers
            const dx = a.x - b.x;
            const dy = a.y - b.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            // Minimum distance to avoid collision
            const minDistance = (a.radius || 0) + (b.radius || 0) + 0.01; // Added small gap
            
            if (distance < minDistance) {
              // Calculate the movement direction
              const nx = dx / distance;
              const ny = dy / distance;
              
              // Move bubbles apart
              const moveDistance = (minDistance - distance) / 2;
              
              packedData[i].x += nx * moveDistance;
              packedData[i].y += ny * moveDistance;
              packedData[j].x -= nx * moveDistance;
              packedData[j].y -= ny * moveDistance;
              
              // Keep bubbles within container bounds
              packedData[i].x = Math.max(packedData[i].radius || 0, Math.min(container.width - (packedData[i].radius || 0), packedData[i].x));
              packedData[i].y = Math.max(packedData[i].radius || 0, Math.min(container.height - (packedData[i].radius || 0), packedData[i].y));
              packedData[j].x = Math.max(packedData[j].radius || 0, Math.min(container.width - (packedData[j].radius || 0), packedData[j].x));
              packedData[j].y = Math.max(packedData[j].radius || 0, Math.min(container.height - (packedData[j].radius || 0), packedData[j].y));
            }
          }
        }
      }
    };
    
    // Push bubbles apart and center them
    for (let iteration = 0; iteration < 100; iteration++) {
      resolveCollisions();
    }
    
    // Center the whole group if needed
    const centerX = packedData.reduce((sum, item) => sum + item.x, 0) / packedData.length;
    const centerY = packedData.reduce((sum, item) => sum + item.y, 0) / packedData.length;
    const offsetX = 0.5 - centerX;
    const offsetY = 0.5 - centerY;
    
    packedData.forEach(item => {
      item.x += offsetX;
      item.y += offsetY;
    });
    
    return packedData;
  };

  // Prepare data for the bubble chart
  const initialBubbleData: BubbleData[] = Object.entries(tokenQuantities)
    .filter(([_, quantity]) => quantity > 0)
    .map(([symbol, quantity], index) => ({
      name: symbol,
      value: quantity * currentPrice,
      quantity: quantity,
      color: COLORS[index % COLORS.length],
      x: 0.5, // Initially center all bubbles
      y: 0.5,
    }));

  // Use state to manage the bubble data
  const [bubbleData, setBubbleData] = useState<BubbleData[]>([]);
  const chartRef = useRef<any>(null);
  
  // Update bubble layout when data changes
  useEffect(() => {
    if (initialBubbleData.length > 0) {
      const packedLayout = generatePackedLayout(initialBubbleData);
      setBubbleData(packedLayout);
    }
  }, [JSON.stringify(initialBubbleData)]);

  // Calculate token balances for other charts
  const tokenBalances = Object.entries(tokenQuantities).reduce(
    (acc: Record<string, number>, [symbol, quantity]) => {
      acc[symbol] = quantity * currentPrice;
      return acc;
    },
    {}
  );

  const portfolioData = Object.entries(tokenBalances)
    .filter(([_, value]) => value > 0)
    .map(([symbol, value], index) => ({
      name: symbol,
      value,
      color: COLORS[index % COLORS.length],
    }));

  // Build data for the Cost-vs-Current-Value comparison chart
  const costValueData = Object.values(tokenCostData)
    .filter((t) => t.quantity > 0)
    .map((t, index) => {
      const currentVal = t.quantity * currentPrice;
      return {
        symbol: t.symbol,
        cost: t.cost,
        currentValue: currentVal,
        difference: currentVal - t.cost,
      };
    });

  // Adjust bubble size based on the number of bubbles
  const bubbleCount = bubbleData.length;
  const baseSize = 5000;
  const sizeFactor = baseSize / (bubbleCount || 1);

  if (portfolioLoading || ordersLoading || priceLoading) {
    return <div>Loading...</div>;
  }

  if (portfolioError || ordersError || priceError) {
    return <div>Error loading data.</div>;
  }

  // Enhanced legend component
  const CustomLegend = (props: any) => {
    const { payload } = props;

    return (
      <div className="flex flex-wrap gap-2 mt-2">
        {bubbleData.map((item, index) => (
          <div
            key={`legend-${index}`}
            className="flex items-center px-2 py-1 bg-background rounded-md border"
          >
            <span
              className="inline-block w-3 h-3 rounded-full mr-2"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-sm font-medium">{item.name}</span>
            <span className="text-xs text-muted-foreground ml-2">
              ({item.quantity.toFixed(2)})
            </span>
          </div>
        ))}
      </div>
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
          <p className="text-sm">Quantity: {data.quantity.toFixed(2)}</p>
          <p className="text-sm">Value: ${data.value.toFixed(2)}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div>
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
                    ${(
                      Object.entries(tokenQuantities).reduce(
                        (sum, [_, quantity]) => sum + quantity * currentPrice,
                        0
                      ) ?? 0
                    ).toFixed(2)}
                  </span>
                </div>

                <div className="flex justify-between items-center border-t border-gray-200 pt-2 mt-2">
                  <span className="text-muted-foreground font-medium">
                    Total Portfolio Value:
                  </span>
                  <span className="text-xl font-bold text-primary">
                    ${(
                      (portfolio?.balance || 0) +
                      Object.entries(tokenQuantities).reduce(
                        (sum, [_, quantity]) => sum + quantity * currentPrice,
                        0
                      )
                    ).toFixed(2)}
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
              <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart
                    margin={{ top: 20, right: 20, bottom: 50, left: 20 }}
                    ref={chartRef}
                  >
                    <XAxis type="number" dataKey="x" name="X" unit="" tick={false} domain={[0, 1]} />
                    <YAxis type="number" dataKey="y" name="Y" unit="" tick={false} domain={[0, 1]} />
                    <ZAxis type="number" dataKey="value" name="Value" range={[100, sizeFactor]} />
                    <Tooltip content={<CustomTooltip />} />
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
              
              {/* Render custom legend below the chart */}
              <CustomLegend payload={bubbleData} />
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
                            ${(quantity * currentPrice).toFixed(2)}
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