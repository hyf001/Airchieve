import * as React from "react"
import { cn } from "@/lib/utils"
import { Check } from "lucide-react"

export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ checked, onCheckedChange, className, disabled, id, ...props }, ref) => (
    <button
      ref={ref as any}
      type="button"
      role="checkbox"
      aria-checked={checked}
      disabled={disabled}
      id={id}
      onClick={() => onCheckedChange?.(!checked)}
      className={cn(
        "peer h-4 w-4 shrink-0 rounded-[4px] border border-slate-300 transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00CDD4]/30 focus-visible:ring-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-50",
        checked && "border-[#00CDD4] bg-[#00CDD4] text-white",
        className
      )}
    >
      {checked && <Check size={12} strokeWidth={3} className="text-white" />}
    </button>
  )
)
Checkbox.displayName = "Checkbox"

export { Checkbox }
