import * as React from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface AutocompleteInputProps {
  value: string;
  onValueChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  className?: string;
  maxLength?: number;
}

export function AutocompleteInput({
  value,
  onValueChange,
  options,
  placeholder = "Type or select...",
  emptyMessage = "No results found.",
  disabled = false,
  className,
  maxLength,
}: AutocompleteInputProps) {
  const [open, setOpen] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Filter options based on current value
  const filteredOptions = React.useMemo(() => {
    if (!value) return options;
    const query = value.toLowerCase();
    return options.filter(option =>
      option.toLowerCase().includes(query)
    ).slice(0, 10); // Limit to 10 results
  }, [options, value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = maxLength ? e.target.value.slice(0, maxLength) : e.target.value;
    onValueChange(newValue);
    setOpen(true);
  };

  const handleSelect = React.useCallback((option: string) => {
    onValueChange(option);
    setOpen(false);
  }, [onValueChange]);

  const handleFocus = () => {
    setOpen(true);
  };

  const blurTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    // Clear any existing timeout
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
    }
    
    // Check if focus is moving to the popover
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (relatedTarget?.closest('[role="listbox"]') || 
        relatedTarget?.closest('[role="option"]') ||
        relatedTarget?.closest('[data-radix-popper-content-wrapper]') ||
        relatedTarget?.closest('[data-radix-popover-content]')) {
      // Keep popover open if clicking inside it
      return;
    }
    // Close popover after a delay to allow selection
    blurTimeoutRef.current = setTimeout(() => {
      setOpen(false);
      blurTimeoutRef.current = null;
    }, 250);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className="relative">
        <PopoverTrigger asChild>
          <div className="relative">
            <Input
              ref={inputRef}
              type="text"
              value={value}
              onChange={handleInputChange}
              onFocus={handleFocus}
              onBlur={handleBlur}
              placeholder={placeholder}
              disabled={disabled}
              className={cn("pr-8", className)}
              maxLength={maxLength}
            />
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-50 pointer-events-none" />
          </div>
        </PopoverTrigger>
        {open && filteredOptions.length > 0 && (
          <PopoverContent 
            className="w-[var(--radix-popover-trigger-width)] p-0" 
            align="start"
            onOpenAutoFocus={(e) => e.preventDefault()}
            onInteractOutside={(e) => {
              // Don't close if clicking on the input or inside the popover
              if (e.target === inputRef.current || 
                  inputRef.current?.contains(e.target as Node) ||
                  (e.target as HTMLElement)?.closest('[data-radix-popover-content]')) {
                e.preventDefault();
              }
            }}
          >
            <Command>
              <CommandList>
                <CommandEmpty>{emptyMessage}</CommandEmpty>
                <CommandGroup>
                  {filteredOptions.map((option) => (
                    <CommandItem
                      key={option}
                      value={option}
                      onSelect={() => handleSelect(option)}
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
              </CommandList>
            </Command>
          </PopoverContent>
        )}
      </div>
    </Popover>
  );
}

