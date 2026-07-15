'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';

// Safely initialize the tracking queue on the window object before tracker.js loads.
// This prevents race conditions and ensures early pageviews are queued and not lost.
if (typeof window !== 'undefined') {
  window.sppQueue = window.sppQueue || [];
  window.sppTrack = window.sppTrack || function (...args) {
    window.sppQueue.push(args);
  };
}

export default function AnalyticsTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Record page view on initial load and on every Next.js client-side route navigation.
    if (typeof window !== 'undefined' && window.sppTrack) {
      window.sppTrack('page_view');
    }
  }, [pathname, searchParams]);

  return null;
}
