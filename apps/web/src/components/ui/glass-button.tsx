import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { cn } from '@/lib/utils';

const glassButtonVariants = cva(
  'ripple glass-button relative inline-flex items-center justify-center overflow-hidden rounded-lg font-semibold text-sm backdrop-blur-md transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default:
          'border-periwinkle/30 bg-periwinkle/20 text-foreground hover:bg-periwinkle/30',
        secondary:
          'border-light-green/30 bg-light-green/20 text-foreground hover:bg-light-green/30',
        ghost:
          'border-2 border-transparent hover:bg-accent hover:text-accent-foreground',
        outline:
          'border-2 border-border bg-background/50 hover:border-accent hover:bg-accent',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3',
        lg: 'h-11 rounded-md px-8',
        icon: 'h-10 w-10',
      },
      glow: {
        true: 'shadow-[0_0_15px_rgba(153,153,255,0.5)] hover:shadow-[0_0_25px_rgba(153,153,255,0.7)]',
        false: '',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
      glow: false,
    },
  }
);

export interface GlassButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof glassButtonVariants> {
  asChild?: boolean;
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
    );
  }
);
GlassButton.displayName = 'GlassButton';

export { GlassButton, glassButtonVariants };
