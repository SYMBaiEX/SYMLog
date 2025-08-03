import * as React from "react"
import { cn } from "@/lib/utils"
import { type VariantProps, cva } from "class-variance-authority"

const glassButtonVariants = cva(
  "inline-flex items-center justify-center rounded-lg text-sm font-medium transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-periwinkle focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ripple glass-button relative overflow-hidden",
  {
    variants: {
      variant: {
        default: "bg-periwinkle/20 text-white hover:bg-periwinkle/30 border-periwinkle/30",
        secondary: "bg-light-green/20 text-white hover:bg-light-green/30 border-light-green/30",
        ghost: "hover:bg-white/10 hover:text-white",
        outline: "border border-white/20 bg-transparent hover:bg-white/10",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
      glow: {
        true: "shadow-[0_0_15px_rgba(153,153,255,0.5)] hover:shadow-[0_0_25px_rgba(153,153,255,0.7)]",
        false: "",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
      glow: false,
    },
  }
)

export interface GlassButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof glassButtonVariants> {
  asChild?: boolean
}

const GlassButton = React.forwardRef<HTMLButtonElement, GlassButtonProps>(
  ({ className, variant, size, glow, children, ...props }, ref) => {
    return (
      <button
        className={cn(glassButtonVariants({ variant, size, glow, className }))}
        ref={ref}
        {...props}
      >
        <span className="relative z-10">{children}</span>
        <span className="absolute inset-0 rounded-lg bg-gradient-to-tr from-transparent via-white/10 to-transparent opacity-0 transition-opacity duration-300 hover:opacity-100" />
      </button>
    )
  }
)
GlassButton.displayName = "GlassButton"

export { GlassButton, glassButtonVariants }