import { useTheme } from "next-themes";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Sun, Moon } from "lucide-react";
import { useEffect, useState } from "react";

const ThemeToggle = () => {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  const isDark = resolvedTheme === "dark";

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Sun className={`h-5 w-5 transition-colors ${isDark ? "text-muted-foreground" : "text-amber-500"}`} />
        <Label htmlFor="theme-toggle" className="text-sm font-medium cursor-pointer">
          {isDark ? "Dark Mode" : "Light Mode"}
        </Label>
      </div>
      <div className="flex items-center gap-3">
        <Switch
          id="theme-toggle"
          checked={isDark}
          onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
        />
        <Moon className={`h-5 w-5 transition-colors ${isDark ? "text-primary" : "text-muted-foreground"}`} />
      </div>
    </div>
  );
};

export default ThemeToggle;
