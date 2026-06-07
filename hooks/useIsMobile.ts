// hooks/useIsMobile.ts
'use client';
import { useState, useEffect } from 'react';

/**
 * Returns true when the viewport width is below the given breakpoint.
 * Defaults to false on the server (SSR-safe).
 */
export function useIsMobile(breakpoint = 768): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < breakpoint);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, [breakpoint]);

  return isMobile;
}
