import { Link, useLocation } from "react-router-dom";
import { ChevronRight, Home } from "lucide-react";
import { cn } from "@/lib/utils";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items?: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumbs({ items, className }: BreadcrumbsProps) {
  const location = useLocation();
  
  // Auto-generate breadcrumbs from path if not provided
  const breadcrumbs: BreadcrumbItem[] = items || (() => {
    const paths = location.pathname.split("/").filter(Boolean);
    const result: BreadcrumbItem[] = [{ label: "Home", href: "/" }];
    
    let currentPath = "";
    paths.forEach((path, index) => {
      currentPath += `/${path}`;
      const isLast = index === paths.length - 1;
      
      // Format label
      let label = path;
      if (path === "opportunities") label = "Opportunities";
      else if (path === "dashboard") label = "Dashboard";
      else if (path === "profile") label = "Profile";
      else if (path === "contact") label = "Contact";
      else if (path === "projects") label = "Projects";
      else if (path === "map") label = "Map";
      else if (path === "auth") label = "Sign In";
      else {
        // Capitalize and replace hyphens
        label = path.split("-").map(word => 
          word.charAt(0).toUpperCase() + word.slice(1)
        ).join(" ");
      }
      
      result.push({
        label,
        href: isLast ? undefined : currentPath,
      });
    });
    
    return result;
  })();

  if (breadcrumbs.length <= 1) return null;

  return (
    <nav 
      aria-label="Breadcrumb" 
      className={cn("flex items-center gap-2 text-sm text-muted-foreground mb-4", className)}
    >
      {breadcrumbs.map((item, index) => {
        const isLast = index === breadcrumbs.length - 1;
        
        return (
          <div key={index} className="flex items-center gap-2">
            {index === 0 ? (
              <Link
                to={item.href || "#"}
                className="hover:text-foreground transition-colors flex items-center gap-1"
                aria-label="Home"
              >
                <Home className="h-4 w-4" />
              </Link>
            ) : (
              <>
                <ChevronRight className="h-4 w-4" />
                {isLast ? (
                  <span className="text-foreground font-medium" aria-current="page">
                    {item.label}
                  </span>
                ) : (
                  <Link
                    to={item.href || "#"}
                    className="hover:text-foreground transition-colors"
                  >
                    {item.label}
                  </Link>
                )}
              </>
            )}
          </div>
        );
      })}
    </nav>
  );
}

