import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { db } from '../../../lib/db';
import { verifyJWT } from '../../../lib/auth';
import { queryAnalytics } from '../../../lib/clickhouse';

export const metadata = {
  title: 'Web Analytics - SPP Labs',
  description: 'Monitor real-time visitors, page views, and traffic sources for your website.',
};

export default async function AnalyticsPage(props) {
  const searchParams = await props.searchParams;
  const viewDomain = searchParams?.viewDomain || '';

  // 1. Authenticate user session
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) {
    redirect('/login');
  }

  const payload = await verifyJWT(token);
  if (!payload) {
    redirect('/login');
  }

  // 2. Fetch current user (website) details via PostgreSQL
  const currentUser = await db.withAdmin(async (tx) => {
    return await tx.website.findUnique({
      where: { id: payload.userId },
    });
  });

  if (!currentUser) {
    redirect('/login');
  }

  const isAdmin = currentUser.role === 'ADMIN' && currentUser.domain === 'spplabs.es';

  // Determine active tenant domain context
  let activeDomain = currentUser.domain;
  let isViewingAsAdmin = false;

  if (isAdmin && viewDomain) {
    const targetWebsite = await db.withAdmin(async (tx) => {
      return await tx.website.findUnique({
        where: { domain: viewDomain },
      });
    });
    if (targetWebsite) {
      activeDomain = targetWebsite.domain;
      isViewingAsAdmin = true;
    }
  }

  // Fallback structures if ClickHouse is offline
  let clickhouseOffline = false;
  let stats = { pageviews: 0, visitors: 0, sessions: 0 };
  let activeVisitors = 0;
  let avgDuration = 0;
  let topPages = [];
  let trafficSources = [];
  let utmCampaigns = [];
  let devices = [];
  let browsers = [];
  let operatingSystems = [];
  let countries = [];
  let dailyStats = [];

  // 3. Query analytics data from ClickHouse
  try {
    const statsQuery = `
      SELECT 
        count() as pageviews, 
        uniq(visitor_id) as visitors, 
        uniq(session_id) as sessions
      FROM analytics_events 
      WHERE website_id = '${activeDomain}' AND event_time >= NOW() - INTERVAL 30 DAY
    `;
    const statsData = await queryAnalytics(statsQuery);
    if (statsData && statsData.length > 0) {
      stats = {
        pageviews: parseInt(statsData[0].pageviews, 10) || 0,
        visitors: parseInt(statsData[0].visitors, 10) || 0,
        sessions: parseInt(statsData[0].sessions, 10) || 0,
      };
    }

    const durationQuery = `
      SELECT 
        avg(duration_ms) / 1000 as avg_duration_sec
      FROM analytics_events 
      WHERE website_id = '${activeDomain}' AND event_time >= NOW() - INTERVAL 30 DAY AND duration_ms > 0
    `;
    const durationData = await queryAnalytics(durationQuery);
    if (durationData && durationData.length > 0) {
      avgDuration = Math.round(parseFloat(durationData[0].avg_duration_sec) || 0);
    }

    const activeQuery = `
      SELECT 
        uniq(visitor_id) as active_visitors
      FROM analytics_events 
      WHERE website_id = '${activeDomain}' AND event_time >= NOW() - INTERVAL 5 MINUTE
    `;
    const activeData = await queryAnalytics(activeQuery);
    if (activeData && activeData.length > 0) {
      activeVisitors = parseInt(activeData[0].active_visitors, 10) || 0;
    }

    const pagesQuery = `
      SELECT page_url, page_title, count() as count 
      FROM analytics_events 
      WHERE website_id = '${activeDomain}' AND event_type = 'page_view' AND event_time >= NOW() - INTERVAL 30 DAY 
      GROUP BY page_url, page_title 
      ORDER BY count DESC 
      LIMIT 10
    `;
    topPages = await queryAnalytics(pagesQuery);

    const sourcesQuery = `
      SELECT referrer, count() as count 
      FROM analytics_events 
      WHERE website_id = '${activeDomain}' AND event_time >= NOW() - INTERVAL 30 DAY 
      GROUP BY referrer 
      ORDER BY count DESC 
      LIMIT 10
    `;
    trafficSources = await queryAnalytics(sourcesQuery);

    const utmQuery = `
      SELECT utm_source, utm_medium, utm_campaign, count() as count 
      FROM analytics_events 
      WHERE website_id = '${activeDomain}' AND utm_source != '' AND event_time >= NOW() - INTERVAL 30 DAY 
      GROUP BY utm_source, utm_medium, utm_campaign 
      ORDER BY count DESC 
      LIMIT 10
    `;
    utmCampaigns = await queryAnalytics(utmQuery);

    const devicesQuery = `
      SELECT device_type, count() as count 
      FROM analytics_events 
      WHERE website_id = '${activeDomain}' AND event_time >= NOW() - INTERVAL 30 DAY 
      GROUP BY device_type 
      ORDER BY count DESC
    `;
    devices = await queryAnalytics(devicesQuery);

    const browsersQuery = `
      SELECT browser, count() as count 
      FROM analytics_events 
      WHERE website_id = '${activeDomain}' AND event_time >= NOW() - INTERVAL 30 DAY 
      GROUP BY browser 
      ORDER BY count DESC 
      LIMIT 5
    `;
    browsers = await queryAnalytics(browsersQuery);

    const osQuery = `
      SELECT os, count() as count 
      FROM analytics_events 
      WHERE website_id = '${activeDomain}' AND event_time >= NOW() - INTERVAL 30 DAY 
      GROUP BY os 
      ORDER BY count DESC 
      LIMIT 5
    `;
    operatingSystems = await queryAnalytics(osQuery);

    const countryQuery = `
      SELECT country, count() as count 
      FROM analytics_events 
      WHERE website_id = '${activeDomain}' AND event_time >= NOW() - INTERVAL 30 DAY 
      GROUP BY country 
      ORDER BY count DESC 
      LIMIT 10
    `;
    countries = await queryAnalytics(countryQuery);

    const chartQuery = `
      SELECT toDate(event_time) as date, count() as pageviews, uniq(visitor_id) as visitors 
      FROM analytics_events 
      WHERE website_id = '${activeDomain}' AND event_time >= NOW() - INTERVAL 30 DAY 
      GROUP BY date 
      ORDER BY date ASC
    `;
    dailyStats = await queryAnalytics(chartQuery);

  } catch (error) {
    console.error('ClickHouse connection/query error:', error);
    clickhouseOffline = true;
  }

  // Format helper for duration
  function formatDuration(sec) {
    if (sec < 60) return `${sec}s`;
    const min = Math.floor(sec / 60);
    const remainingSec = sec % 60;
    return `${min}m ${remainingSec}s`;
  }

  // Calculate chart parameters
  const maxPageviews = dailyStats.length > 0 
    ? Math.max(...dailyStats.map(d => parseInt(d.pageviews, 10))) 
    : 100;

  return (
    <div className="min-h-screen bg-white text-black font-sans flex flex-col">
      {/* Top Navbar */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 justify-between items-center">
            <div className="flex items-center space-x-4">
              <Link href="/" className="text-2xl font-extrabold tracking-tight text-black hover:opacity-85">
                SPP<span className="text-primary">Labs</span>
              </Link>
              <span className="text-gray-300 font-light">|</span>
              <span className="text-sm font-semibold bg-gray-100 px-3 py-1.5 rounded-full border border-gray-200">
                {activeDomain} {isViewingAsAdmin && <span className="text-secondary">(Admin Mode)</span>}
              </span>
            </div>
            
            <div className="flex items-center space-x-6">
              {isAdmin && isViewingAsAdmin && (
                <Link
                  href="/dashboard"
                  className="text-xs bg-gray-100 border border-gray-300 hover:bg-gray-200 text-black px-3 py-1.5 rounded-lg font-bold transition-all"
                >
                  ← Back to Admin Console
                </Link>
              )}
              
              <Link 
                href={isViewingAsAdmin ? `/dashboard?viewDomain=${activeDomain}` : '/dashboard'} 
                className="text-sm font-semibold text-gray-500 hover:text-black transition-all"
              >
                Workspace Dashboard
              </Link>

              <span className="text-sm font-bold text-black border-b-2 border-black pb-1">
                Web Analytics
              </span>

              <span className="text-sm text-gray-500 hidden md:inline">
                Logged in as: <strong className="text-black">{currentUser.domain}</strong>
              </span>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Container */}
      <main className="flex-grow mx-auto max-w-7xl w-full px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        
        {/* Offline Warning Banner */}
        {clickhouseOffline && (
          <div className="rounded-xl bg-amber-50 p-4 border border-amber-200 text-sm font-medium text-amber-800 flex items-center gap-3">
            <span className="text-lg">⚠️</span>
            <div>
              <strong>ClickHouse analytics server is currently offline or unreachable.</strong> Displaying fallback/empty dashboard metrics. Ensure that the ClickHouse service is active and credentials in <code>.env</code> are correct.
            </div>
          </div>
        )}

        {/* Header and Realtime Badge */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-black tracking-tight">
              Web Analytics Dashboard
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Performance metrics for <strong className="text-black">{activeDomain}</strong> (past 30 days)
            </p>
          </div>

          <div className="bg-black text-white px-4 py-2.5 rounded-xl border border-gray-800 shadow-sm flex items-center gap-3">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-gray-300">
              Active Visitors: <strong className="text-white text-sm font-extrabold ml-1">{activeVisitors}</strong>
            </span>
          </div>
        </div>

        {/* Overview KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white border border-gray-200 shadow-lg rounded-2xl p-6 space-y-2 hover:border-primary transition-all">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400 block">Total Page Views</span>
            <span className="text-4xl font-extrabold text-black block">{stats.pageviews.toLocaleString()}</span>
            <span className="text-xs text-gray-500 font-semibold block">Total raw hits recorded</span>
          </div>
          <div className="bg-white border border-gray-200 shadow-lg rounded-2xl p-6 space-y-2 hover:border-secondary transition-all">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400 block">Unique Visitors</span>
            <span className="text-4xl font-extrabold text-black block">{stats.visitors.toLocaleString()}</span>
            <span className="text-xs text-green-600 font-semibold block">Based on persistent visitor UUID</span>
          </div>
          <div className="bg-white border border-gray-200 shadow-lg rounded-2xl p-6 space-y-2 hover:border-black transition-all">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400 block">Sessions</span>
            <span className="text-4xl font-extrabold text-black block">{stats.sessions.toLocaleString()}</span>
            <span className="text-xs text-blue-600 font-semibold block">30 min inactivity window</span>
          </div>
          <div className="bg-white border border-gray-200 shadow-lg rounded-2xl p-6 space-y-2 hover:border-green-600 transition-all">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400 block">Avg Session Duration</span>
            <span className="text-4xl font-extrabold text-black block">{formatDuration(avgDuration)}</span>
            <span className="text-xs text-gray-500 font-semibold block">Average engagement time</span>
          </div>
        </div>

        {/* HTML/CSS Pageviews Timeline Bar Chart */}
        <div className="bg-white border border-gray-200 shadow-lg rounded-2xl p-6 space-y-6">
          <div>
            <h2 className="text-xl font-bold text-black">Traffic Timeline</h2>
            <p className="text-xs text-gray-500 mt-1">Daily page views trend over the last month.</p>
          </div>

          {dailyStats.length === 0 ? (
            <div className="h-64 bg-gray-50 border border-dashed border-gray-200 rounded-xl flex items-center justify-center text-sm text-gray-400">
              No timeline data available.
            </div>
          ) : (
            <div className="space-y-4">
              {/* Graphical bar wrapper */}
              <div className="h-48 flex items-end justify-between gap-1 sm:gap-2 px-2 pt-6 border-b border-gray-100">
                {dailyStats.map((d, index) => {
                  const percent = Math.max(3, Math.round((parseInt(d.pageviews, 10) / maxPageviews) * 100));
                  return (
                    <div 
                      key={index} 
                      className="group relative flex-grow flex flex-col items-center justify-end h-full"
                    >
                      {/* Tooltip on hover */}
                      <span className="absolute bottom-full mb-2 bg-black text-white text-[10px] font-bold px-2 py-1 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-all z-20 whitespace-nowrap pointer-events-none">
                        {parseInt(d.pageviews, 10).toLocaleString()} views
                      </span>
                      
                      {/* Interactive visual bar */}
                      <div 
                        style={{ height: `${percent}%` }}
                        className="w-full bg-gray-200 group-hover:bg-primary rounded-t-sm transition-all cursor-pointer"
                      ></div>
                    </div>
                  );
                })}
              </div>
              {/* X Axis dates */}
              <div className="flex justify-between text-[10px] text-gray-400 font-bold px-2">
                <span>{new Date(dailyStats[0].date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                <span>{new Date(dailyStats[Math.floor(dailyStats.length / 2)].date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                <span>{new Date(dailyStats[dailyStats.length - 1].date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
              </div>
            </div>
          )}
        </div>

        {/* Detailed Metrics Section Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Top Pages List */}
          <div className="bg-white border border-gray-200 shadow-lg rounded-2xl p-6 space-y-4">
            <div>
              <h3 className="text-lg font-bold text-black">Top Pages</h3>
              <p className="text-xs text-gray-500 mt-1">Most frequently visited page paths.</p>
            </div>
            <div className="border border-gray-100 rounded-xl overflow-hidden">
              <table className="min-w-full divide-y divide-gray-100 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left font-bold text-gray-500">Page URL</th>
                    <th className="px-4 py-2 text-right font-bold text-gray-500">Views</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {topPages.length === 0 ? (
                    <tr>
                      <td colSpan="2" className="px-4 py-4 text-center text-gray-400">No page views recorded.</td>
                    </tr>
                  ) : (
                    topPages.map((p, i) => (
                      <tr key={i} className="hover:bg-gray-50 transition-all">
                        <td className="px-4 py-3 font-medium">
                          <div className="truncate max-w-xs sm:max-w-md text-black">{p.page_url}</div>
                          <span className="text-[10px] text-gray-400 block truncate max-w-xs">{p.page_title}</span>
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-black">{parseInt(p.count, 10).toLocaleString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Traffic Referrers List */}
          <div className="bg-white border border-gray-200 shadow-lg rounded-2xl p-6 space-y-4">
            <div>
              <h3 className="text-lg font-bold text-black">Referrers & Sources</h3>
              <p className="text-xs text-gray-500 mt-1">Domains driving incoming visitors.</p>
            </div>
            <div className="border border-gray-100 rounded-xl overflow-hidden">
              <table className="min-w-full divide-y divide-gray-100 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left font-bold text-gray-500">Referrer Domain</th>
                    <th className="px-4 py-2 text-right font-bold text-gray-500">Visitors</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {trafficSources.length === 0 ? (
                    <tr>
                      <td colSpan="2" className="px-4 py-4 text-center text-gray-400">No referrer sources recorded.</td>
                    </tr>
                  ) : (
                    trafficSources.map((s, i) => (
                      <tr key={i} className="hover:bg-gray-50 transition-all">
                        <td className="px-4 py-3 font-medium text-black truncate max-w-xs">
                          {s.referrer ? s.referrer : 'Direct / Organic'}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-black">{parseInt(s.count, 10).toLocaleString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Device & Browser Breakdowns */}
          <div className="bg-white border border-gray-200 shadow-lg rounded-2xl p-6 space-y-6">
            <div>
              <h3 className="text-lg font-bold text-black">User Environment</h3>
              <p className="text-xs text-gray-500 mt-1">Visitor browser types, operating systems, and screen scopes.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {/* Devices */}
              <div className="space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-400 block border-b border-gray-100 pb-1">Devices</span>
                {devices.length === 0 ? (
                  <span className="text-xs text-gray-400">No device logs.</span>
                ) : (
                  devices.map((d, i) => (
                    <div key={i} className="flex justify-between text-xs font-medium">
                      <span className="capitalize text-black">{d.device_type}</span>
                      <span className="text-gray-500 font-bold">{parseInt(d.count, 10).toLocaleString()}</span>
                    </div>
                  ))
                )}
              </div>

              {/* Browsers */}
              <div className="space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-400 block border-b border-gray-100 pb-1">Browsers</span>
                {browsers.length === 0 ? (
                  <span className="text-xs text-gray-400">No browser logs.</span>
                ) : (
                  browsers.map((b, i) => (
                    <div key={i} className="flex justify-between text-xs font-medium">
                      <span className="text-black">{b.browser}</span>
                      <span className="text-gray-500 font-bold">{parseInt(b.count, 10).toLocaleString()}</span>
                    </div>
                  ))
                )}
              </div>

              {/* Operating Systems */}
              <div className="space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-400 block border-b border-gray-100 pb-1">OS</span>
                {operatingSystems.length === 0 ? (
                  <span className="text-xs text-gray-400">No OS logs.</span>
                ) : (
                  operatingSystems.map((o, i) => (
                    <div key={i} className="flex justify-between text-xs font-medium">
                      <span className="text-black">{o.os}</span>
                      <span className="text-gray-500 font-bold">{parseInt(o.count, 10).toLocaleString()}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Countries distribution */}
          <div className="bg-white border border-gray-200 shadow-lg rounded-2xl p-6 space-y-4">
            <div>
              <h3 className="text-lg font-bold text-black">Geographic Locations</h3>
              <p className="text-xs text-gray-500 mt-1">Visitor distribution by country code.</p>
            </div>
            <div className="border border-gray-100 rounded-xl overflow-hidden">
              <table className="min-w-full divide-y divide-gray-100 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left font-bold text-gray-500">Country Code</th>
                    <th className="px-4 py-2 text-right font-bold text-gray-500">Hits</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {countries.length === 0 ? (
                    <tr>
                      <td colSpan="2" className="px-4 py-4 text-center text-gray-400">No location logs recorded.</td>
                    </tr>
                  ) : (
                    countries.map((c, i) => (
                      <tr key={i} className="hover:bg-gray-50 transition-all">
                        <td className="px-4 py-3 font-semibold text-black uppercase">{c.country}</td>
                        <td className="px-4 py-3 text-right font-bold text-black">{parseInt(c.count, 10).toLocaleString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {/* Marketing UTM Campaigns Table */}
        <div className="bg-white border border-gray-200 shadow-lg rounded-2xl p-6 space-y-4">
          <div>
            <h3 className="text-lg font-bold text-black">Marketing UTM Campaigns</h3>
            <p className="text-xs text-gray-500 mt-1">Campaign click performance based on tracking parameters.</p>
          </div>
          <div className="border border-gray-100 rounded-xl overflow-hidden">
            <table className="min-w-full divide-y divide-gray-100 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-bold text-gray-500">UTM Source</th>
                  <th className="px-4 py-3 text-left font-bold text-gray-500">UTM Medium</th>
                  <th className="px-4 py-3 text-left font-bold text-gray-500">UTM Campaign</th>
                  <th className="px-4 py-3 text-right font-bold text-gray-500">Total Visits</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {utmCampaigns.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="px-4 py-8 text-center text-gray-400">No marketing campaign analytics found.</td>
                  </tr>
                ) : (
                  utmCampaigns.map((u, i) => (
                    <tr key={i} className="hover:bg-gray-50 transition-all text-black">
                      <td className="px-4 py-3 font-medium">{u.utm_source}</td>
                      <td className="px-4 py-3 text-gray-600">{u.utm_medium}</td>
                      <td className="px-4 py-3 text-gray-600">{u.utm_campaign}</td>
                      <td className="px-4 py-3 text-right font-bold">{parseInt(u.count, 10).toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-6">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center text-xs text-gray-400">
          &copy; {new Date().getFullYear()} SPP Labs. All rights reserved. Registered domain: {activeDomain}.
        </div>
      </footer>
    </div>
  );
}
