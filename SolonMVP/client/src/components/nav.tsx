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
    <nav className="border-b bg-[rgb(0, 0, 0)] fixed top-0 left-0 right-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex h-12 items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/home">
              <img src={logo} alt="Solon Logo" className="h-8" />
            </Link>
          </div>
          <div className="flex gap-4 justify-center">
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
