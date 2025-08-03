import * as React from "react"
import { cn } from "@/lib/utils"
import { type VariantProps, cva } from "class-variance-authority"

const glassButtonVariants = cva(
  "inline-flex items-center justify-center rounded-lg text-sm font-semibold transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 ripple glass-button relative overflow-hidden backdrop-blur-md",
  {
    variants: {
      variant: {
        default: "bg-periwinkle/20 text-foreground hover:bg-periwinkle/30 border-periwinkle/30",
        secondary: "bg-light-green/20 text-foreground hover:bg-light-green/30 border-light-green/30",
        ghost: "hover:bg-accent hover:text-accent-foreground border-2 border-transparent",
        outline: "border-2 border-border bg-background/50 hover:bg-accent hover:border-accent",
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