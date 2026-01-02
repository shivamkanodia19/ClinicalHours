import * as React from "react";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { searchCities } from "@/lib/api/citySearch";
import { useDebounce } from "@/hooks/useDebounce";

interface CityAutocompleteProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function CityAutocomplete({
  value,
  onValueChange,
  placeholder = "Search for a city...",
  disabled = false,
  className,
}: CityAutocompleteProps) {
  const [open, setOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState(value || "");
  const [cities, setCities] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(false);

  // Update searchQuery when value prop changes
  React.useEffect(() => {
    if (value) {
      setSearchQuery(value);
    }
  }, [value]);

  const debouncedSearch = useDebounce(searchQuery, 500);

  React.useEffect(() => {
    if (debouncedSearch && debouncedSearch.length >= 2) {
      setLoading(true);
      searchCities(debouncedSearch, 10)
        .then(results => {
          setCities(results);
          setLoading(false);
        })
        .catch(() => {
          setCities([]);
          setLoading(false);
        });
    } else {
      setCities([]);
    }
  }, [debouncedSearch]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between", className)}
          disabled={disabled}
        >
          {value || placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput
            placeholder="Search for a city..."
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList>
            {loading && (
              <div className="flex items-center justify-center p-4">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            )}
            {!loading && cities.length === 0 && searchQuery.length >= 2 && (
              <CommandEmpty>No cities found.</CommandEmpty>
            )}
            {!loading && searchQuery.length < 2 && (
              <CommandEmpty>Type at least 2 characters to search.</CommandEmpty>
            )}
            <CommandGroup>
              {cities.map((city) => (
                <CommandItem
                  key={city}
                  value={city}
                  onSelect={(selectedValue) => {
                    // CommandItem passes the value as a parameter
                    const finalValue = selectedValue || city;
                    onValueChange(finalValue);
                    setOpen(false);
                    setSearchQuery(finalValue);
                  }}
                  onMouseDown={(e) => {
                    // Prevent any default behavior that might interfere
                    e.preventDefault();
                    onValueChange(city);
                    setOpen(false);
                    setSearchQuery(city);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === city ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {city}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

