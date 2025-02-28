import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "wouter";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState } from "react";

const mockTokens = [
  {
    name: "Nexus Protocol | Andreessen Horowitz",
    symbol: "NXP",
    price: 102.45,
    change: 5.2,
  },
  {
    name: "Quantum Edge | Sequoia Capital",
    symbol: "QTE",
    price: 101.30,
    change: -2.1,
  },
  {
    name: "Stellar Dynamics | Battery Ventures",
    symbol: "STL",
    price: 92.90,
    change: 3.8,
  },
  {
    name: "Luminary AI | Paradigm X",
    symbol: "LAI",
    price: 105.75,
    change: 1.5,
  },
  {
    name: "Nova Finance | Lightspeed Alpha",
    symbol: "NOV",
    price: 94.10,
    change: -0.5,
  },
  {
    name: "Cipher Labs | Polychain Capital",
    symbol: "CIP",
    price: 95.00,
    change: 4.0,
  },
];

export default function Home() {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredTokens = mockTokens.filter(token => 
    token.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    token.symbol.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Token Market</h1>
        <p className="text-muted-foreground">
          Explore and trade the most innovative startups in the ecosystem, backed by world renowned Venture Capitals
        </p>
      </div>

      <div className="flex items-center justify-between mb-8">
        <Input
          placeholder="Search tokens by name or symbol..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-md"
        />
        <Link href="/market">
          <Button>Search</Button>
        </Link>
      </div>

      <div className="grid gap-4">
        {filteredTokens.map((token) => (
          <Card 
            key={token.symbol} 
            className="shadow-md hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => window.location.href = `/market/${token.symbol.toLowerCase()}`}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <Link href={`/market/${token.symbol.toLowerCase()}`} className="block flex-1 hover:opacity-75 transition-opacity">
                  <div>
                    <h2 className="text-lg font-semibold">{token.name.split(' | ')[0]}</h2>
                    <p className="text-sm text-muted-foreground">
                      {token.symbol}
                    </p>
                  </div>
                </Link>
                <div className="text-right">
                  <p className="text-xl font-bold">${token.price}</p>
                  <div className="flex items-center gap-1">
                    {token.change >= 0 ? (
                      <ArrowUpRight className="h-4 w-4 text-green-500" />
                    ) : (
                      <ArrowDownRight className="h-4 w-4 text-red-500" />
                    )}
                    <span
                      className={`text-sm font-medium ${token.change >= 0 ? "text-green-500" : "text-red-500"}`}
                    >
                      {Math.abs(token.change)}%
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}