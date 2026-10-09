import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Merge Tailwind classes so a caller's override wins over a component
 * default of the same property (`class="h-10"` beats the built-in `h-9`)
 * without `!important` and without ordering luck.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
