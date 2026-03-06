import { useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  ChartArea,
  LayoutDashboard,
  Mail,
  Paintbrush,
  Briefcase,
  Banknote,
  FlaskConical,
} from "lucide-react";

import { appPaths } from "@/config/app-paths";
import { Tabs, TabsList, TabsTrigger } from "@workspace/ui/components/ui/tabs";

export const navItems = [
  {
    label: "Dashboard",
    href: appPaths.auth.dashboard.getHref(),
    icon: LayoutDashboard,
  },
  { label: "Themes", href: appPaths.auth.themes.getHref(), icon: Paintbrush },
  {
    label: "Analytics",
    href: appPaths.auth.analytics.getHref(),
    icon: ChartArea,
  },
  {
    label: "Patterns",
    href: appPaths.auth.patterns.getHref(),
    icon: ChartArea,
  },
  {
    label: "Holdings",
    href: appPaths.auth.holdings.getHref(),
    icon: Briefcase,
  },
  {
    label: "Dividends",
    href: appPaths.auth.dividends.getHref(),
    icon: Banknote,
  },
  {
    label: "Emails",
    href: appPaths.auth.expensesEmails.getHref(),
    icon: Mail,
  },
  {
    label: "Playground",
    href: appPaths.auth.playground.getHref(),
    icon: FlaskConical,
  },
];

const NavTabs = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const current = useMemo(() => {
    const match = navItems.find((item) =>
      location.pathname.includes(item.href),
    );
    return match?.href ?? navItems[0]?.href ?? "/";
  }, [location.pathname]);

  return (
    <Tabs value={current} onValueChange={(value) => navigate(value)}>
      <TabsList className="rounded-sm">
        {navItems.map((item) => (
          <TabsTrigger
            key={item.href}
            value={item.href}
            asChild
            className="rounded-sm font-normal font-xs font-sans transition-all duration-200 data-[state=active]:text-foreground"
          >
            <Link to={item.href} className="flex items-center gap-1">
              {current === item.href ? (
                <item.icon className="size-4 text-foreground transition-all duration-200" />
              ) : null}
              <span className="transition-all duration-200">{item.label}</span>
            </Link>
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
};

export default NavTabs;
