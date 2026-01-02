import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface DatalistInputProps {
  value: string;
  onValueChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id: string;
  allowCustom?: boolean;
}

export function DatalistInput({
  value,
  onValueChange,
  options,
  placeholder = "Type or select...",
  disabled = false,
  className,
  id,
  allowCustom = true,
}: DatalistInputProps) {
  const listId = `${id}-list`;

  return (
    <>
      <Input
        id={id}
        type="text"
        list={listId}
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={className}
      />
      <datalist id={listId}>
        {options.map((option) => (
          <option key={option} value={option} />
        ))}
      </datalist>
    </>
  );
}

