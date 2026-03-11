import { useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  ChartArea,
  LayoutDashboard,
  Mail,
  Paintbrush,
  Briefcase,
  Banknote,
  Plane,
  Hotel,
  FlaskConical,
} from "lucide-react";

import { appPaths } from "@/config/app-paths";
import { Tabs, TabsList, TabsTrigger } from "@workspace/ui/components/ui/tabs";

export interface NavSubItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

export interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  children?: NavSubItem[];
}

export const navItems: NavItem[] = [
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
    label: "Flights and Hotels",
    href: appPaths.auth.flights.getHref(),
    icon: Plane,
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

function isItemActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

const NavTabs = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const activeItem = useMemo(() => {
    const match = navItems.find(
      (item) =>
        item.children?.some((child) =>
          isItemActive(location.pathname, child.href),
        ) || isItemActive(location.pathname, item.href),
    );

    return match ?? navItems[0];
  }, [location.pathname]);

  const current = activeItem?.href ?? "/";

  const currentChild = useMemo(() => {
    if (!activeItem?.children) {
      return null;
    }

    const match = activeItem.children.find((child) =>
      isItemActive(location.pathname, child.href),
    );

    return match?.href ?? activeItem.children[0]?.href ?? null;
  }, [activeItem, location.pathname]);

  return (
    <div className="flex flex-col items-center gap-2">
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
                <span className="transition-all duration-200">
                  {item.label}
                </span>
              </Link>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {activeItem?.children && currentChild ? (
        <Tabs value={currentChild} onValueChange={(value) => navigate(value)}>
          <TabsList className="h-8 rounded-sm bg-muted/60 p-1">
            {activeItem.children.map((item) => (
              <TabsTrigger
                key={item.href}
                value={item.href}
                asChild
                className="h-6 rounded-sm px-3 text-xs font-normal data-[state=active]:text-foreground"
              >
                <Link to={item.href} className="flex items-center gap-1.5">
                  {currentChild === item.href ? (
                    <item.icon className="size-3.5 text-foreground transition-all duration-200" />
                  ) : null}
                  <span>{item.label}</span>
                </Link>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      ) : null}
    </div>
  );
};

export default NavTabs;
