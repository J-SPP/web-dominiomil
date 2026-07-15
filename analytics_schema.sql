-- SPP Labs ClickHouse Analytics Database Schema (v2.0)
-- Optimized for ClickHouse 24.3.18 LTS compatibility, high performance, and efficient compression.

-- Create database if not exists
CREATE DATABASE IF NOT EXISTS analytics;

-- ============================================================================
-- 1. MAIN RAW EVENTS TABLE
-- ============================================================================
-- Main multi-tenant table storing raw web analytics events.
-- website_id: Client domain (acts as tenant identifier)
-- event_time: Timestamp when the event occurred (millisecond precision)
-- visitor_id: Persistent visitor ID stored in browser cookies (1 year duration)
-- session_id: Session ID expiring after 30 minutes of inactivity
-- ip_hash: SHA-256 hash of the visitor IP address for privacy compliance

CREATE TABLE IF NOT EXISTS analytics.analytics_events
(
    -- Tenant and Time dimensions (Sorting prefix)
    website_id String CODEC(LZ4),
    event_time DateTime64(3) CODEC(DoubleDelta, LZ4),

    -- Identifiers
    visitor_id UUID CODEC(ZSTD(1)),
    session_id UUID CODEC(ZSTD(1)),

    -- Event details
    event_type LowCardinality(String) CODEC(ZSTD(1)),

    -- Page Context
    page_url String CODEC(ZSTD(1)),
    page_title String CODEC(ZSTD(1)),
    referrer String CODEC(ZSTD(1)),

    -- Marketing Context (UTMs are highly repetitive, using LowCardinality)
    utm_source LowCardinality(String) CODEC(ZSTD(1)),
    utm_medium LowCardinality(String) CODEC(ZSTD(1)),
    utm_campaign LowCardinality(String) CODEC(ZSTD(1)),
    utm_term String CODEC(ZSTD(1)),
    utm_content String CODEC(ZSTD(1)),

    -- Geographic Context (Enriched by server from CDN headers)
    country LowCardinality(String) CODEC(ZSTD(1)),
    region LowCardinality(String) CODEC(ZSTD(1)),
    city LowCardinality(String) CODEC(ZSTD(1)),

    -- Device & Browser Context (Enriched from User-Agent)
    device_type LowCardinality(String) CODEC(ZSTD(1)),
    browser LowCardinality(String) CODEC(ZSTD(1)),
    os LowCardinality(String) CODEC(ZSTD(1)),

    -- Viewport specifications
    screen_width UInt16 CODEC(ZSTD(1)),
    screen_height UInt16 CODEC(ZSTD(1)),

    -- Metric attributes
    duration_ms UInt32 CODEC(T64, ZSTD(1)),
    scroll_percent UInt8 CODEC(T64, ZSTD(1)),

    -- Event specific entities
    button_name String CODEC(ZSTD(1)),
    form_name String CODEC(ZSTD(1)),
    booking_id String CODEC(ZSTD(1)),

    -- Conversions and Privacy
    conversion UInt8 CODEC(ZSTD(1)),
    ip_hash FixedString(64) CODEC(ZSTD(1)),

    -- Data Skipping Indexes to speed up queries on secondary fields
    INDEX idx_page_url page_url TYPE tokenbf_v1(30720, 2, 0) GRANULARITY 1,
    INDEX idx_referrer referrer TYPE tokenbf_v1(30720, 2, 0) GRANULARITY 1,
    INDEX idx_visitor visitor_id TYPE bloom_filter() GRANULARITY 1
)
ENGINE = MergeTree
PARTITION BY toYYYYMM(event_time)
ORDER BY (website_id, event_time, event_type, session_id)
TTL toDateTime(event_time) + INTERVAL 2 YEAR DELETE
SETTINGS index_granularity = 8192;


-- ============================================================================
-- 2. DAILY PAGES ROLLUP & MATERIALIZED VIEW
-- ============================================================================
-- Aggregate page views by page URL, title, and device type for rapid loading of top page charts.
-- Aggregated page views grouped by page and device per day.

CREATE TABLE IF NOT EXISTS analytics.daily_pages_rollup
(
    day Date CODEC(DoubleDelta, LZ4),
    website_id String CODEC(LZ4),
    page_url String CODEC(ZSTD(1)),
    page_title String CODEC(ZSTD(1)),
    device_type LowCardinality(String) CODEC(ZSTD(1)),
    page_views UInt64 CODEC(ZSTD(1))
)
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(day)
ORDER BY (website_id, day, page_url, device_type)
TTL day + INTERVAL 2 YEAR;

CREATE MATERIALIZED VIEW IF NOT EXISTS analytics.mv_daily_pages
TO analytics.daily_pages_rollup
AS SELECT
    toDate(event_time) AS day,
    website_id,
    page_url,
    page_title,
    device_type,
    count() AS page_views
FROM analytics.analytics_events
WHERE event_type = 'page_view'
GROUP BY day, website_id, page_url, page_title, device_type;


-- ============================================================================
-- 3. DAILY CONVERSIONS ROLLUP & MATERIALIZED VIEW
-- ============================================================================
-- Tracks conversion actions (form submits, bookings, button clicks) aggregate counters by day.
-- Aggregated conversion metric counters per day.

CREATE TABLE IF NOT EXISTS analytics.daily_conversions_rollup
(
    day Date CODEC(DoubleDelta, LZ4),
    website_id String CODEC(LZ4),
    event_type LowCardinality(String) CODEC(ZSTD(1)),
    utm_source LowCardinality(String) CODEC(ZSTD(1)),
    utm_medium LowCardinality(String) CODEC(ZSTD(1)),
    utm_campaign LowCardinality(String) CODEC(ZSTD(1)),
    button_name String CODEC(ZSTD(1)),
    form_name String CODEC(ZSTD(1)),
    conversions UInt64 CODEC(ZSTD(1))
)
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(day)
ORDER BY (website_id, day, event_type, utm_source, utm_medium, utm_campaign)
TTL day + INTERVAL 2 YEAR;

CREATE MATERIALIZED VIEW IF NOT EXISTS analytics.mv_conversions
TO analytics.daily_conversions_rollup
AS SELECT
    toDate(event_time) AS day,
    website_id,
    event_type,
    utm_source,
    utm_medium,
    utm_campaign,
    button_name,
    form_name,
    count() AS conversions
FROM analytics.analytics_events
WHERE conversion = 1
GROUP BY day, website_id, event_type, utm_source, utm_medium, utm_campaign, button_name, form_name;


-- ============================================================================
-- 4. DAILY VISITORS ROLLUP (AGGREGATING MERGE TREE)
-- ============================================================================
-- Pre-calculates unique visitors and sessions counts using HyperLogLog state engines.
-- Allows O(1) query response on daily metrics while supporting exact merges for arbitrary ranges.
-- Aggregated HyperLogLog unique visitor and session rollup states per day.

CREATE TABLE IF NOT EXISTS analytics.daily_visitors_rollup
(
    day Date CODEC(DoubleDelta, LZ4),
    website_id String CODEC(LZ4),
    device_type LowCardinality(String) CODEC(ZSTD(1)),
    country LowCardinality(String) CODEC(ZSTD(1)),
    
    -- State columns for aggregating functions
    unique_visitors AggregateFunction(uniq, UUID),
    total_sessions AggregateFunction(uniq, UUID),
    total_page_views SimpleAggregateFunction(sum, UInt64)
)
ENGINE = AggregatingMergeTree()
PARTITION BY toYYYYMM(day)
ORDER BY (website_id, day, device_type, country)
TTL day + INTERVAL 2 YEAR;

CREATE MATERIALIZED VIEW IF NOT EXISTS analytics.mv_daily_visitors
TO analytics.daily_visitors_rollup
AS SELECT
    toDate(event_time) AS day,
    website_id,
    device_type,
    country,
    uniqState(visitor_id) AS unique_visitors,
    uniqState(session_id) AS total_sessions,
    count() AS total_page_views
FROM analytics.analytics_events
GROUP BY day, website_id, device_type, country;


-- ============================================================================
-- 5. HOURLY VISITORS ROLLUP (AGGREGATING MERGE TREE)
-- ============================================================================
-- Pre-calculates hourly unique visitors and sessions counts for the real-time analytics window.
-- Aggregated unique visitor and session rollup states per hour.

CREATE TABLE IF NOT EXISTS analytics.hourly_visitors_rollup
(
    hour DateTime CODEC(DoubleDelta, LZ4),
    website_id String CODEC(LZ4),
    country LowCardinality(String) CODEC(ZSTD(1)),
    
    unique_visitors AggregateFunction(uniq, UUID),
    total_sessions AggregateFunction(uniq, UUID),
    total_page_views SimpleAggregateFunction(sum, UInt64)
)
ENGINE = AggregatingMergeTree()
PARTITION BY toYYYYMM(hour)
ORDER BY (website_id, hour, country)
TTL hour + INTERVAL 6 MONTH;

CREATE MATERIALIZED VIEW IF NOT EXISTS analytics.mv_hourly_visitors
TO analytics.hourly_visitors_rollup
AS SELECT
    toStartOfHour(event_time) AS hour,
    website_id,
    country,
    uniqState(visitor_id) AS unique_visitors,
    uniqState(session_id) AS total_sessions,
    count() AS total_page_views
FROM analytics.analytics_events
GROUP BY hour, website_id, country;
