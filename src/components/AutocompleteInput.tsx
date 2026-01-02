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
  const [inputValue, setInputValue] = React.useState(value);

  // Update input value when prop changes
  React.useEffect(() => {
    setInputValue(value);
  }, [value]);

  // Filter options based on input value
  const filteredOptions = React.useMemo(() => {
    if (!inputValue) return options;
    const query = inputValue.toLowerCase();
    return options.filter(option =>
      option.toLowerCase().includes(query)
    ).slice(0, 10); // Limit to 10 results
  }, [options, inputValue]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = maxLength ? e.target.value.slice(0, maxLength) : e.target.value;
    setInputValue(newValue);
    onValueChange(newValue);
    setOpen(true);
  };

  const handleSelect = (option: string) => {
    setInputValue(option);
    onValueChange(option);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className="relative">
        <PopoverTrigger asChild>
          <div className="relative">
            <Input
              type="text"
              value={inputValue}
              onChange={handleInputChange}
              onFocus={() => setOpen(true)}
              onBlur={() => {
                // Delay closing to allow selection
                setTimeout(() => setOpen(false), 200);
              }}
              placeholder={placeholder}
              disabled={disabled}
              className={cn("pr-8", className)}
              maxLength={maxLength}
            />
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-50 pointer-events-none" />
          </div>
        </PopoverTrigger>
        {filteredOptions.length > 0 && (
          <PopoverContent 
            className="w-[var(--radix-popover-trigger-width)] p-0" 
            align="start"
            onOpenAutoFocus={(e) => e.preventDefault()}
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

