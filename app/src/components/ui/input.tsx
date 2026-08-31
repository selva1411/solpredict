import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "num h-9 w-full min-w-0 rounded-[2px] border border-hairline bg-transparent px-3 py-1 text-[15px] transition-colors duration-150 ease-[cubic-bezier(.22,.61,.36,1)] outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-[13px] file:font-medium file:text-foreground placeholder:text-ash-dim focus-visible:border-gold/60 focus-visible:ring-2 focus-visible:ring-gold/25 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-bordeaux aria-invalid:ring-2 aria-invalid:ring-bordeaux/20 md:text-[13px]",
        className
      )}
      {...props}
    />
  )
}

export { Input }