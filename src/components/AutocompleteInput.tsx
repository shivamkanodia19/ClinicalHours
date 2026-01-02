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
  const containerRef = React.useRef<HTMLDivElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

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
    inputRef.current?.focus();
  }, [onValueChange]);

  const handleFocus = () => {
    if (filteredOptions.length > 0) {
      setOpen(true);
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    // Check if focus is moving to the dropdown list
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (relatedTarget && (
      listRef.current?.contains(relatedTarget) ||
      containerRef.current?.contains(relatedTarget)
    )) {
      // Keep dropdown open if clicking inside it
      return;
    }
    // Close dropdown after a short delay
    setTimeout(() => {
      setOpen(false);
    }, 200);
  };

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node) &&
        !listRef.current?.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [open]);

  return (
    <div ref={containerRef} className="relative w-full">
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
      {open && filteredOptions.length > 0 && (
        <div
          ref={listRef}
          className="absolute z-50 w-full mt-1 rounded-md border bg-popover text-popover-foreground shadow-md"
          onMouseDown={(e) => {
            // Prevent input from losing focus when clicking on dropdown
            e.preventDefault();
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
        </div>
      )}
    </div>
  );
}
