/**
 * Tiny className combiner — joins truthy class fragments with a space.
 * Keeps components dependency-free while staying ergonomic.
 */
export type ClassValue = string | number | false | null | undefined

export function cn(...classes: ClassValue[]): string {
  return classes.filter(Boolean).join(' ')
}
