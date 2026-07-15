(function () {
  'use strict';

  // 1. Queue initialization & setup for robust Next.js integration
  if (typeof window !== 'undefined') {
    window.sppQueue = window.sppQueue || [];
  }

  // Dynamic configuration resolver (bypasses document.currentScript to support Next.js script load)
  function getConfigs() {
    if (typeof document === 'undefined') {
      return { apiKey: '', apiUrl: 'https://api.spplabs.es', autoTrack: true };
    }
    const tag = document.querySelector('script[data-api-key]');
    if (!tag) {
      return { apiKey: '', apiUrl: 'https://api.spplabs.es', autoTrack: true };
    }

    const key = tag.getAttribute('data-api-key') || '';
    let defaultUrl = 'https://api.spplabs.es';
    try {
      if (tag.src) {
        defaultUrl = new URL(tag.src, window.location.href).origin;
      }
    } catch (e) {}

    const url = tag.getAttribute('data-api-url') || defaultUrl;
    const track = tag.getAttribute('data-auto-track') !== 'false';
    return { apiKey: key, apiUrl: url, autoTrack: track };
  }

  // Cookie Helpers for Visitor ID (Persistent for 1 year)
  function getCookie(name) {
    if (typeof document === 'undefined') return null;
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
  }

  function setCookie(name, value, days) {
    if (typeof document === 'undefined') return;
    const date = new Date();
    date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
    const expires = `; expires=${date.toUTCString()}`;
    document.cookie = `${name}=${value || ''}${expires}; path=/; SameSite=Lax; Secure`;
  }

  // Helper to generate a random UUID
  function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  // Persistent Visitor ID & Session ID (30m inactivity expiry)
  let visitorId = getCookie('spp_visitor_id');
  if (!visitorId && typeof window !== 'undefined') {
    visitorId = generateUUID();
    setCookie('spp_visitor_id', visitorId, 365);
  }

  function getOrUpdateSession() {
    if (typeof window === 'undefined') return '';
    const now = Date.now();
    let sessionId = localStorage.getItem('spp_session_id');
    const lastActivity = localStorage.getItem('spp_session_last_activity');

    if (!sessionId || !lastActivity || now - parseInt(lastActivity, 10) > 1800000) {
      sessionId = generateUUID();
      localStorage.setItem('spp_session_id', sessionId);
      trackEvent('session_start', {}, sessionId);
    }

    localStorage.setItem('spp_session_last_activity', now.toString());
    return sessionId;
  }

  const sessionStartTime = typeof Date !== 'undefined' ? Date.now() : 0;
  let maxScrollPercent = 0;

  if (typeof window !== 'undefined') {
    window.addEventListener('scroll', function () {
      const h = document.documentElement;
      const b = document.body;
      const st = 'scrollTop';
      const sh = 'scrollHeight';
      const percent = Math.round(((h[st] || b[st]) / ((h[sh] || b[sh]) - h.clientHeight)) * 100);
      if (percent > maxScrollPercent) {
        maxScrollPercent = Math.min(100, Math.max(0, percent));
      }
    }, { passive: true });
  }

  // 2. Offline queue and exponential backoff retry logic
  let retryQueue = [];
  let isProcessingQueue = false;
  let backoffDelay = 1000; // starts at 1 second

  function loadQueue() {
    try {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('spp_analytics_queue');
        retryQueue = stored ? JSON.parse(stored) : [];
      }
    } catch (e) {
      console.error('[SPP Analytics] Failed to load offline queue:', e);
    }
  }

  function saveQueue() {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('spp_analytics_queue', JSON.stringify(retryQueue));
      }
    } catch (e) {
      console.error('[SPP Analytics] Failed to save offline queue:', e);
    }
  }

  async function processQueue() {
    if (isProcessingQueue || retryQueue.length === 0) return;
    isProcessingQueue = true;

    const { apiKey, apiUrl } = getConfigs();

    if (!apiKey) {
      console.warn('[SPP Analytics] Processing delayed: API key is not ready.');
      isProcessingQueue = false;
      return;
    }

    while (retryQueue.length > 0) {
      const event = retryQueue[0];
      console.log(`[SPP Analytics Log] Attempting to send event: ${event.event_type} (${retryQueue.length - 1} remaining in queue)`);

      try {
        const response = await fetch(`${apiUrl}/api/analytics`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
          },
          body: JSON.stringify(event),
          keepalive: true,
        });

        if (response.ok) {
          // Success! Remove from queue, reset backoff
          retryQueue.shift();
          saveQueue();
          backoffDelay = 1000;
          console.log(`[SPP Analytics Log] Event '${event.event_type}' sent successfully.`);
        } else if (response.status >= 400 && response.status < 500) {
          // Permanent failure (invalid payload or keys), discard to prevent infinite loop
          console.error(`[SPP Analytics Error] Discarding permanent failure request (HTTP ${response.status}) for event '${event.event_type}'.`);
          retryQueue.shift();
          saveQueue();
        } else {
          // Server error (5xx) or transient error, keep in queue and trigger backoff
          throw new Error(`Server returned status code: ${response.status}`);
        }
      } catch (err) {
        // Connection error or server issue - trigger exponential backoff retry
        console.warn(`[SPP Analytics Warning] Transient transfer failure for event '${event.event_type}'. Retrying in ${backoffDelay}ms. Details:`, err);
        isProcessingQueue = false;
        setTimeout(processQueue, backoffDelay);
        backoffDelay = Math.min(60000, backoffDelay * 2); // cap at 60s
        return;
      }
    }

    isProcessingQueue = false;
  }

  // 3. Main event tracking function
  function trackEvent(eventType, customData = {}, sessionOverride = null) {
    if (typeof window === 'undefined') return;

    const { apiKey } = getConfigs();
    if (!apiKey) {
      console.warn('[SPP Analytics] Script configuration is not loaded. Event tracking suspended.');
      return;
    }

    const sessionId = sessionOverride || getOrUpdateSession();
    const urlParams = new URLSearchParams(window.location.search);

    const payload = {
      event_type: eventType,
      visitor_id: visitorId,
      session_id: sessionId,
      page_url: window.location.pathname,
      page_title: document.title,
      referrer: document.referrer || '',
      screen_width: window.innerWidth || document.documentElement.clientWidth,
      screen_height: window.innerHeight || document.documentElement.clientHeight,
      utm_source: urlParams.get('utm_source') || '',
      utm_medium: urlParams.get('utm_medium') || '',
      utm_campaign: urlParams.get('utm_campaign') || '',
      utm_term: urlParams.get('utm_term') || '',
      utm_content: urlParams.get('utm_content') || '',
      duration_ms: Math.round(Date.now() - sessionStartTime),
      scroll_percent: maxScrollPercent,
      conversion: customData.conversion ? 1 : 0,
      button_name: customData.button_name || '',
      form_name: customData.form_name || '',
      booking_id: customData.booking_id || ''
    };

    // Queue the event to guarantee persistent delivery
    retryQueue.push(payload);
    saveQueue();
    
    // Process queue
    processQueue();
  }

  // Load any previously unsent events on startup
  loadQueue();

  // 4. Expose globally & drain pre-load window.sppQueue
  if (typeof window !== 'undefined') {
    const originalSppQueue = window.sppQueue || [];

    // Redefine window.sppTrack to process events directly
    window.sppTrack = function (eventType, customData) {
      trackEvent(eventType, customData);
    };

    // Process queued events
    if (originalSppQueue.length > 0) {
      console.log(`[SPP Analytics] Draining ${originalSppQueue.length} pre-load queued events.`);
      originalSppQueue.forEach(function (args) {
        trackEvent.apply(null, args);
      });
      window.sppQueue = [];
    }

    // 5. Automatic click interaction listeners
    window.addEventListener('click', function (e) {
      const link = e.target.closest('a');
      const button = e.target.closest('button') || e.target.closest('input[type="submit"]');

      if (link) {
        const href = link.getAttribute('href') || '';
        const linkText = (link.innerText || link.getAttribute('title') || href).trim();

        if (href.startsWith('tel:')) {
          trackEvent('phone_click', { button_name: linkText, conversion: true });
        } else if (href.startsWith('mailto:')) {
          trackEvent('email_click', { button_name: linkText, conversion: true });
        } else if (href.includes('wa.me') || href.includes('api.whatsapp.com') || href.includes('whatsapp.com/send')) {
          trackEvent('whatsapp_click', { button_name: linkText, conversion: true });
        } else if (href.startsWith('http') && !href.includes(window.location.hostname)) {
          trackEvent('outbound_link', { button_name: linkText });
        } else if (href.match(/\.(zip|pdf|docx|xlsx|tar|gz|mp3|mp4|exe)$/i)) {
          trackEvent('download', { button_name: linkText });
        }
      } else if (button) {
        const btnText = (button.innerText || button.getAttribute('value') || button.getAttribute('name') || 'button').trim();
        trackEvent('button_click', { button_name: btnText });
      }
    });

    // Form Submission tracking
    window.addEventListener('submit', function (e) {
      const form = e.target;
      const formName = form.getAttribute('name') || form.getAttribute('id') || 'form_submission';
      trackEvent('form_submit', { form_name: formName });
    });

    // Page unload / visibility change end logging
    window.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') {
        trackEvent('session_end');
      }
    });

    // Process queue immediately on start
    processQueue();

    // 6. Automatic initial page_view for standard HTML sites
    const config = getConfigs();
    if (config.autoTrack) {
      if (document.readyState === 'complete') {
        trackEvent('page_view');
      } else {
        window.addEventListener('load', function () {
          trackEvent('page_view');
        });
      }
    }
  }

})();
