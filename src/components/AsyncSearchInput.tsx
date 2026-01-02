import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useDebounce } from "@/hooks/useDebounce";

interface AsyncSearchInputProps {
  value: string;
  onValueChange: (value: string) => void;
  searchFunction: (query: string) => Promise<string[]>;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id: string;
  minSearchLength?: number;
}

export function AsyncSearchInput({
  value,
  onValueChange,
  searchFunction,
  placeholder = "Type to search...",
  disabled = false,
  className,
  id,
  minSearchLength = 2,
}: AsyncSearchInputProps) {
  const [suggestions, setSuggestions] = React.useState<string[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);
  const [showSuggestions, setShowSuggestions] = React.useState(false);
  const debouncedValue = useDebounce(value, 500);
  const listId = `${id}-list`;
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Perform search when debounced value changes
  React.useEffect(() => {
    if (debouncedValue && debouncedValue.length >= minSearchLength) {
      setIsSearching(true);
      searchFunction(debouncedValue)
        .then((results) => {
          setSuggestions(results);
          setIsSearching(false);
          setShowSuggestions(true);
        })
        .catch(() => {
          setSuggestions([]);
          setIsSearching(false);
        });
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [debouncedValue, searchFunction, minSearchLength]);

  // Close suggestions when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleFocus = () => {
    if (suggestions.length > 0) {
      setShowSuggestions(true);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onValueChange(e.target.value);
    if (e.target.value.length >= minSearchLength) {
      setShowSuggestions(true);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <Input
        id={id}
        type="text"
        list={showSuggestions && suggestions.length > 0 ? listId : undefined}
        value={value}
        onChange={handleChange}
        onFocus={handleFocus}
        placeholder={placeholder}
        disabled={disabled}
        className={className}
      />
      {showSuggestions && suggestions.length > 0 && (
        <datalist id={listId}>
          {suggestions.map((suggestion) => (
            <option key={suggestion} value={suggestion} />
          ))}
        </datalist>
      )}
      {isSearching && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
          Searching...
        </div>
      )}
    </div>
  );
}

