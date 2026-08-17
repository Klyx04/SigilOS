import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-foreground hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline:
          "border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost:
          "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
        link: "text-primary underline-offset-4 hover:underline",
        sigil: "group relative bg-gradient-to-br from-warning to-warning text-warning-foreground font-bold overflow-hidden   border-t border-border-strong active:scale-95 transition-all duration-300 uppercase tracking-wide",
        "sigil-emerald": "group relative bg-gradient-to-br from-success to-success text-success-foreground font-bold overflow-hidden   border-t border-border-strong active:scale-95 transition-all duration-300 uppercase tracking-wide",
        "sigil-destructive": "group relative bg-gradient-to-br from-danger to-danger text-danger-foreground font-bold overflow-hidden   border-t border-border-strong active:scale-95 transition-all duration-300 uppercase tracking-wide",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        xs: "h-6 gap-1 rounded-md px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        xl: "h-12 rounded-xl px-10 text-base",
        icon: "size-9",
        "icon-xs": "size-6 rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  children,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"
  const isSigil = variant && (variant as string).startsWith("sigil")

  const shimmer = isSigil ? (
    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-300 ease-in-out pointer-events-none" />
  ) : null
  const pulse = isSigil ? (
    <div className="w-1.5 h-1.5 rounded-full bg-background animate-pulse  shrink-0" />
  ) : null

  if (asChild) {
    const child = React.isValidElement(children) ? children : null;
    
    if (!child) return null;

    return (
      <Slot
        data-slot="button"
        data-variant={variant}
        data-size={size}
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      >
        {isSigil ? React.cloneElement(child as any, {
          children: (
            <>
              {shimmer}
              {(child as any).props.children}
              {pulse}
            </>
          )
        }) : child}
      </Slot>
    )
  }

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    >
      {shimmer}
      {children}
      {pulse}
    </Comp>
  )
}

export { Button, buttonVariants }
