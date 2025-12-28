import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Menu, X, User, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

const Navigation = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  // Check if we're on the home page for transparent nav
  const isHomePage = location.pathname === "/";

  // Handle scroll effect
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  // Show different links based on auth state
  const publicLinks = [
    { name: "Home", path: "/" },
    { name: "Map", path: "/map" },
    { name: "Contact", path: "/contact" },
  ];

  const authenticatedLinks = [
    { name: "Dashboard", path: "/dashboard" },
    { name: "Opportunities", path: "/opportunities" },
    { name: "Map", path: "/map" },
    { name: "Contact", path: "/contact" },
  ];

  const links = user ? authenticatedLinks : publicLinks;

  const isActive = (path: string) => location.pathname === path;

  // Determine nav styles based on scroll and page
  // Home page: transparent nav with white text, scrolled = black bg with white text
  // Other pages: use theme colors
  const navBackground = isHomePage
    ? (isScrolled ? "bg-black" : "bg-transparent")
    : "bg-background";

  const textColor = isHomePage
    ? "text-white"
    : "text-foreground";

  const logoColor = isHomePage
    ? "text-white"
    : "text-foreground";

  const borderStyle = isHomePage && !isScrolled
    ? "border-transparent"
    : (isHomePage ? "border-white/10" : "border-border");

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${navBackground} ${borderStyle} border-b backdrop-blur-sm bg-opacity-95`}>
      <div className="container mx-auto px-6">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <Link to="/" className={`flex items-center gap-3 text-xl tracking-tight font-heading ${logoColor}`}>
            <span className="font-semibold">Clinical</span>
            <span className="font-semibold">Hours</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            {links.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={`text-xs font-semibold uppercase tracking-widest transition-opacity hover:opacity-70 font-heading ${
                  isActive(link.path) ? "opacity-100" : "opacity-80"
                } ${textColor}`}
              >
                {link.name}
              </Link>
            ))}
            {user ? (
              <>
                <Link
                  to="/profile"
                  className={`text-xs font-semibold uppercase tracking-widest transition-opacity hover:opacity-70 opacity-80 font-heading ${textColor}`}
                >
                  Profile
                </Link>
                <button
                  onClick={handleSignOut}
                  className={`text-xs font-semibold uppercase tracking-widest transition-opacity hover:opacity-70 opacity-80 font-heading ${textColor}`}
                >
                  Log Out
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/auth"
                  className={`text-xs font-semibold uppercase tracking-widest transition-opacity hover:opacity-70 opacity-80 font-heading ${textColor}`}
                >
                  Log In
                </Link>
                <Button 
                  asChild 
                  size="sm"
                  className={`text-xs uppercase tracking-widest rounded-none px-6 py-5 ${
                    isHomePage
                      ? "bg-white text-black hover:bg-white/90"
                      : "bg-primary text-primary-foreground hover:bg-primary/90"
                  }`}
                >
                  <Link to="/auth">Get Started</Link>
                </Button>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className={`md:hidden p-2 transition-colors ${textColor}`}
          >
            {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {isOpen && (
          <div className={`md:hidden py-6 space-y-4 border-t ${isHomePage ? "border-white/10" : "border-border"}`}>
            {links.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                onClick={() => setIsOpen(false)}
                className={`block text-xs font-semibold uppercase tracking-widest py-2 transition-opacity hover:opacity-70 font-heading ${
                  isActive(link.path) ? "opacity-100" : "opacity-80"
                } ${textColor}`}
              >
                {link.name}
              </Link>
            ))}
            {user ? (
              <>
                <Link
                  to="/profile"
                  onClick={() => setIsOpen(false)}
                  className={`block text-xs font-semibold uppercase tracking-widest py-2 transition-opacity hover:opacity-70 opacity-80 font-heading ${textColor}`}
                >
                  Profile
                </Link>
                <button
                  onClick={() => {
                    handleSignOut();
                    setIsOpen(false);
                  }}
                  className={`block text-xs font-semibold uppercase tracking-widest py-2 transition-opacity hover:opacity-70 opacity-80 font-heading ${textColor}`}
                >
                  Log Out
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/auth"
                  onClick={() => setIsOpen(false)}
                  className={`block text-xs font-semibold uppercase tracking-widest py-2 transition-opacity hover:opacity-70 opacity-80 font-heading ${textColor}`}
                >
                  Log In
                </Link>
                <Link
                  to="/auth"
                  onClick={() => setIsOpen(false)}
                  className={`inline-block text-xs font-semibold uppercase tracking-widest py-3 px-6 mt-2 font-heading ${
                    isHomePage ? "bg-white text-black" : "bg-primary text-primary-foreground"
                  }`}
                >
                  Get Started
                </Link>
              </>
            )}
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navigation;
