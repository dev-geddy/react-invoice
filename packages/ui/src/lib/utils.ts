import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/** Class-merge helper (clsx + tailwind-merge). @spec L2-UI-02 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
