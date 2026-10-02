import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  // The pill radius is what signals "this is an action", and the press scale is
  // the one micro-interaction every control shares. No shadows: a button is
  // defined by its fill, not by floating above the page.
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-pill text-body-sm font-normal ring-offset-background transition-[color,background-color,border-color,transform] duration-150 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-40 disabled:active:scale-100 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary-hover",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        // A ghost pill: the accent drawn as an outline rather than a fill, so
        // two CTAs can sit together without competing.
        outline:
          "border border-primary/40 bg-transparent text-primary hover:border-primary hover:bg-primary/5",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary-hover",
        ghost: "rounded-utility hover:bg-accent hover:text-accent-foreground",
        link: "rounded-none text-primary underline-offset-4 hover:underline active:scale-100",
        // Compact utility actions keep the smaller radius; they are chrome, not
        // the page's call to action.
        utility:
          "rounded-utility bg-foreground text-background text-caption hover:bg-foreground/90",
        premium: "bg-primary text-primary-foreground hover:bg-primary-hover",
        hero: "bg-primary text-primary-foreground hover:bg-primary-hover",
      },
      size: {
        default: "h-11 px-6 py-2",
        sm: "h-9 px-4 text-caption",
        lg: "h-12 px-8",
        xl: "h-14 px-9 text-body font-semibold",
        icon: "h-10 w-10 rounded-utility",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
