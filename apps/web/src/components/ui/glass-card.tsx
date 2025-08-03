import * as React from "react"
import { cn } from "@/lib/utils"

export interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  blur?: "sm" | "md" | "lg" | "xl"
  hover?: boolean
  glow?: "periwinkle" | "green" | "none"
  variant?: "default" | "dark"
}

const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, blur = "lg", hover = true, glow = "none", variant = "default", children, ...props }, ref) => {
    const blurClass = {
      sm: "backdrop-blur-sm",
      md: "backdrop-blur-md",
      lg: "backdrop-blur-lg",
      xl: "backdrop-blur-xl",
    }[blur]

    const glowClass = {
      periwinkle: "glow-periwinkle",
      green: "glow-green",
      none: "",
    }[glow]

    const variantClass = {
      default: "glass",
      dark: "glass-dark",
    }[variant]

    return (
      <div
        ref={ref}
        className={cn(
          variantClass,
          blurClass,
          "rounded-xl p-6 transition-all duration-300",
          hover && "hover-lift",
          glowClass,
          "glass-shadow",
          className
        )}
        {...props}
      >
        {children}
      </div>
    )
  }
)
GlassCard.displayName = "GlassCard"

export { GlassCard }