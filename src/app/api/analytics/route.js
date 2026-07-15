import { NextResponse } from 'next/server';
import { db } from '../../../lib/db';
import { insertEvent } from '../../../lib/clickhouse';
import crypto from 'crypto';

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-api-key',
    },
  });
}

// Simple lightweight regex-based User-Agent parser
function parseUserAgent(userAgent) {
  const ua = userAgent || '';
  let device_type = 'desktop';
  let os = 'Unknown';
  let browser = 'Unknown';

  if (/ipad|tablet|playbook|silk/i.test(ua)) {
    device_type = 'tablet';
  } else if (/mobile|iphone|ipod|android/i.test(ua)) {
    device_type = 'mobile';
  }

  if (/windows/i.test(ua)) {
    os = 'Windows';
  } else if (/iphone|ipad|ipod/i.test(ua)) {
    os = 'iOS';
  } else if (/macintosh|mac os x/i.test(ua)) {
    os = 'macOS';
  } else if (/android/i.test(ua)) {
    os = 'Android';
  } else if (/linux/i.test(ua)) {
    os = 'Linux';
  }

  if (/edg/i.test(ua)) {
    browser = 'Edge';
  } else if (/chrome|crios/i.test(ua)) {
    // Check if chrome is not actually Edge/Opera
    if (!/edg/i.test(ua) && !/opr/i.test(ua)) {
      browser = 'Chrome';
    }
  } else if (/firefox|fxios/i.test(ua)) {
    browser = 'Firefox';
  } else if (/safari/i.test(ua)) {
    if (!/chrome|crios/i.test(ua)) {
      browser = 'Safari';
    }
  }

  return { device_type, os, browser };
}

// Sliding window rate limiter states
const ipCache = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 120;   // Maximum of 120 analytics POST hits per IP per minute

const EVENT_ALLOWLIST = new Set([
  'page_view',
  'session_start',
  'session_end',
  'button_click',
  'form_submit',
  'booking_created',
  'phone_click',
  'email_click',
  'whatsapp_click',
  'download',
  'video_start',
  'video_complete',
  'scroll',
  'outbound_link'
]);

function isRateLimited(ip) {
  const now = Date.now();
  if (!ipCache.has(ip)) {
    ipCache.set(ip, []);
  }

  const timestamps = ipCache.get(ip);
  // Clean timestamps older than current window
  const activeTimestamps = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
  
  if (activeTimestamps.length >= MAX_REQUESTS_PER_WINDOW) {
    return true;
  }

  activeTimestamps.push(now);
  ipCache.set(ip, activeTimestamps);
  return false;
}

export async function POST(request) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-api-key',
  };

  // Obtain IP address early for rate limiting
  const rawIp = request.headers.get('x-forwarded-for')?.split(',')[0].trim() 
    || request.headers.get('x-real-ip') 
    || '127.0.0.1';

  // Apply rate limiter
  if (isRateLimited(rawIp)) {
    console.warn(`[SPP Ingest Warning] Rate limit triggered for IP: ${rawIp}`);
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429, headers: corsHeaders }
    );
  }

  try {
    // 1. Authenticate API Key via PostgreSQL (bypassing RLS)
    const apiKey = request.headers.get('x-api-key');
    if (!apiKey) {
      console.warn('[SPP Ingest Auth Reject] x-api-key header missing.');
      return NextResponse.json({ error: 'API key is missing' }, { status: 401, headers: corsHeaders });
    }

    if (!apiKey.startsWith('spp_live_')) {
      console.warn('[SPP Ingest Auth Reject] Invalid API key prefix.');
      return NextResponse.json({ error: 'Invalid API key format' }, { status: 401, headers: corsHeaders });
    }

    const hashedKey = crypto.createHash('sha256').update(apiKey).digest('hex');

    const keyRecord = await db.withAdmin(async (tx) => {
      return await tx.websiteApiKey.findFirst({
        where: {
          keyHash: hashedKey,
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: new Date() } }
          ]
        },
        include: {
          website: true
        }
      });
    });

    if (!keyRecord || !keyRecord.website) {
      console.warn('[SPP Ingest Auth Reject] API key mismatch or expired.');
      return NextResponse.json({ error: 'Invalid or expired API key' }, { status: 401, headers: corsHeaders });
    }

    const activeWebsiteDomain = keyRecord.website.domain;

    // 2. Parse payload body
    let body;
    try {
      body = await request.json();
    } catch (e) {
      console.warn('[SPP Ingest Validation Error] Request body is not valid JSON.');
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400, headers: corsHeaders });
    }

    const {
      event_type,
      visitor_id,
      session_id,
      page_url,
      page_title,
      referrer,
      screen_width,
      screen_height,
      utm_source,
      utm_medium,
      utm_campaign,
      utm_term,
      utm_content,
      duration_ms,
      scroll_percent,
      conversion,
      button_name,
      form_name,
      booking_id
    } = body;

    // Payload validation
    if (!event_type || typeof event_type !== 'string' || event_type.trim() === '') {
      console.warn('[SPP Ingest Validation Fail] Missing event_type parameter.');
      return NextResponse.json({ error: 'event_type is required and must be a string' }, { status: 400, headers: corsHeaders });
    }

    if (!EVENT_ALLOWLIST.has(event_type)) {
      console.warn(`[SPP Ingest Validation Fail] Event type '${event_type}' is not on the allowlist.`);
      return NextResponse.json({ error: `Event type '${event_type}' is not allowed` }, { status: 400, headers: corsHeaders });
    }

    if (!visitor_id || typeof visitor_id !== 'string' || visitor_id.trim() === '') {
      console.warn('[SPP Ingest Validation Fail] Missing visitor_id parameter.');
      return NextResponse.json({ error: 'visitor_id is required and must be a string' }, { status: 400, headers: corsHeaders });
    }

    if (!session_id || typeof session_id !== 'string' || session_id.trim() === '') {
      console.warn('[SPP Ingest Validation Fail] Missing session_id parameter.');
      return NextResponse.json({ error: 'session_id is required and must be a string' }, { status: 400, headers: corsHeaders });
    }

    if (page_url !== undefined && typeof page_url !== 'string') {
      console.warn('[SPP Ingest Validation Fail] page_url parameter is invalid type.');
      return NextResponse.json({ error: 'page_url must be a string' }, { status: 400, headers: corsHeaders });
    }

    // 3. Obtain User Agent and parse client metrics
    const userAgent = request.headers.get('user-agent') || '';
    const { device_type, os, browser } = parseUserAgent(userAgent);

    // 4. Generate IP hash for privacy
    const ipHash = crypto.createHash('sha256').update(rawIp).digest('hex');

    // 5. Read Geo IP headers (e.g. from CDN proxy headers)
    const country = request.headers.get('cf-ipcountry') || request.headers.get('x-vercel-ip-country') || 'Unknown';
    const region = request.headers.get('x-vercel-ip-region') || 'Unknown';
    const city = request.headers.get('x-vercel-ip-city') || 'Unknown';

    // 6. Build the unified ClickHouse ingestion row
    const eventTime = new Date().toISOString().replace('T', ' ').replace('Z', ''); // format: YYYY-MM-DD HH:MM:SS.mmm
    const eventRow = {
      website_id: activeWebsiteDomain,
      event_time: eventTime,
      visitor_id,
      session_id,
      event_type,
      page_url: page_url || '/',
      page_title: page_title || '',
      referrer: referrer || '',
      utm_source: utm_source || '',
      utm_medium: utm_medium || '',
      utm_campaign: utm_campaign || '',
      utm_term: utm_term || '',
      utm_content: utm_content || '',
      country,
      region,
      city,
      device_type,
      browser,
      os,
      screen_width: parseInt(screen_width, 10) || 0,
      screen_height: parseInt(screen_height, 10) || 0,
      duration_ms: parseInt(duration_ms, 10) || 0,
      scroll_percent: parseInt(scroll_percent, 10) || 0,
      button_name: button_name || '',
      form_name: form_name || '',
      booking_id: booking_id || '',
      conversion: parseInt(conversion, 10) || 0,
      ip_hash: ipHash
    };

    // 7. Fire insert event to ClickHouse database
    await insertEvent(eventRow);

    return NextResponse.json({ success: true }, { status: 201, headers: corsHeaders });
  } catch (error) {
    console.error('[SPP Ingest Ingest Exception] Error in /api/analytics POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders });
  }
}
