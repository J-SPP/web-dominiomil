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
    const { name, phone, email, message } = body;

    if (!name || !email || !message) {
      return NextResponse.json({ error: 'Name, email, and message are required' }, { status: 400, headers: corsHeaders });
    }

    const contact = await db.contactForm.create({
      data: {
        websiteId: keyRecord.websiteId,
        name,
        phone: phone || '',
        email,
        message,
      }
    });

    await db.websiteApiKey.update({
      where: { id: keyRecord.id },
      data: { lastUsedAt: new Date() }
    });

    await db.notification.create({
      data: {
        websiteId: keyRecord.websiteId,
        title: 'New Contact Form Submission',
        message: `New message from ${name} (${email})`,
      }
    });

    return NextResponse.json({ success: true, contactId: contact.id }, { status: 201, headers: corsHeaders });
  } catch (error) {
    console.error('Error in /contacts POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders });
  }
}
