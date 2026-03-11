import { Header } from "@/components/layouts";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { useAuthSession } from "@/app/auth-session-context";

import { Button } from "@workspace/ui/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@workspace/ui/components/ui/drawer";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { NavUser } from "./nav-user";
import { Logo } from "@/components/nav/logo";
import NavTabs from "./nav-tabs";
import { Menu } from "lucide-react";
import { useState } from "react";
import { navItems } from "./nav-tabs";

const MobileNavItems = ({ onSelect }: { onSelect: () => void }) => {
  const location = useLocation();
  const navigate = useNavigate();

  const handleSelect = (href: string) => {
    navigate(href);
    onSelect();
  };

  return (
    <>
      {navItems.map((item) => {
        const isActive =
          location.pathname === item.href ||
          location.pathname.startsWith(`${item.href}/`) ||
          item.children?.some(
            (child) =>
              location.pathname === child.href ||
              location.pathname.startsWith(`${child.href}/`),
          );
        const Icon = item.icon;
        return (
          <div key={item.href} className="flex flex-col gap-2">
            <button
              onClick={() => handleSelect(item.href)}
              className={`flex items-center gap-3 rounded-lg px-4 py-3 text-left transition-colors ${
                isActive
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
              }`}
            >
              <Icon className="size-5" />
              <span className="font-medium">{item.label}</span>
            </button>

            {item.children ? (
              <div className="ml-4 flex flex-col gap-1 border-l border-border/60 pl-4">
                {item.children.map((child) => {
                  const ChildIcon = child.icon;
                  const isChildActive =
                    location.pathname === child.href ||
                    location.pathname.startsWith(`${child.href}/`);

                  return (
                    <button
                      key={child.href}
                      onClick={() => handleSelect(child.href)}
                      className={`flex items-center gap-3 rounded-lg px-4 py-2 text-left text-sm transition-colors ${
                        isChildActive
                          ? "bg-secondary text-foreground"
                          : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                      }`}
                    >
                      <ChildIcon className="size-4" />
                      <span className="font-medium">{child.label}</span>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        );
      })}
    </>
  );
};

const Nav = () => {
  const { hasToken, isAuthenticated, user } = useAuthSession();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const email = user?.email;
  const isSuccess = isAuthenticated && hasToken;

  return (
    <Header className="absolute top-0 w-full h-12">
      <div className="flex items-center justify-between w-full gap-4">
        <div className="flex items-center">
          <Logo />
        </div>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center">
          <NavTabs />
        </div>

        <div className="flex items-center gap-2 md:gap-4">
          <ThemeToggle />
          {isSuccess ? (
            <div className="hidden md:block">
              <NavUser username={email} />
            </div>
          ) : (
            <Link to="/login" className="hidden md:block">
              <Button variant="ghost">Login</Button>
            </Link>
          )}

          {/* Mobile Menu Button */}
          <Drawer
            open={mobileMenuOpen}
            onOpenChange={setMobileMenuOpen}
            direction="bottom"
          >
            <DrawerTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                aria-label="Open menu"
              >
                <Menu className="size-5" />
              </Button>
            </DrawerTrigger>
            <DrawerContent className="h-[85vh] rounded-t-2xl">
              <DrawerHeader className="text-left">
                <DrawerTitle>Menu</DrawerTitle>
              </DrawerHeader>
              <div className="px-4 pb-8 overflow-y-auto">
                {/* Mobile Navigation Items */}
                <nav className="flex flex-col gap-2">
                  <MobileNavItems onSelect={() => setMobileMenuOpen(false)} />
                </nav>

                {/* Mobile User Section */}
                {isSuccess && (
                  <div className="mt-6 pt-6 border-t">
                    <p className="text-sm text-muted-foreground mb-2">
                      {email}
                    </p>
                    <NavUser username={email} />
                  </div>
                )}

                {!isSuccess && (
                  <div className="mt-6 pt-6 border-t">
                    <Link to="/login" onClick={() => setMobileMenuOpen(false)}>
                      <Button variant="ghost" className="w-full">
                        Login
                      </Button>
                    </Link>
                  </div>
                )}
              </div>
            </DrawerContent>
          </Drawer>
        </div>
      </div>
    </Header>
  );
};

export { Nav };
