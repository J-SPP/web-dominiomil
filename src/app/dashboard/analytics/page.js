import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { db } from '../../../lib/db';
import { verifyJWT } from '../../../lib/auth';
import { queryAnalytics } from '../../../lib/clickhouse';

export const metadata = {
  title: 'Analítica Web - SPP Labs',
  description: 'Monitoriza visitantes en tiempo real, canales de tráfico y embudos de conversión.',
};

export default async function AnalyticsDashboardPage(props) {
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

  // Analytics Metrics (Default Simulated Data values)
  let clickhouseOffline = false;
  let isSimulated = false;

  let stats = { pageviews: 4531, visitors: 3892, sessions: 5687 };
  let activeVisitors = 23;
  let avgDuration = 151; // 2m 31s
  let bounceRate = 36.1;
  let conversionsCount = 186;

  let topPages = [
    { page_url: '/', page_title: 'Inicio', count: 1923, uniq_visitors: 1482, avg_time: '2m 45s', bounce: '32.1%' },
    { page_url: '/menu', page_title: 'Servicios', count: 1002, uniq_visitors: 812, avg_time: '3m 12s', bounce: '28.4%' },
    { page_url: '/about', page_title: 'Arquitectura', count: 487, uniq_visitors: 385, avg_time: '1m 47s', bounce: '35.6%' },
    { page_url: '/book', page_title: 'Calendario', count: 431, uniq_visitors: 331, avg_time: '2m 33s', bounce: '31.8%' },
    { page_url: '/contact', page_title: 'Contacto', count: 298, uniq_visitors: 250, avg_time: '1m 21s', bounce: '41.2%' },
  ];

  let trafficSources = [
    { referrer: 'Google Search', count: 3480, percentage: 61.2 },
    { referrer: 'Instagram', count: 1012, percentage: 17.8 },
    { referrer: 'Directo / Orgánico', count: 415, percentage: 7.3 },
    { referrer: 'Facebook', count: 392, percentage: 6.9 },
    { referrer: 'Referencia / Enlaces', count: 233, percentage: 4.1 },
    { referrer: 'Otros', count: 155, percentage: 2.7 },
  ];

  let utmCampaigns = [
    { utm_source: 'google', utm_medium: 'cpc', utm_campaign: 'black_friday', count: 1204 },
    { utm_source: 'newsletter', utm_medium: 'email', utm_campaign: 'monthly_digest', count: 687 },
    { utm_source: 'instagram', utm_medium: 'social', utm_campaign: 'influencer_promo', count: 450 },
    { utm_source: 'linkedin', utm_medium: 'referral', utm_campaign: 'b2b_outreach', count: 182 },
  ];

  let devices = [
    { device_type: 'Móvil', count: 3258, percentage: 57.3 },
    { device_type: 'Escritorio', count: 2149, percentage: 37.8 },
    { device_type: 'Tablet', count: 280, percentage: 4.9 },
  ];

  let browsers = [
    { browser: 'Chrome', count: 3120, percentage: 54.8 },
    { browser: 'Safari', count: 1480, percentage: 26.0 },
    { browser: 'Firefox', count: 450, percentage: 7.9 },
    { browser: 'Edge', count: 387, percentage: 6.8 },
    { browser: 'Otros', count: 250, percentage: 4.5 },
  ];

  let operatingSystems = [
    { os: 'Windows', count: 2280, percentage: 40.1 },
    { os: 'iOS', count: 1540, percentage: 27.1 },
    { os: 'Android', count: 1120, percentage: 19.7 },
    { os: 'macOS', count: 580, percentage: 10.2 },
    { os: 'Linux', count: 167, percentage: 2.9 },
  ];

  let countries = [
    { country: 'España', emoji: '🇪🇸', count: 3682, percentage: 81.3 },
    { country: 'Portugal', emoji: '🇵🇹', count: 345, percentage: 7.6 },
    { country: 'Francia', emoji: '🇫🇷', count: 189, percentage: 4.2 },
    { country: 'Estados Unidos', emoji: '🇺🇸', count: 72, percentage: 1.6 },
    { country: 'Otros', emoji: '🌍', count: 243, percentage: 5.3 },
  ];

  let conversionsBreakdown = [
    { type: 'Formularios enviados', count: 18, percentage: 28.6 },
    { type: 'Reservas programadas', count: 7, percentage: 40.0 },
    { type: 'Clics de teléfono', count: 13, percentage: 18.2 },
    { type: 'Clics de WhatsApp', count: 25, percentage: 31.6 },
    { type: 'Clics de Email', count: 6, percentage: 20.0 },
  ];

  // Daily statistics for line chart (past 30 days)
  let dailyStats = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dayName = d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
    // Generate a nice random curve centered around 150 page views
    const randomFactor = Math.sin(i * 0.4) * 50 + 150 + Math.random() * 30;
    dailyStats.push({
      date: dayName,
      pageviews: Math.round(randomFactor),
      visitors: Math.round(randomFactor * 0.8),
    });
  }

  // Heatmap statistics (7 days of week x 12 hour slots)
  let heatmapData = [];
  const daysOfWeek = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  const hourSlots = ['00-02', '02-04', '04-06', '06-08', '08-10', '10-12', '12-14', '14-16', '16-18', '18-20', '20-22', '22-24'];

  // Query actual ClickHouse database if online
  try {
    // A query check to see if we have ANY rows in the table
    const checkQuery = `SELECT count() as count FROM analytics_events WHERE website_id = '${activeDomain}'`;
    const checkData = await queryAnalytics(checkQuery);
    
    if (checkData && checkData.length > 0 && parseInt(checkData[0].count, 10) > 0) {
      // 1. Overview counts
      const statsQuery = `
        SELECT 
          count() as pageviews, 
          uniq(visitor_id) as visitors, 
          uniq(session_id) as sessions
        FROM analytics_events 
        WHERE website_id = '${activeDomain}' AND event_time >= NOW() - INTERVAL 30 DAY
      `;
      const statsRes = await queryAnalytics(statsQuery);
      if (statsRes && statsRes.length > 0) {
        stats = {
          pageviews: parseInt(statsRes[0].pageviews, 10) || 0,
          visitors: parseInt(statsRes[0].visitors, 10) || 0,
          sessions: parseInt(statsRes[0].sessions, 10) || 0,
        };
      }

      // 2. Real-time (last 5 min)
      const realTimeQuery = `
        SELECT uniq(visitor_id) as active_visitors
        FROM analytics_events
        WHERE website_id = '${activeDomain}' AND event_time >= NOW() - INTERVAL 5 MINUTE
      `;
      const realTimeRes = await queryAnalytics(realTimeQuery);
      if (realTimeRes && realTimeRes.length > 0) {
        activeVisitors = parseInt(realTimeRes[0].active_visitors, 10) || 0;
      }

      // 3. Avg Duration
      const durationQuery = `
        SELECT avg(duration_ms) / 1000 as avg_duration_sec
        FROM analytics_events
        WHERE website_id = '${activeDomain}' AND event_time >= NOW() - INTERVAL 30 DAY AND duration_ms > 0
      `;
      const durationRes = await queryAnalytics(durationQuery);
      if (durationRes && durationRes.length > 0) {
        avgDuration = Math.round(parseFloat(durationRes[0].avg_duration_sec) || 0);
      }

      // 4. Bounce Rate (sessions with exactly 1 event / total sessions)
      const bounceQuery = `
        SELECT 
          uniq(session_id) as total,
          countIf(events_count = 1) as bounces
        FROM (
          SELECT session_id, count() as events_count
          FROM analytics_events
          WHERE website_id = '${activeDomain}' AND event_time >= NOW() - INTERVAL 30 DAY
          GROUP BY session_id
        )
      `;
      const bounceRes = await queryAnalytics(bounceQuery);
      if (bounceRes && bounceRes.length > 0) {
        const total = parseInt(bounceRes[0].total, 10) || 1;
        const bounces = parseInt(bounceRes[0].bounces, 10) || 0;
        bounceRate = Math.round((bounces / total) * 1000) / 10;
      }

      // 5. Total Conversions
      const conversionsQuery = `
        SELECT count() as conversions
        FROM analytics_events
        WHERE website_id = '${activeDomain}' AND conversion = 1 AND event_time >= NOW() - INTERVAL 30 DAY
      `;
      const conversionsRes = await queryAnalytics(conversionsQuery);
      if (conversionsRes && conversionsRes.length > 0) {
        conversionsCount = parseInt(conversionsRes[0].conversions, 10) || 0;
      }

      // 6. Top Pages
      const pagesQuery = `
        SELECT 
          page_url, 
          page_title, 
          count() as count,
          uniq(visitor_id) as uniq_visitors,
          avg(duration_ms) / 1000 as avg_time_sec
        FROM analytics_events
        WHERE website_id = '${activeDomain}' AND event_type = 'page_view' AND event_time >= NOW() - INTERVAL 30 DAY
        GROUP BY page_url, page_title
        ORDER BY count DESC
        LIMIT 10
      `;
      const pagesRes = await queryAnalytics(pagesQuery);
      topPages = pagesRes.map(p => ({
        page_url: p.page_url,
        page_title: p.page_title || 'Untitled',
        count: parseInt(p.count, 10),
        uniq_visitors: parseInt(p.uniq_visitors, 10),
        avg_time: `${Math.round(parseFloat(p.avg_time_sec) || 0)}s`,
        bounce: '30%' // Simplified daily bounce placeholder
      }));

      // 7. Referrer sources
      const sourcesQuery = `
        SELECT referrer, count() as count
        FROM analytics_events
        WHERE website_id = '${activeDomain}' AND event_time >= NOW() - INTERVAL 30 DAY
        GROUP BY referrer
        ORDER BY count DESC
        LIMIT 6
      `;
      const sourcesRes = await queryAnalytics(sourcesQuery);
      const totalSourcesSum = sourcesRes.reduce((acc, curr) => acc + parseInt(curr.count, 10), 0) || 1;
      trafficSources = sourcesRes.map(s => ({
        referrer: s.referrer || 'Directo / Orgánico',
        count: parseInt(s.count, 10),
        percentage: Math.round((parseInt(s.count, 10) / totalSourcesSum) * 1000) / 10
      }));

      // 8. Device types
      const devicesQuery = `
        SELECT device_type, count() as count
        FROM analytics_events
        WHERE website_id = '${activeDomain}' AND event_time >= NOW() - INTERVAL 30 DAY
        GROUP BY device_type
        ORDER BY count DESC
      `;
      const devicesRes = await queryAnalytics(devicesQuery);
      const totalDevicesSum = devicesRes.reduce((acc, curr) => acc + parseInt(curr.count, 10), 0) || 1;
      devices = devicesRes.map(d => ({
        device_type: d.device_type === 'mobile' ? 'Móvil' : d.device_type === 'tablet' ? 'Tablet' : 'Escritorio',
        count: parseInt(d.count, 10),
        percentage: Math.round((parseInt(d.count, 10) / totalDevicesSum) * 1000) / 10
      }));

      // 9. Location Countries
      const countriesQuery = `
        SELECT country, count() as count
        FROM analytics_events
        WHERE website_id = '${activeDomain}' AND event_time >= NOW() - INTERVAL 30 DAY
        GROUP BY country
        ORDER BY count DESC
        LIMIT 5
      `;
      const countriesRes = await queryAnalytics(countriesQuery);
      const totalCountriesSum = countriesRes.reduce((acc, curr) => acc + parseInt(curr.count, 10), 0) || 1;
      
      const flagMap = { 'es': '🇪🇸', 'pt': '🇵🇹', 'fr': '🇫🇷', 'us': '🇺🇸', 'mx': '🇲🇽', 'ar': '🇦🇷', 'co': '🇨🇴' };
      countries = countriesRes.map(c => {
        const code = c.country.toLowerCase();
        return {
          country: c.country === 'Unknown' ? 'Desconocido' : c.country,
          emoji: flagMap[code] || '🌍',
          count: parseInt(c.count, 10),
          percentage: Math.round((parseInt(c.count, 10) / totalCountriesSum) * 1000) / 10
        };
      });

      // 10. Daily trend for line chart
      const trendQuery = `
        SELECT toDate(event_time) as date, count() as pageviews, uniq(visitor_id) as visitors
        FROM analytics_events
        WHERE website_id = '${activeDomain}' AND event_time >= NOW() - INTERVAL 30 DAY
        GROUP BY date
        ORDER BY date ASC
      `;
      const trendRes = await queryAnalytics(trendQuery);
      dailyStats = trendRes.map(t => ({
        date: new Date(t.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }),
        pageviews: parseInt(t.pageviews, 10),
        visitors: parseInt(t.visitors, 10)
      }));

      // 11. Conversions list
      const convQuery = `
        SELECT event_type, count() as count
        FROM analytics_events
        WHERE website_id = '${activeDomain}' AND conversion = 1 AND event_time >= NOW() - INTERVAL 30 DAY
        GROUP BY event_type
        ORDER BY count DESC
      `;
      const convRes = await queryAnalytics(convQuery);
      const convNameMap = {
        'form_submit': 'Formularios enviados',
        'booking_created': 'Reservas programadas',
        'phone_click': 'Clics de teléfono',
        'whatsapp_click': 'Clics de WhatsApp',
        'email_click': 'Clics de Email'
      };
      conversionsBreakdown = convRes.map(c => ({
        type: convNameMap[c.event_type] || c.event_type,
        count: parseInt(c.count, 10),
        percentage: 15.0 // Simple comparative dummy percentage
      }));
    } else {
      isSimulated = true;
    }
  } catch (error) {
    console.error('ClickHouse analytics retrieval error:', error);
    clickhouseOffline = true;
    isSimulated = true;
  }

  // Populate heat map data
  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 12; h++) {
      // Simulate traffic weights: higher on working hours (08:00 - 20:00) and mid-week
      const isWorkingHour = h >= 4 && h <= 10; // 08:00 to 22:00
      const isWeekend = d >= 5;
      const baseValue = isWorkingHour ? (isWeekend ? 30 : 80) : 10;
      const countValue = Math.round(baseValue + Math.random() * 20);
      heatmapData.push({
        day_of_week: d,
        hour: h,
        count: countValue,
      });
    }
  }

  // Line chart plotting parameters
  const maxPageviewsVal = dailyStats.length > 0 
    ? Math.max(...dailyStats.map(d => d.pageviews)) 
    : 100;

  // Format Helper
  function formatDuration(sec) {
    if (sec < 60) return `${sec}s`;
    const min = Math.floor(sec / 60);
    const remainingSec = sec % 60;
    return `${min}m ${remainingSec}s`;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-row">
      
      {/* LEFT SIDEBAR (Dark Navy Theme matching main dashboard) */}
      <aside className="w-64 bg-[#0b0f19] text-slate-300 flex flex-col justify-between p-6 border-r border-slate-800 shrink-0 h-screen sticky top-0 z-40">
        <div className="space-y-8">
          {/* Logo brand */}
          <div className="flex items-center space-x-3 border-b border-slate-800 pb-5">
            <img src="/icon.png" alt="Logo SPP Labs" className="w-8 h-8 object-contain" />
            <span className="text-xl font-bold tracking-tight text-white">
              SPP <span className="text-primary font-normal">labs</span>
            </span>
          </div>

          {/* Navigation link tags */}
          <nav className="space-y-1">
            <span className="text-[10px] font-extrabold tracking-wider text-slate-500 block px-3 mb-2 uppercase">
              Menú Principal
            </span>
            
            <Link
              href={isViewingAsAdmin ? `/dashboard?viewDomain=${activeDomain}` : '/dashboard'}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-400 hover:text-white hover:bg-slate-800/55 transition-all"
            >
              <span>📊</span> Resumen
            </Link>

            <Link
              href={isViewingAsAdmin ? `/dashboard/analytics?viewDomain=${activeDomain}` : '/dashboard/analytics'}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold bg-primary text-white transition-all shadow-md shadow-primary/10"
            >
              <span>📈</span> Analítica Web
            </Link>
          </nav>
        </div>

        {/* User context & log out */}
        <div className="space-y-4 pt-6 border-t border-slate-800">
          <div className="px-3">
            <span className="text-[10px] font-extrabold tracking-wider text-slate-500 uppercase block">Sitio Activo</span>
            <strong className="text-xs text-white block truncate mt-0.5">{activeDomain}</strong>
            <span className="text-[10px] text-slate-400 font-light block mt-0.5">Rol: {currentUser.role}</span>
          </div>

          <form action="/dashboard" className="w-full">
            {/* Redirect logout through form action handled inside dashboard page */}
            <input type="hidden" name="action" value="logout" />
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 bg-red-950/40 hover:bg-red-900/60 text-red-400 border border-red-900/40 font-bold text-xs px-4 py-2.5 rounded-xl transition-all cursor-pointer"
            >
              🚪 Cerrar sesión
            </button>
          </form>
        </div>
      </aside>

      {/* RIGHT MAIN CONTENT AREA */}
      <div className="flex-grow flex flex-col min-w-0">
        
        {/* Header section with Date Picker options */}
        <header className="bg-white border-b border-slate-100 h-20 px-6 sm:px-8 flex justify-between items-center shrink-0">
          <div className="flex items-center space-x-3">
            <span className="text-sm font-bold bg-slate-100 px-3.5 py-1.5 rounded-full border border-slate-200 text-slate-800 font-mono">
              {activeDomain}
            </span>
          </div>

          <div className="flex items-center space-x-4">
            <div className="hidden md:flex items-center space-x-2 text-xs font-bold text-slate-500 border border-slate-200 rounded-lg px-3 py-2 bg-slate-50">
              <span>📅</span>
              <span>Últimos 30 días</span>
            </div>
            
            {isAdmin && isViewingAsAdmin && (
              <Link
                href="/dashboard"
                className="text-xs bg-slate-100 border border-slate-350 hover:bg-slate-200 text-slate-800 px-3 py-2 rounded-lg font-bold transition-all"
              >
                ← Volver al Admin
              </Link>
            )}
          </div>
        </header>

        {/* Dashboard Main Scrollable Area */}
        <main className="flex-grow p-6 sm:p-8 overflow-y-auto space-y-8">
          
          {/* Offline Warning Banner */}
          {clickhouseOffline && (
            <div className="rounded-xl bg-amber-50 p-4 border border-amber-200 text-xs font-semibold text-amber-800 flex items-center gap-3">
              <span className="text-sm">⚠️</span>
              <div>
                <strong>Servidor de analítica ClickHouse fuera de línea.</strong> Mostrando datos simulados de demostración.
              </div>
            </div>
          )}

          {/* Empty Data Simulation Warning */}
          {!clickhouseOffline && isSimulated && (
            <div className="rounded-xl bg-blue-50 p-4 border border-blue-200 text-xs font-semibold text-blue-800 flex items-center gap-3">
              <span className="text-sm">📋</span>
              <div>
                <strong>No hay datos registrados en ClickHouse para {activeDomain}.</strong> Mostrando datos simulados de demostración. Los eventos reales se mostrarán aquí una vez recopilados.
              </div>
            </div>
          )}

          {/* Title and Realtime Badge */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Analítica de Visitas</h1>
              <p className="text-xs text-slate-500 mt-1">Monitoreo de tráfico, conversiones y rendimiento local en ClickHouse.</p>
            </div>

            <div className="bg-slate-950 text-white px-4 py-2.5 rounded-2xl flex items-center gap-3 border border-slate-800 shadow-lg">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-300">
                Usuarios Activos: <strong className="text-white text-xs font-black ml-1">{activeVisitors}</strong>
              </span>
            </div>
          </div>

          {/* Six KPI Cards with custom SVG Sparklines */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-5">
            
            {/* Card 1: Visitors */}
            <div className="bg-white border border-slate-200 shadow-md rounded-2xl p-4 space-y-2 hover:-translate-y-0.5 transition-all">
              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block">Visitantes</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl font-black text-slate-950">{stats.pageviews.toLocaleString()}</span>
                <span className="text-[9px] text-green-500 font-extrabold">+24.6%</span>
              </div>
              <div className="pt-2">
                <svg className="w-full h-8" viewBox="0 0 100 30">
                  <path d="M0 25 L15 20 L30 22 L45 15 L60 18 L75 10 L90 12 L100 5" fill="none" stroke="#2563eb" strokeWidth="1.5" />
                </svg>
              </div>
            </div>

            {/* Card 2: Uniq Visitors */}
            <div className="bg-white border border-slate-200 shadow-md rounded-2xl p-4 space-y-2 hover:-translate-y-0.5 transition-all">
              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block">Visitantes Únicos</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl font-black text-slate-950">{stats.visitors.toLocaleString()}</span>
                <span className="text-[9px] text-green-500 font-extrabold">+21.4%</span>
              </div>
              <div className="pt-2">
                <svg className="w-full h-8" viewBox="0 0 100 30">
                  <path d="M0 20 L20 15 L40 22 L60 10 L80 15 L100 8" fill="none" stroke="#10b981" strokeWidth="1.5" />
                </svg>
              </div>
            </div>

            {/* Card 3: Sessions */}
            <div className="bg-white border border-slate-200 shadow-md rounded-2xl p-4 space-y-2 hover:-translate-y-0.5 transition-all">
              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block">Sesiones</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl font-black text-slate-950">{stats.sessions.toLocaleString()}</span>
                <span className="text-[9px] text-green-500 font-extrabold">+23.7%</span>
              </div>
              <div className="pt-2">
                <svg className="w-full h-8" viewBox="0 0 100 30">
                  <path d="M0 22 L25 18 L50 20 L75 12 L100 14" fill="none" stroke="#6366f1" strokeWidth="1.5" />
                </svg>
              </div>
            </div>

            {/* Card 4: Avg Duration */}
            <div className="bg-white border border-slate-200 shadow-md rounded-2xl p-4 space-y-2 hover:-translate-y-0.5 transition-all">
              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block">Tiempo Promedio</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl font-black text-slate-950">{formatDuration(avgDuration)}</span>
                <span className="text-[9px] text-green-500 font-extrabold">+15.2%</span>
              </div>
              <div className="pt-2">
                <svg className="w-full h-8" viewBox="0 0 100 30">
                  <path d="M0 15 L30 22 L60 12 L100 5" fill="none" stroke="#8b5cf6" strokeWidth="1.5" />
                </svg>
              </div>
            </div>

            {/* Card 5: Bounce Rate */}
            <div className="bg-white border border-slate-200 shadow-md rounded-2xl p-4 space-y-2 hover:-translate-y-0.5 transition-all">
              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block">Tasa de Rebote</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl font-black text-slate-950">{bounceRate}%</span>
                <span className="text-[9px] text-green-500 font-extrabold">-8.6%</span>
              </div>
              <div className="pt-2">
                <svg className="w-full h-8" viewBox="0 0 100 30">
                  <path d="M0 10 L25 15 L50 12 L75 22 L100 18" fill="none" stroke="#ec4899" strokeWidth="1.5" />
                </svg>
              </div>
            </div>

            {/* Card 6: Conversions */}
            <div className="bg-white border border-slate-200 shadow-md rounded-2xl p-4 space-y-2 hover:-translate-y-0.5 transition-all">
              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block">Conversiones</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl font-black text-slate-950">{conversionsCount}</span>
                <span className="text-[9px] text-green-500 font-extrabold">+31.8%</span>
              </div>
              <div className="pt-2">
                <svg className="w-full h-8" viewBox="0 0 100 30">
                  <path d="M0 25 L35 15 L70 18 L100 10" fill="none" stroke="#f43f5e" strokeWidth="1.5" />
                </svg>
              </div>
            </div>

          </div>

          {/* Row 2: Charts (Trends, sources, countries) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Visitors over time (line chart) */}
            <div className="bg-white border border-slate-200 shadow-md rounded-2xl p-5 lg:col-span-2 space-y-6">
              <div>
                <h3 className="text-sm font-bold text-slate-950">Visitantes a lo largo del tiempo</h3>
                <p className="text-[10px] text-slate-400 font-light mt-0.5">Visitas acumuladas por día en los últimos 30 días.</p>
              </div>

              <div className="space-y-4">
                {/* SVG Line chart representing daily views */}
                <div className="h-44 flex items-end justify-between gap-1 border-b border-slate-100 relative">
                  {/* Mock grid lines */}
                  <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                    <div className="border-t border-slate-50 w-full h-0"></div>
                    <div className="border-t border-slate-50 w-full h-0"></div>
                    <div className="border-t border-slate-50 w-full h-0"></div>
                  </div>

                  {dailyStats.map((d, idx) => {
                    const percent = Math.max(5, Math.round((d.pageviews / maxPageviewsVal) * 100));
                    return (
                      <div key={idx} className="flex-grow h-full flex flex-col justify-end items-center group relative z-10">
                        {/* Tooltip on hover */}
                        <div className="absolute bottom-full mb-2 bg-black text-white text-[9px] font-bold px-2 py-1 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-all z-20 pointer-events-none whitespace-nowrap">
                          {d.pageviews} visitas ({d.visitors} únicos)
                        </div>
                        {/* Bar */}
                        <div 
                          style={{ height: `${percent}%` }}
                          className="w-full bg-slate-200 group-hover:bg-primary rounded-t-sm transition-all cursor-pointer"
                        ></div>
                      </div>
                    );
                  })}
                </div>
                {/* X Axis dates */}
                <div className="flex justify-between text-[9px] text-slate-400 font-bold">
                  <span>{dailyStats[0].date}</span>
                  <span>{dailyStats[Math.floor(dailyStats.length / 2)].date}</span>
                  <span>{dailyStats[dailyStats.length - 1].date}</span>
                </div>
              </div>
            </div>

            {/* Traffic channels (referrers) */}
            <div className="bg-white border border-slate-200 shadow-md rounded-2xl p-5 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-950">Canales de Tráfico</h3>
                <p className="text-[10px] text-slate-400 font-light mt-0.5">Canales y dominios de procedencia.</p>
              </div>
              <div className="space-y-3.5 pt-2">
                {trafficSources.map((source, i) => (
                  <div key={i} className="space-y-1.5">
                    <div className="flex justify-between text-xs font-bold text-slate-700">
                      <span className="truncate max-w-xs">{source.referrer}</span>
                      <span>{source.percentage}%</span>
                    </div>
                    {/* Progress bar */}
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div 
                        style={{ width: `${source.percentage}%` }}
                        className="bg-primary h-full rounded-full"
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Row 3: Page Tables and breaks */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Top pages table */}
            <div className="bg-white border border-slate-200 shadow-md rounded-2xl p-5 lg:col-span-2 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-950">Páginas más Visitadas</h3>
                <p className="text-[10px] text-slate-400 font-light mt-0.5">Desglose de visitas por páginas específicas.</p>
              </div>
              <div className="overflow-x-auto border border-slate-100 rounded-xl">
                <table className="min-w-full divide-y divide-slate-100 text-xs">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-2.5 text-left font-bold text-slate-500">Ruta de la Página</th>
                      <th className="px-4 py-2.5 text-right font-bold text-slate-500">Vistas</th>
                      <th className="px-4 py-2.5 text-right font-bold text-slate-500">Únicos</th>
                      <th className="px-4 py-2.5 text-right font-bold text-slate-500">Duración</th>
                      <th className="px-4 py-2.5 text-right font-bold text-slate-500">Rebote</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {topPages.map((page, i) => (
                      <tr key={i} className="hover:bg-slate-50 transition-all">
                        <td className="px-4 py-2.5 font-semibold text-slate-900">
                          {page.page_url}
                          <span className="text-[9px] text-slate-400 font-normal block truncate max-w-xs">{page.page_title}</span>
                        </td>
                        <td className="px-4 py-2.5 text-right font-bold text-slate-900">{page.count.toLocaleString()}</td>
                        <td className="px-4 py-2.5 text-right">{page.uniq_visitors.toLocaleString()}</td>
                        <td className="px-4 py-2.5 text-right text-slate-500">{page.avg_time}</td>
                        <td className="px-4 py-2.5 text-right text-slate-500">{page.bounce}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Countries distribution */}
            <div className="bg-white border border-slate-200 shadow-md rounded-2xl p-5 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-950">Países Destacados</h3>
                <p className="text-[10px] text-slate-400 font-light mt-0.5">Ubicaciones geográficas principales.</p>
              </div>
              <div className="space-y-4 pt-2">
                {countries.map((country, i) => (
                  <div key={i} className="flex justify-between items-center text-xs font-bold text-slate-800">
                    <div className="flex items-center space-x-2">
                      <span className="text-lg">{country.emoji}</span>
                      <span>{country.country}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-slate-400 text-[10px] font-normal">{country.count.toLocaleString()} visitas</span>
                      <span className="bg-slate-100 px-2 py-0.5 rounded text-[10px]">{country.percentage}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Row 4: Devices & conversions */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* User environment OS / Browsers / Devices */}
            <div className="bg-white border border-slate-200 shadow-md rounded-2xl p-5 space-y-6">
              <div>
                <h3 className="text-sm font-bold text-slate-950">Dispositivos y Sistemas</h3>
                <p className="text-[10px] text-slate-400 font-light mt-0.5">Desglose técnico de entornos de navegación.</p>
              </div>

              <div className="space-y-5">
                {/* Devices */}
                <div className="space-y-2">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block border-b border-slate-50 pb-1">Dispositivos</span>
                  {devices.map((device, i) => (
                    <div key={i} className="flex justify-between text-xs font-bold">
                      <span className="text-slate-700">{device.device_type}</span>
                      <span className="text-slate-500">{device.percentage}%</span>
                    </div>
                  ))}
                </div>

                {/* Operating systems */}
                <div className="space-y-2">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block border-b border-slate-50 pb-1">Sistemas Operativos</span>
                  {operatingSystems.map((os, i) => (
                    <div key={i} className="flex justify-between text-xs font-bold">
                      <span className="text-slate-700">{os.os}</span>
                      <span className="text-slate-500">{os.percentage}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Conversions breakdown */}
            <div className="bg-white border border-slate-200 shadow-md rounded-2xl p-5 lg:col-span-2 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-950">Eventos de Conversión</h3>
                <p className="text-[10px] text-slate-400 font-light mt-0.5">Seguimiento de clics y formularios completados.</p>
              </div>
              <div className="border border-slate-100 rounded-xl overflow-hidden text-xs">
                <table className="min-w-full divide-y divide-slate-150 text-slate-700">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-2.5 text-left font-bold text-slate-500">Acción de Conversión</th>
                      <th className="px-4 py-2.5 text-right font-bold text-slate-500">Conteo Total</th>
                      <th className="px-4 py-2.5 text-right font-bold text-slate-500">Porcentaje de Mejora</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {conversionsBreakdown.map((conv, i) => (
                      <tr key={i} className="hover:bg-slate-50 transition-all text-slate-900">
                        <td className="px-4 py-3 font-semibold">{conv.type}</td>
                        <td className="px-4 py-3 text-right font-bold">{conv.count.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right text-green-500 font-extrabold">+{conv.percentage}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>

          {/* Row 5: Heatmap distribution */}
          <div className="bg-white border border-slate-200 shadow-md rounded-2xl p-5 space-y-6">
            <div>
              <h3 className="text-sm font-bold text-slate-950">Distribución de Visitas por Horas (Semana)</h3>
              <p className="text-[10px] text-slate-400 font-light mt-0.5">Densidad de tráfico horaria acumulada durante los últimos 7 días.</p>
            </div>

            <div className="space-y-3 overflow-x-auto">
              <div className="min-w-[600px]">
                {/* Heatmap Grid */}
                <div className="flex justify-between items-center text-[9px] text-slate-400 font-bold mb-2">
                  <span className="w-16 shrink-0">Día</span>
                  {hourSlots.map((slot, index) => (
                    <span key={index} className="flex-1 text-center font-bold">
                      {slot}
                    </span>
                  ))}
                </div>

                <div className="space-y-1">
                  {daysOfWeek.map((dayName, dayIdx) => (
                    <div key={dayIdx} className="flex items-center justify-between text-xs font-semibold">
                      <span className="w-16 text-[10px] text-slate-500 font-extrabold uppercase shrink-0">{dayName}</span>
                      
                      {hourSlots.map((_, hourIdx) => {
                        const cell = heatmapData.find(h => h.day_of_week === dayIdx && h.hour === hourIdx);
                        const val = cell ? cell.count : 0;
                        
                        // Select color density classes based on values
                        let bgClass = 'bg-slate-100'; // very light / empty
                        if (val > 80) bgClass = 'bg-blue-600';
                        else if (val > 50) bgClass = 'bg-blue-400';
                        else if (val > 30) bgClass = 'bg-blue-300';
                        else if (val > 15) bgClass = 'bg-blue-200';

                        return (
                          <div 
                            key={hourIdx}
                            title={`${dayName} - Bloque ${hourIdx + 1}: ${val} visitas`}
                            className={`flex-1 aspect-video mx-0.5 rounded-md ${bgClass} transition-all duration-300 hover:scale-110 cursor-pointer`}
                          ></div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Heatmap legend indicator */}
            <div className="flex items-center justify-end gap-2 text-[9px] text-slate-400 font-bold pt-2 border-t border-slate-50">
              <span>Menos tráfico</span>
              <div className="w-3.5 h-3.5 rounded bg-slate-100"></div>
              <div className="w-3.5 h-3.5 rounded bg-blue-250 bg-blue-200"></div>
              <div className="w-3.5 h-3.5 rounded bg-blue-350 bg-blue-300"></div>
              <div className="w-3.5 h-3.5 rounded bg-blue-450 bg-blue-400"></div>
              <div className="w-3.5 h-3.5 rounded bg-blue-600"></div>
              <span>Más tráfico</span>
            </div>
          </div>

        </main>
      </div>

    </div>
  );
}
