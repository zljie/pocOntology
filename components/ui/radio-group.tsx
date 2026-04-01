"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type RadioGroupContextValue = {
  value: string | undefined;
  name: string;
  disabled?: boolean;
  onValueChange?: (value: string) => void;
};

const RadioGroupContext = React.createContext<RadioGroupContextValue | null>(
  null
);

export interface RadioGroupProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "onChange"> {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  name?: string;
  disabled?: boolean;
}

export function RadioGroup({
  className,
  value: valueProp,
  defaultValue,
  onValueChange,
  name,
  disabled,
  ...props
}: RadioGroupProps) {
  const [uncontrolledValue, setUncontrolledValue] = React.useState<
    string | undefined
  >(defaultValue);

  const isControlled = valueProp !== undefined;
  const value = isControlled ? valueProp : uncontrolledValue;
  const groupName = React.useMemo(
    () => name ?? `rg-${Math.random().toString(36).slice(2)}`,
    [name]
  );

  const handleValueChange = React.useCallback(
    (next: string) => {
      if (!isControlled) setUncontrolledValue(next);
      onValueChange?.(next);
    },
    [isControlled, onValueChange]
  );

  return (
    <RadioGroupContext.Provider
      value={{ value, name: groupName, disabled, onValueChange: handleValueChange }}
    >
      <div className={cn("grid gap-2", className)} {...props} />
    </RadioGroupContext.Provider>
  );
}

export interface RadioGroupItemProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "onChange"> {
  value: string;
}

export const RadioGroupItem = React.forwardRef<HTMLInputElement, RadioGroupItemProps>(
  ({ className, value, disabled, id, ...props }, ref) => {
    const ctx = React.useContext(RadioGroupContext);
    if (!ctx) {
      return (
        <input
          ref={ref}
          type="radio"
          id={id}
          disabled={disabled}
          className={cn(
            "h-4 w-4 rounded-full border border-input bg-background accent-[#3B82F6] disabled:cursor-not-allowed disabled:opacity-50",
            className
          )}
          value={value}
          {...props}
        />
      );
    }

    const checked = ctx.value === value;
    const isDisabled = ctx.disabled || disabled;

    return (
      <input
        ref={ref}
        type="radio"
        id={id}
        name={ctx.name}
        disabled={isDisabled}
        checked={checked}
        onChange={() => ctx.onValueChange?.(value)}
        className={cn(
          "h-4 w-4 rounded-full border border-input bg-background accent-[#3B82F6] disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        value={value}
        {...props}
      />
    );
  }
);
RadioGroupItem.displayName = "RadioGroupItem";

