(function () {
  'use strict';

  // 1. Script configurations
  const scriptTag = document.currentScript || document.querySelector('script[data-api-key]');
  if (!scriptTag) {
    console.warn('[SPP Analytics] Tracker script tags must define data-api-key.');
    return;
  }

  const apiKey = scriptTag.getAttribute('data-api-key');
  let defaultApiUrl = 'https://api.spplabs.es';
  try {
    if (scriptTag && scriptTag.src) {
      defaultApiUrl = new URL(scriptTag.src, window.location.href).origin;
    }
  } catch (e) {}
  const apiUrl = scriptTag.getAttribute('data-api-url') || defaultApiUrl;

  if (!apiKey) {
    console.warn('[SPP Analytics] Missing API Key. Event tracking disabled.');
    return;
  }

  // 2. Cookie Helpers for Visitor ID (Persistent for 1 year)
  function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
  }

  function setCookie(name, value, days) {
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

  // 3. Persistent Visitor ID & Session ID (30m inactivity expiry)
  let visitorId = getCookie('spp_visitor_id');
  if (!visitorId) {
    visitorId = generateUUID();
    setCookie('spp_visitor_id', visitorId, 365); // 1 year expiry
  }

  function getOrUpdateSession() {
    const now = Date.now();
    let sessionId = localStorage.getItem('spp_session_id');
    const lastActivity = localStorage.getItem('spp_session_last_activity');

    // 30 minutes in milliseconds = 1800000
    if (!sessionId || !lastActivity || now - parseInt(lastActivity, 10) > 1800000) {
      sessionId = generateUUID();
      localStorage.setItem('spp_session_id', sessionId);
      trackEvent('session_start', {}, sessionId);
    }

    localStorage.setItem('spp_session_last_activity', now.toString());
    return sessionId;
  }

  // 4. Session Duration and Scroll Percent tracking state
  const sessionStartTime = Date.now();
  let maxScrollPercent = 0;

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

  // 5. Ingest event sender
  function trackEvent(eventType, customData = {}, sessionOverride = null) {
    const sessionId = sessionOverride || getOrUpdateSession();
    
    // Parse URL queries for UTMs
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

    // Use keepalive: true to ensure requests complete even if page unloads
    fetch(`${apiUrl}/api/analytics`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(function (err) {
      console.error('[SPP Analytics] Failed to send event:', err);
    });
  }

  // 6. Automatic Route Tracking (For Single Page Apps / History API)
  let lastPathname = window.location.pathname;
  
  // Hook history pushState
  const originalPushState = history.pushState;
  if (originalPushState) {
    history.pushState = function () {
      originalPushState.apply(this, arguments);
      if (window.location.pathname !== lastPathname) {
        lastPathname = window.location.pathname;
        trackEvent('page_view');
      }
    };
  }

  // Hook history replaceState
  const originalReplaceState = history.replaceState;
  if (originalReplaceState) {
    history.replaceState = function () {
      originalReplaceState.apply(this, arguments);
      if (window.location.pathname !== lastPathname) {
        lastPathname = window.location.pathname;
        trackEvent('page_view');
      }
    };
  }

  // Handle popstate (back/forward navigation)
  window.addEventListener('popstate', function () {
    if (window.location.pathname !== lastPathname) {
      lastPathname = window.location.pathname;
      trackEvent('page_view');
    }
  });

  // Track initial page view on script execution
  if (document.readyState === 'complete') {
    trackEvent('page_view');
  } else {
    window.addEventListener('load', function () {
      trackEvent('page_view');
    });
  }

  // 7. Interactive click listeners (Buttons, outbound links, phone, email, whatsapp)
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
        // Outbound links
        trackEvent('outbound_link', { button_name: linkText });
      } else if (href.match(/\.(zip|pdf|docx|xlsx|tar|gz|mp3|mp4|exe)$/i)) {
        // File downloads
        trackEvent('download', { button_name: linkText });
      }
    } else if (button) {
      const btnText = (button.innerText || button.getAttribute('value') || button.getAttribute('name') || 'button').trim();
      trackEvent('button_click', { button_name: btnText });
    }
  });

  // 8. Form Submission tracking
  window.addEventListener('submit', function (e) {
    const form = e.target;
    const formName = form.getAttribute('name') || form.getAttribute('id') || 'form_submission';
    trackEvent('form_submit', { form_name: formName });
  });

  // 9. Page unload session end logging
  window.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') {
      trackEvent('session_end');
    }
  });

  // Expose trackEvent globally so users can call window.sppTrack('custom_event', { ... })
  window.sppTrack = function (eventType, customData) {
    trackEvent(eventType, customData);
  };

})();
