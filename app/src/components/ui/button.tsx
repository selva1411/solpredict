import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-[2px] border border-transparent bg-clip-padding text-[13px] font-medium whitespace-nowrap transition-all duration-150 ease-[cubic-bezier(.22,.61,.36,1)] outline-none select-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-void focus-visible:outline-none active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-bordeaux aria-invalid:ring-2 aria-invalid:ring-bordeaux/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-gold text-void hover:bg-gold-lite",
        outline:
          "border-hairline bg-transparent text-ivory hover:border-gold-deep hover:text-gold-lite aria-expanded:border-gold-deep aria-expanded:text-gold-lite",
        secondary:
          "bg-panel-2 text-ivory hover:bg-hairline-2 aria-expanded:bg-hairline-2",
        ghost:
          "text-ash hover:bg-hairline/60 hover:text-ivory aria-expanded:bg-hairline/60 aria-expanded:text-ivory",
        destructive:
          "bg-bordeaux/10 text-bordeaux hover:bg-bordeaux/20 focus-visible:border-bordeaux/40 focus-visible:ring-bordeaux/20",
        link: "text-gold underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-6 gap-1 rounded-[min(var(--radius-data),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-[2px] has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-[min(var(--radius-data),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-[2px] has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        icon: "size-8",
        "icon-xs":
          "size-6 rounded-[min(var(--radius-data),10px)] in-data-[slot=button-group]:rounded-[2px] [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-7 rounded-[min(var(--radius-data),12px)] in-data-[slot=button-group]:rounded-[2px]",
        "icon-lg": "size-9",
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
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }