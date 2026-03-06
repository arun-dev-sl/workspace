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
        const isActive = location.pathname.includes(item.href);
        const Icon = item.icon;
        return (
          <button
            key={item.href}
            onClick={() => handleSelect(item.href)}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
              isActive
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
            }`}
          >
            <Icon className="size-5" />
            <span className="font-medium">{item.label}</span>
          </button>
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
