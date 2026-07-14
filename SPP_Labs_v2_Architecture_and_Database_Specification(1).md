# SPP Labs v2.0 Architecture and Database Specification

## Overview

- One website = one tenant.
- One central API (`api.spplabs.es`).
- PostgreSQL is the source of truth.
- ClickHouse stores analytics only.
- Qdrant stores vector embeddings only.
- JWT authentication for dashboard users.
- API Keys for public website requests.
- Row Level Security (RLS) for tenant isolation.

---

## System Architecture

```text
Client Websites
      |
      v
api.spplabs.es
      |
      v
Next.js + Prisma
      |
+-----+---------+
|               |
PostgreSQL   ClickHouse
     |
     v
  Qdrant
```

---

## Authentication

### Dashboard
- Domain + Password
- Argon2id password hashing
- JWT stored in Secure, HttpOnly cookies

### Public API
- API Key authentication
- API keys stored hashed

---

## Tables

### websites
```sql
id UUID PRIMARY KEY,
domain TEXT UNIQUE NOT NULL,
display_name TEXT NOT NULL,
password_hash TEXT NULL,
role website_role NOT NULL,
registered_at TIMESTAMPTZ NULL,
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

### signup_tokens
```sql
id UUID PRIMARY KEY,
token TEXT UNIQUE NOT NULL,
domain TEXT UNIQUE NOT NULL,
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

### website_api_keys
```sql
id UUID PRIMARY KEY,
website_id UUID NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
name TEXT NOT NULL,
key_hash TEXT NOT NULL,
last_used_at TIMESTAMPTZ NULL,
expires_at TIMESTAMPTZ NULL,
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
UNIQUE (website_id, name)
```

### contact_forms
```sql
id UUID PRIMARY KEY,
website_id UUID NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
name TEXT NOT NULL,
phone TEXT NOT NULL,
email TEXT NOT NULL,
message TEXT NOT NULL,
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

### bookings
```sql
id UUID PRIMARY KEY,
website_id UUID NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
date DATE NOT NULL,
time TIME NOT NULL,
name TEXT NOT NULL,
phone TEXT NOT NULL,
email TEXT NOT NULL,
message TEXT NOT NULL,
status booking_status NOT NULL DEFAULT 'PENDING',
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

### notifications
```sql
id UUID PRIMARY KEY,
website_id UUID NULL REFERENCES websites(id) ON DELETE CASCADE,
title TEXT NOT NULL,
message TEXT NOT NULL,
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

### support_requests
```sql
id UUID PRIMARY KEY,
website_id UUID NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
title TEXT NOT NULL,
message TEXT NOT NULL,
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

### ai_usage_monthly
```sql
id UUID PRIMARY KEY,
website_id UUID NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
year INTEGER NOT NULL,
month INTEGER NOT NULL,
prompt_tokens BIGINT NOT NULL DEFAULT 0,
completion_tokens BIGINT NOT NULL DEFAULT 0,
total_tokens BIGINT NOT NULL DEFAULT 0,
updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
UNIQUE(website_id, year, month)
```

### chatbot_knowledge
```sql
id UUID PRIMARY KEY,
website_id UUID UNIQUE NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
content TEXT NOT NULL,
last_synced_at TIMESTAMPTZ NULL,
updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

### google_calendar_connections
```sql
id UUID PRIMARY KEY,
website_id UUID UNIQUE NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
google_account_email TEXT NOT NULL,
google_calendar_id TEXT NOT NULL,
access_token TEXT NOT NULL,
refresh_token TEXT NOT NULL,
token_expires_at TIMESTAMPTZ NOT NULL,
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

### website_dashboard_state
```sql
id UUID PRIMARY KEY,
viewer_website_id UUID NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
target_website_id UUID NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
last_contact_view TIMESTAMPTZ,
last_booking_view TIMESTAMPTZ,
last_notification_view TIMESTAMPTZ,
last_support_view TIMESTAMPTZ,
UNIQUE(viewer_website_id,target_website_id)
```

---

## Indexes

- contact_forms.website_id
- bookings.website_id
- notifications.website_id
- support_requests.website_id
- website_api_keys.website_id
- ai_usage_monthly(website_id,year,month)

---

## updated_at Triggers

All updated_at fields should be maintained by PostgreSQL triggers.

---

## Row Level Security

RLS is enabled on tenant tables.

The backend sets:

```sql
SET LOCAL app.current_website_id='<website_uuid>';
```

Policies only allow matching website rows.
ADMIN has separate bypass policies.

---

## API Architecture

All client websites communicate exclusively with:

- POST /contacts
- POST /bookings
- POST /chat
- POST /analytics/pageview

Dashboard uses JWT authentication.

---

## Production Notes

- UUIDs everywhere
- ON DELETE CASCADE
- PostgreSQL source of truth
- One Prisma client
- One central API
- Timestamp-based notifications
