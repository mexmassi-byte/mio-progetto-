import type { AnchorHTMLAttributes, MouseEvent } from "react";
import { useGo } from "./Curtain";
import { href } from "../lib/env";

type Props = AnchorHTMLAttributes<HTMLAnchorElement> & { to: string; onNavigate?: () => void };

/** Internal link that plays the curtain transition. */
export function TLink({ to, onNavigate, onClick, children, ...rest }: Props) {
  const go = useGo();
  const handle = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    onNavigate?.();
    go(to);
  };
  return (
    <a href={href(to)} onClick={handle} {...rest}>
      {children}
    </a>
  );
}
