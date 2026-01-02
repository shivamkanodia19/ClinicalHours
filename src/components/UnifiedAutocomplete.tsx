import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
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

interface UnifiedAutocompleteProps {
  value: string;
  onValueChange: (value: string) => void;
  options?: string[]; // Static options
  searchFunction?: (query: string) => Promise<string[]>; // Async search function
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  className?: string;
  allowCustom?: boolean; // Allow typing custom values not in the list
}

export function UnifiedAutocomplete({
  value,
  onValueChange,
  options = [],
  searchFunction,
  placeholder = "Select...",
  searchPlaceholder = "Search...",
  emptyMessage = "No results found.",
  disabled = false,
  className,
  allowCustom = false,
}: UnifiedAutocompleteProps) {
  const [open, setOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [searchResults, setSearchResults] = React.useState<string[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);

  // Use static options or search results
  const displayOptions = React.useMemo(() => {
    if (searchFunction) {
      return searchResults;
    }
    // Filter static options based on search query
    if (!searchQuery) return options;
    const query = searchQuery.toLowerCase();
    return options.filter(option =>
      option.toLowerCase().includes(query)
    );
  }, [options, searchQuery, searchResults, searchFunction]);

  // Handle async search
  React.useEffect(() => {
    if (searchFunction && searchQuery && searchQuery.length >= 2) {
      setIsSearching(true);
      searchFunction(searchQuery)
        .then(results => {
          setSearchResults(results);
          setIsSearching(false);
        })
        .catch(() => {
          setSearchResults([]);
          setIsSearching(false);
        });
    } else if (searchFunction) {
      setSearchResults([]);
    }
  }, [searchQuery, searchFunction]);

  // Reset search when popover closes
  React.useEffect(() => {
    if (!open) {
      setSearchQuery("");
      setSearchResults([]);
    }
  }, [open]);

  const handleSelect = React.useCallback((selectedValue: string, option: string) => {
    // CommandItem may pass a transformed value, so use the actual option
    const valueToSet = option || selectedValue;
    onValueChange(valueToSet);
    setOpen(false);
    setSearchQuery("");
  }, [onValueChange]);

  const handleCustomValue = () => {
    if (allowCustom && searchQuery && !displayOptions.includes(searchQuery)) {
      onValueChange(searchQuery);
      setOpen(false);
      setSearchQuery("");
    }
  };

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
      <PopoverContent 
        className="w-[var(--radix-popover-trigger-width)] p-0" 
        align="start"
      >
        <Command>
          <CommandInput
            placeholder={searchPlaceholder}
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList>
            {isSearching && (
              <div className="flex items-center justify-center p-4">
                <div className="text-sm text-muted-foreground">Searching...</div>
              </div>
            )}
            {!isSearching && displayOptions.length === 0 && searchQuery && (
              <CommandEmpty>
                {allowCustom ? (
                  <div className="py-2">
                    <p className="text-sm text-muted-foreground mb-2">{emptyMessage}</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCustomValue}
                      className="w-full"
                    >
                      Use "{searchQuery}"
                    </Button>
                  </div>
                ) : (
                  emptyMessage
                )}
              </CommandEmpty>
            )}
            {!isSearching && searchQuery.length < 2 && searchFunction && (
              <CommandEmpty>Type at least 2 characters to search.</CommandEmpty>
            )}
            {displayOptions.length > 0 && (
              <CommandGroup>
                {displayOptions.map((option) => (
                  <CommandItem
                    key={option}
                    value={option}
                    onSelect={(selectedValue) => {
                      // Use the option directly to ensure correct value
                      onValueChange(option);
                      setOpen(false);
                      setSearchQuery("");
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === option ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {option}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

