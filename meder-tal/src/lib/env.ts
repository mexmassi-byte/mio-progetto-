// The single-file build runs from disk (file://), where only hash routing works.
export const HASH_ROUTING = import.meta.env.MODE === "single" || location.protocol === "file:";
export const href = (to: string) => (HASH_ROUTING ? `#${to}` : to);
