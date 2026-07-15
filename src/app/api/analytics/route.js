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

export async function POST(request) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-api-key',
  };

  try {
    // 1. Authenticate API Key via PostgreSQL (bypassing RLS)
    const apiKey = request.headers.get('x-api-key');
    if (!apiKey) {
      return NextResponse.json({ error: 'API key is missing' }, { status: 401, headers: corsHeaders });
    }

    if (!apiKey.startsWith('spp_live_')) {
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
      return NextResponse.json({ error: 'Invalid or expired API key' }, { status: 401, headers: corsHeaders });
    }

    const activeWebsiteDomain = keyRecord.website.domain;

    // 2. Parse payload body
    const body = await request.json();
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

    if (!event_type || !visitor_id || !session_id) {
      return NextResponse.json({ error: 'event_type, visitor_id, and session_id are required' }, { status: 400, headers: corsHeaders });
    }

    // 3. Obtain User Agent and parse client metrics
    const userAgent = request.headers.get('user-agent') || '';
    const { device_type, os, browser } = parseUserAgent(userAgent);

    // 4. Obtain IP address and generate SHA-256 hash for anonymity
    const rawIp = request.headers.get('x-forwarded-for')?.split(',')[0].trim() 
      || request.headers.get('x-real-ip') 
      || '127.0.0.1';
    const ipHash = crypto.createHash('sha256').update(rawIp).digest('hex');

    // 5. Read Geo IP headers (e.g. from Cloudflare or Vercel proxy headers)
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
    console.error('Error in /api/analytics POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders });
  }
}
