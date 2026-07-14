import { NextResponse } from 'next/server';
import { db } from '../../lib/db';
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

export async function POST(request) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-api-key',
  };

  try {
    const apiKey = request.headers.get('x-api-key');
    if (!apiKey) {
      return NextResponse.json({ error: 'API key is missing' }, { status: 401, headers: corsHeaders });
    }

    const hashedKey = crypto.createHash('sha256').update(apiKey).digest('hex');
    
    const keyRecord = await db.websiteApiKey.findFirst({
      where: {
        keyHash: hashedKey,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } }
        ]
      }
    });

    if (!keyRecord) {
      return NextResponse.json({ error: 'Invalid or expired API key' }, { status: 401, headers: corsHeaders });
    }

    const body = await request.json();
    const { date, time, name, phone, email, message } = body;

    if (!date || !time || !name || !email) {
      return NextResponse.json({ error: 'Date, time, name, and email are required' }, { status: 400, headers: corsHeaders });
    }

    const parsedDate = new Date(date);
    if (isNaN(parsedDate.getTime())) {
      return NextResponse.json({ error: 'Invalid date format' }, { status: 400, headers: corsHeaders });
    }

    const booking = await db.booking.create({
      data: {
        websiteId: keyRecord.websiteId,
        date: parsedDate,
        time,
        name,
        phone: phone || '',
        email,
        message: message || '',
        status: 'PENDING',
      }
    });

    await db.websiteApiKey.update({
      where: { id: keyRecord.id },
      data: { lastUsedAt: new Date() }
    });

    await db.notification.create({
      data: {
        websiteId: keyRecord.websiteId,
        title: 'New Booking Request',
        message: `New booking requested by ${name} for ${date} at ${time}`,
      }
    });

    return NextResponse.json({ success: true, bookingId: booking.id }, { status: 201, headers: corsHeaders });
  } catch (error) {
    console.error('Error in /bookings POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders });
  }
}
