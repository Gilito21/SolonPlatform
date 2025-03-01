import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import logo from '../pages/Solon_White_logo.png';

const navigation = [
  { name: "Home", href: "/home" },
  { name: "Market", href: "/market" },
  { name: "Portfolio", href: "/portfolio" },
  { name: "Waitlist", href: "/" },
];

export function Navigation() {
  const [location] = useLocation();
  const { data: portfolio } = useQuery({
    queryKey: ["/api/portfolio"],
  });

  return (
    <nav className="border-b">
      <div className="container mx-auto px-4">
          <div className="flex h-12 items-center justify-between">

          <div className="flex items-center gap-4">
            <img src={logo} alt="Solon Logo" className="h-8" />
            <div className="text-xs font-medium bg-muted/50 rounded-md px-2 py-0.5 flex items-center">
              <span className="opacity-70 mr-1">Cash:</span> ${portfolio?.balance?.toFixed(2) || "0.00"}
            </div>
          </div>
          <div className="flex gap-8">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={`text-xs font-medium transition-colors hover:text-primary ${
                  location === item.href
                    ? "text-foreground"
                    : "text-muted-foreground"
                }`}
              >
                {item.name}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
}
