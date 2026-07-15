import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { db } from '../../lib/db';
import { verifyJWT } from '../../lib/auth';
import crypto from 'crypto';

export const metadata = {
  title: 'Panel de Control - SPP Labs',
  description: 'Administra tus contactos, reservas, chatbot de IA y analíticas.',
};

export default async function DashboardPage(props) {
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

  // Extract query search parameters safely
  const searchParams = await props.searchParams;
  const viewDomain = searchParams?.viewDomain || '';
  const errorMsg = searchParams?.error || '';
  const successMsg = searchParams?.success || '';
  const generatedToken = searchParams?.token || '';
  const generatedApiKey = searchParams?.apiKey || '';
  const generatedDomain = searchParams?.domain || '';

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
  let activeWebsiteId = currentUser.id;
  let isViewingAsAdmin = false;

  if (isAdmin && viewDomain) {
    const targetWebsite = await db.withAdmin(async (tx) => {
      return await tx.website.findUnique({
        where: { domain: viewDomain },
      });
    });
    if (targetWebsite) {
      activeDomain = targetWebsite.domain;
      activeWebsiteId = targetWebsite.id;
      isViewingAsAdmin = true;
    }
  }

  // Fetch tenant data
  const { contacts, bookings, notifications, chatbotKnowledge, apiKeysList } = await db.withTenant(activeWebsiteId, async (tx) => {
    const [contactsList, bookingsList, notificationsList, chatbot, apiKeys] = await Promise.all([
      tx.contactForm.findMany({
        where: { websiteId: activeWebsiteId },
        orderBy: { createdAt: 'desc' },
      }),
      tx.booking.findMany({
        where: { websiteId: activeWebsiteId },
        orderBy: [
          { date: 'asc' },
          { time: 'asc' }
        ],
      }),
      tx.notification.findMany({
        where: { websiteId: activeWebsiteId },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      tx.chatbotKnowledge.findUnique({
        where: { websiteId: activeWebsiteId },
      }),
      tx.websiteApiKey.findMany({
        where: { websiteId: activeWebsiteId },
        orderBy: { createdAt: 'desc' },
      })
    ]);
    return {
      contacts: contactsList,
      bookings: bookingsList,
      notifications: notificationsList,
      chatbotKnowledge: chatbot,
      apiKeysList: apiKeys
    };
  });

  // Admin-only data
  let allWebsites = [];
  let signupTokens = [];
  if (isAdmin) {
    const adminData = await db.withAdmin(async (tx) => {
      const [websitesList, tokensList] = await Promise.all([
        tx.website.findMany({
          orderBy: { domain: 'asc' },
        }),
        tx.signupToken.findMany({
          orderBy: { createdAt: 'desc' },
        }),
      ]);
      return { websitesList, tokensList };
    });
    allWebsites = adminData.websitesList;
    signupTokens = adminData.tokensList;
  }

  // --- SERVER ACTIONS ---

  async function handleLogout() {
    'use server';
    const cookieStore = await cookies();
    cookieStore.delete('token');
    redirect('/login');
  }

  async function handleGenerateToken(formData) {
    'use server';
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return;
    const payload = await verifyJWT(token);
    if (!payload || payload.role !== 'ADMIN' || payload.domain !== 'spplabs.es') return;

    const targetDomain = formData.get('domain')?.trim().toLowerCase();
    if (!targetDomain) {
      redirect('/dashboard?error=El+nombre+de+dominio+es+obligatorio');
    }

    let redirectUrl = '';
    try {
      const rawApiKey = 'spp_live_' + crypto.randomBytes(24).toString('hex');
      const hashedApiKey = crypto.createHash('sha256').update(rawApiKey).digest('hex');
      const tokenString = 'spp_tok_' + crypto.randomBytes(16).toString('hex').toUpperCase();

      await db.withAdmin(async (tx) => {
        let website = await tx.website.findUnique({
          where: { domain: targetDomain },
        });

        if (!website) {
          website = await tx.website.create({
            data: {
              domain: targetDomain,
              displayName: targetDomain,
              role: 'USER',
            },
          });
        }

        await tx.websiteApiKey.upsert({
          where: {
            websiteId_name: {
              websiteId: website.id,
              name: 'Default API Key',
            },
          },
          update: {
            keyHash: hashedApiKey,
            createdAt: new Date(),
          },
          create: {
            websiteId: website.id,
            name: 'Default API Key',
            keyHash: hashedApiKey,
          },
        });

        await tx.signupToken.upsert({
          where: { domain: targetDomain },
          update: {
            token: tokenString,
            createdAt: new Date(),
          },
          create: {
            domain: targetDomain,
            token: tokenString,
          },
        });
      });

      redirectUrl = `/dashboard?success=${encodeURIComponent(`Credenciales generadas para ${targetDomain}`)}&token=${tokenString}&apiKey=${rawApiKey}&domain=${targetDomain}`;
    } catch (e) {
      console.error(e);
      redirectUrl = '/dashboard?error=Error+al+generar+el+token+y+la+clave+API';
    }

    if (redirectUrl) {
      redirect(redirectUrl);
    }
  }

  async function handleDeleteToken(formData) {
    'use server';
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return;
    const payload = await verifyJWT(token);
    if (!payload || payload.role !== 'ADMIN' || payload.domain !== 'spplabs.es') return;

    const tokenId = formData.get('tokenId');

    let redirectUrl = '';
    try {
      await db.withAdmin(async (tx) => {
        await tx.signupToken.delete({
          where: { id: tokenId },
        });
      });
      redirectUrl = '/dashboard?success=Token+eliminado';
    } catch (e) {
      redirectUrl = '/dashboard?error=Error+al+eliminar+el+token';
    }

    if (redirectUrl) {
      redirect(redirectUrl);
    }
  }

  async function handleDeleteWebsite(formData) {
    'use server';
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return;
    const payload = await verifyJWT(token);
    if (!payload || payload.role !== 'ADMIN' || payload.domain !== 'spplabs.es') return;

    const websiteId = formData.get('websiteId');

    let redirectUrl = '';
    try {
      await db.withAdmin(async (tx) => {
        await tx.website.delete({
          where: { id: websiteId },
        });
      });
      redirectUrl = '/dashboard?success=Sitio+web+eliminado';
    } catch (e) {
      redirectUrl = '/dashboard?error=Error+al+eliminar+el+sitio+web';
    }

    if (redirectUrl) {
      redirect(redirectUrl);
    }
  }

  async function handleUpdateBookingStatus(formData) {
    'use server';
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return;
    const payload = await verifyJWT(token);
    if (!payload) return;

    const bookingId = formData.get('bookingId');
    const newStatus = formData.get('status');

    let redirectUrl = '';
    try {
      await db.withTenant(activeWebsiteId, async (tx) => {
        await tx.booking.update({
          where: { id: bookingId },
          data: { status: newStatus },
        });
      });
      redirectUrl = `/dashboard?viewDomain=${activeDomain}&success=Estado+de+reserva+actualizado`;
    } catch (e) {
      redirectUrl = `/dashboard?viewDomain=${activeDomain}&error=Error+al+actualizar+el+estado+de+la+reserva`;
    }

    if (redirectUrl) {
      redirect(redirectUrl);
    }
  }

  async function handleSaveChatbotKnowledge(formData) {
    'use server';
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return;
    const payload = await verifyJWT(token);
    if (!payload) return;

    const knowledgeContent = formData.get('knowledgeContent');

    let redirectUrl = '';
    try {
      await db.withTenant(activeWebsiteId, async (tx) => {
        await tx.chatbotKnowledge.upsert({
          where: { websiteId: activeWebsiteId },
          update: {
            content: knowledgeContent,
            updatedAt: new Date(),
          },
          create: {
            websiteId: activeWebsiteId,
            content: knowledgeContent,
          },
        });

        await tx.notification.create({
          data: {
            websiteId: activeWebsiteId,
            title: 'Base de Conocimiento Actualizada',
            message: 'La base de conocimiento de tu chatbot de IA ha sido guardada y re-indexada con éxito.',
          }
        });
      });

      redirectUrl = `/dashboard?viewDomain=${activeDomain}&success=Base+de+conocimiento+guardada`;
    } catch (e) {
      console.error(e);
      redirectUrl = `/dashboard?viewDomain=${activeDomain}&error=Error+al+guardar+la+base+de+conocimiento`;
    }

    if (redirectUrl) {
      redirect(redirectUrl);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-row">
      
      {/* LEFT SIDEBAR (Dark Navy Theme) */}
      <aside className="w-64 bg-[#0b0f19] text-slate-300 flex flex-col justify-between p-6 border-r border-slate-800 shrink-0 sticky top-0 h-screen z-40">
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
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold bg-primary text-white transition-all shadow-md shadow-primary/10"
            >
              <span>📊</span> Resumen
            </Link>

            <Link
              href={isViewingAsAdmin ? `/dashboard/analytics?viewDomain=${activeDomain}` : '/dashboard/analytics'}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-400 hover:text-white hover:bg-slate-800/55 transition-all"
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

          <form action={handleLogout} className="w-full">
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
        
        {/* Top Header */}
        <header className="bg-white border-b border-slate-100 h-20 px-6 sm:px-8 flex justify-between items-center shrink-0">
          <div className="flex items-center space-x-3">
            <span className="text-sm font-bold bg-slate-100 px-3.5 py-1.5 rounded-full border border-slate-200 text-slate-800 font-mono">
              {activeDomain} {isViewingAsAdmin && <span className="text-secondary">(Admin Mode)</span>}
            </span>
          </div>

          <div className="text-xs text-slate-500">
            Usuario: <strong className="text-slate-900 font-bold">{currentUser.domain}</strong>
          </div>
        </header>

        {/* Dashboard Main Workspace */}
        <main className="flex-grow p-6 sm:p-8 overflow-y-auto space-y-8">
          
          {/* Banner Alert Messages */}
          {errorMsg && (
            <div className="rounded-xl bg-red-50 p-4 border border-red-200 text-sm font-medium text-red-800 text-center">
              {errorMsg}
            </div>
          )}
          {successMsg && (
            <div className="rounded-xl bg-green-50 p-4 border border-green-200 text-sm font-medium text-green-800 text-center">
              {successMsg}
            </div>
          )}

          {/* --- ADMIN INTERFACE --- */}
          {isAdmin && !isViewingAsAdmin && (
            <div className="space-y-8">
              <div className="flex justify-between items-center border-b border-slate-200 pb-3">
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                  Consola de Administración
                </h1>
                <span className="text-xs bg-black text-white px-2.5 py-1 rounded-full font-bold uppercase">Súper Admin</span>
              </div>

              {/* Token and API Key Generation Success Alert */}
              {generatedToken && generatedApiKey && (
                <div className="bg-green-50 border border-green-200 shadow-lg rounded-2xl p-6 space-y-4">
                  <h3 className="text-lg font-bold text-green-800 flex items-center gap-2">
                    🎉 ¡Credenciales de Cliente Generadas!
                  </h3>
                  <p className="text-xs text-green-700 leading-relaxed font-light">
                    A continuación se muestran los datos de acceso para <strong>{generatedDomain}</strong>. Por favor, cópialos ahora. La clave API está encriptada en la base de datos y <strong>no se volverá a mostrar en pantalla</strong>.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white border border-green-100 rounded-xl p-4 space-y-2">
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Token de Registro (Signup Token)</span>
                      <div className="bg-slate-50 border border-slate-100 rounded-lg p-2.5 font-mono text-xs text-red-600 break-all select-all font-bold">
                        {generatedToken}
                      </div>
                      <p className="text-[10px] text-slate-400 font-sans">Facilita este token a tu cliente para que active su cuenta en `/signup`.</p>
                    </div>
                    <div className="bg-white border border-green-100 rounded-xl p-4 space-y-2">
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Clave API del Sitio Web (.env)</span>
                      <div className="bg-slate-50 border border-slate-100 rounded-lg p-2.5 font-mono text-xs text-green-600 break-all select-all font-bold">
                        {generatedApiKey}
                      </div>
                      <p className="text-[10px] text-slate-400 font-sans">Configura esta clave en el archivo <code>.env</code> del sitio del cliente: <code>API_KEY={generatedApiKey}</code></p>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                
                {/* Token Generator Panel */}
                <div className="bg-white border border-slate-200 shadow-md rounded-2xl p-6 md:col-span-1 space-y-4">
                  <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2">
                    Generar Token de Registro
                  </h2>
                  <form action={handleGenerateToken} className="space-y-4">
                    <div>
                      <label htmlFor="domain" className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                        Dominio del Cliente
                      </label>
                      <input
                        type="text"
                        name="domain"
                        required
                        placeholder="dominio-cliente.com"
                        className="mt-1.5 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full bg-primary hover:bg-green-600 text-white font-bold text-sm px-4 py-2.5 rounded-lg transition-all cursor-pointer"
                    >
                      Generar Token de Registro
                    </button>
                  </form>
                </div>

                {/* Tokens Table */}
                <div className="bg-white border border-slate-200 shadow-md rounded-2xl p-6 md:col-span-2 space-y-4">
                  <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2">
                    Tokens Pendientes de Activación
                  </h2>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200 text-xs">
                      <thead>
                        <tr>
                          <th className="px-4 py-2 text-left font-bold text-slate-500 uppercase">Dominio</th>
                          <th className="px-4 py-2 text-left font-bold text-slate-500 uppercase">Código del Token</th>
                          <th className="px-4 py-2 text-left font-bold text-slate-500 uppercase">Creado</th>
                          <th className="px-4 py-2 text-right">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {signupTokens.length === 0 ? (
                          <tr>
                            <td colSpan="4" className="px-4 py-6 text-center text-slate-400">
                              No hay tokens de activación pendientes.
                            </td>
                          </tr>
                        ) : (
                          signupTokens.map((t) => (
                            <tr key={t.id}>
                              <td className="px-4 py-3 font-semibold text-slate-900">{t.domain}</td>
                              <td className="px-4 py-3">
                                <code className="bg-slate-100 border border-slate-200 px-2 py-1 rounded text-red-600 text-[10px] font-mono select-all font-bold">
                                  {t.token}
                                </code>
                              </td>
                              <td className="px-4 py-3 text-slate-400">{new Date(t.createdAt).toLocaleDateString()}</td>
                              <td className="px-4 py-3 text-right">
                                <form action={handleDeleteToken} className="inline">
                                  <input type="hidden" name="tokenId" value={t.id} />
                                  <button
                                    type="submit"
                                    className="text-[10px] bg-red-50 hover:bg-red-100 text-red-600 font-bold px-2 py-1 rounded-lg border border-red-200 transition-all cursor-pointer"
                                  >
                                    Cancelar
                                  </button>
                                </form>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Registered Websites & Dashboards */}
              <div className="bg-white border border-slate-200 shadow-md rounded-2xl p-6">
                <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-3 mb-4">
                  Sitios Web y Clientes Activos
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {allWebsites.map((w) => (
                    <div key={w.id} className="border border-slate-200 rounded-xl p-5 hover:border-secondary shadow-sm transition-all flex flex-col justify-between space-y-4 bg-white">
                      <div>
                        <h3 className="text-base font-bold text-slate-900">{w.domain}</h3>
                        <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider font-bold">Rol: <span className="font-semibold">{w.role}</span></p>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Registro: {w.registeredAt ? new Date(w.registeredAt).toLocaleDateString() : 'Pendiente'}</p>
                      </div>
                      <div className="flex space-x-2 pt-2 border-t border-slate-100">
                        <Link
                          href={`/dashboard?viewDomain=${w.domain}`}
                          className="flex-grow text-center bg-secondary hover:bg-blue-600 text-white text-xs font-bold px-3 py-2 rounded-lg transition-all"
                        >
                          Inspeccionar
                        </Link>
                        {w.domain !== 'spplabs.es' && (
                          <form action={handleDeleteWebsite} className="inline">
                            <input type="hidden" name="websiteId" value={w.id} />
                            <button
                              type="submit"
                              className="bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold px-3 py-2 rounded-lg border border-red-100 transition-all cursor-pointer"
                            >
                              Eliminar
                            </button>
                          </form>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* --- CLIENT / TENANT WORKSPACE --- */}
          {(!isAdmin || isViewingAsAdmin) && (
            <div className="space-y-8">
              {/* Header */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-200 pb-4 space-y-2 sm:space-y-0">
                <div>
                  <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                    Resumen del Sitio
                  </h1>
                  <p className="text-xs text-slate-500 mt-1">
                    Control de servicios y registros activos para <strong className="text-slate-950 font-bold">{activeDomain}</strong>
                  </p>
                </div>
                <div className="bg-primary/10 border border-primary/20 rounded-xl px-3.5 py-1.5 text-primary font-bold text-[10px] uppercase tracking-wider">
                  Estado: Activo
                </div>
              </div>

              {/* Analytics Overview Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white border border-slate-200 shadow-md rounded-2xl p-5 border-l-4 border-l-primary space-y-2 hover:shadow-lg transition-all">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Mensajes Recibidos</span>
                  <span className="text-3xl font-black text-slate-950 block">{contacts.length}</span>
                  <span className="text-[10px] text-slate-500 font-semibold block">Formularios de contacto de tu web</span>
                </div>
                <div className="bg-white border border-slate-200 shadow-md rounded-2xl p-5 border-l-4 border-l-secondary space-y-2 hover:shadow-lg transition-all">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Reservas Activas</span>
                  <span className="text-3xl font-black text-slate-950 block">
                    {bookings.filter(b => b.status === 'PENDING').length} <span className="text-xs text-slate-400 font-normal">pendientes</span>
                  </span>
                  <span className="text-[10px] text-slate-500 font-semibold block">{bookings.length} reservas programadas</span>
                </div>
                <div className="bg-white border border-slate-200 shadow-md rounded-2xl p-5 border-l-4 border-l-black space-y-2 hover:shadow-lg transition-all">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Consumo Mensual RAG</span>
                  <span className="text-3xl font-black text-slate-950 block">0</span>
                  <span className="text-[10px] text-slate-500 font-semibold block">Conectado a Qdrant db</span>
                </div>
                <div className="bg-white border border-slate-200 shadow-md rounded-2xl p-5 border-l-4 border-l-green-600 space-y-2 hover:shadow-lg transition-all">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Conocimiento del Bot</span>
                  <span className="text-sm font-bold text-slate-950 block truncate">
                    {chatbotKnowledge?.content ? `${chatbotKnowledge.content.length} caracteres` : 'No configurado'}
                  </span>
                  <span className="text-[10px] text-slate-500 font-semibold block">Sincronizado: {chatbotKnowledge?.lastSyncedAt ? new Date(chatbotKnowledge.lastSyncedAt).toLocaleDateString() : 'Nunca'}</span>
                </div>
              </div>

              {/* API Keys Configuration Card */}
              <div className="bg-[#0b0f19] border border-slate-800 shadow-xl rounded-2xl p-6 space-y-4 text-slate-300">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    🔑 Integración y Clave API de tu Web
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Usa esta clave en el archivo de configuración <code>.env</code> de tu sitio web para validar los envíos de reservas y contactos.
                  </p>
                </div>
                <div className="bg-[#121824] border border-slate-800 rounded-xl p-4">
                  {apiKeysList.length === 0 ? (
                    <div className="text-center py-4 text-xs text-slate-500">
                      No se han generado claves API para este sitio. Contacta al administrador.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {apiKeysList.map((key) => (
                        <div key={key.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-800 last:border-b-0 pb-3 last:pb-0">
                          <div className="space-y-1">
                            <p className="text-xs font-bold text-white">{key.name}</p>
                            <p className="text-[10px] text-slate-400 font-mono">
                              Hash de la Clave: <code>{key.keyHash.substring(0, 16)}...</code>
                            </p>
                            <p className="text-[9px] text-slate-500 font-bold uppercase">
                              Creada el: {new Date(key.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="mt-2 sm:mt-0">
                            <span className="inline-block bg-green-950/40 text-green-400 text-[10px] font-bold px-2 py-1 rounded border border-green-900/30">
                              Último Uso: {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleString() : 'Nunca'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Split Panels */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* Chatbot Knowledge Plain Text Editor */}
                <div className="lg:col-span-1 bg-white border border-slate-200 shadow-md rounded-2xl p-6 space-y-4">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">Base de Conocimiento del Bot</h2>
                    <p className="text-xs text-slate-500 mt-1">Suministra la información, preguntas frecuentes y servicios en texto plano para entrenar a tu chatbot inteligente.</p>
                  </div>
                  <form action={handleSaveChatbotKnowledge} className="space-y-4">
                    <textarea
                      name="knowledgeContent"
                      rows="14"
                      required
                      placeholder="Escribe la información de tu negocio aquí..."
                      defaultValue={chatbotKnowledge?.content || ''}
                      className="w-full rounded-xl border border-slate-300 p-4 text-sm font-sans focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary shadow-inner bg-slate-50 text-slate-900"
                    ></textarea>
                    <button
                      type="submit"
                      className="w-full bg-slate-950 hover:bg-slate-900 text-white font-bold text-xs py-3 rounded-xl transition-all cursor-pointer flex justify-center items-center shadow-md"
                    >
                      Guardar y Actualizar Chatbot
                    </button>
                  </form>
                </div>

                {/* Contact Form Submissions Table */}
                <div className="lg:col-span-2 bg-white border border-slate-200 shadow-md rounded-2xl p-6 space-y-4">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">Contactos y Mensajes Recibidos</h2>
                    <p className="text-xs text-slate-500 mt-1">Formularios de contacto diligenciados por usuarios en tu web.</p>
                  </div>
                  <div className="overflow-y-auto max-h-[460px] border border-slate-100 rounded-xl">
                    <table className="min-w-full divide-y divide-slate-100 text-xs">
                      <thead className="bg-slate-50 sticky top-0 z-10">
                        <tr>
                          <th className="px-4 py-3 text-left font-bold text-slate-500 uppercase">Información del Cliente</th>
                          <th className="px-4 py-3 text-left font-bold text-slate-500 uppercase">Mensaje</th>
                          <th className="px-4 py-3 text-left font-bold text-slate-500 uppercase">Recibido</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-800">
                        {contacts.length === 0 ? (
                          <tr>
                            <td colSpan="3" className="px-4 py-8 text-center text-slate-400">
                              No hay formularios de contacto registrados todavía.
                            </td>
                          </tr>
                        ) : (
                          contacts.map((c) => (
                            <tr key={c.id} className="hover:bg-slate-50/70 transition-all">
                              <td className="px-4 py-3 space-y-1">
                                <div className="font-bold text-slate-900">{c.name}</div>
                                <div className="text-slate-400">{c.email}</div>
                                {c.phone && <div className="text-slate-400">{c.phone}</div>}
                              </td>
                              <td className="px-4 py-3">
                                <p className="text-slate-700 whitespace-pre-wrap max-w-md line-clamp-3 hover:line-clamp-none transition-all">{c.message}</p>
                              </td>
                              <td className="px-4 py-3 text-slate-400 whitespace-nowrap">
                                {new Date(c.createdAt).toLocaleString()}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>

              {/* Booking Requests Dashboard Panel */}
              <div className="bg-white border border-slate-200 shadow-md rounded-2xl p-6 space-y-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Agenda y Control de Citas</h2>
                  <p className="text-xs text-slate-500 mt-1">Revisa y gestiona las reservas de tu calendario.</p>
                </div>
                <div className="overflow-x-auto border border-slate-100 rounded-xl">
                  <table className="min-w-full divide-y divide-slate-200 text-xs">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-4 py-3 text-left font-bold text-slate-500 uppercase">Fecha y Hora</th>
                        <th className="px-4 py-3 text-left font-bold text-slate-500 uppercase">Cliente</th>
                        <th className="px-4 py-3 text-left font-bold text-slate-500 uppercase">Mensaje</th>
                        <th className="px-4 py-3 text-left font-bold text-slate-500 uppercase">Estado</th>
                        <th className="px-4 py-3 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {bookings.length === 0 ? (
                        <tr>
                          <td colSpan="5" className="px-4 py-8 text-center text-slate-400">
                            No hay citas agendadas por el momento.
                          </td>
                        </tr>
                      ) : (
                        bookings.map((b) => (
                          <tr key={b.id} className="hover:bg-slate-50/70 transition-all">
                            <td className="px-4 py-3 space-y-1 whitespace-nowrap">
                              <span className="inline-block bg-blue-50 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded border border-blue-100">
                                {new Date(b.date).toLocaleDateString()}
                              </span>
                              <div className="text-[10px] font-bold text-slate-900 mt-1">🕒 {b.time}</div>
                            </td>
                            <td className="px-4 py-3 space-y-1">
                              <div className="font-bold text-slate-900">{b.name}</div>
                              <div className="text-slate-400">{b.email}</div>
                              {b.phone && <div className="text-slate-400">{b.phone}</div>}
                            </td>
                            <td className="px-4 py-3">
                              <p className="text-slate-700 whitespace-pre-wrap max-w-xs">{b.message}</p>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className={`inline-block text-[10px] font-extrabold px-2.5 py-1 rounded-full border ${
                                b.status === 'CONFIRMED' ? 'bg-green-50 text-green-700 border-green-200' :
                                b.status === 'CANCELLED' ? 'bg-red-50 text-red-700 border-red-200' :
                                'bg-yellow-50 text-yellow-700 border-yellow-200'
                              }`}>
                                {b.status === 'PENDING' ? 'PENDIENTE' : b.status === 'CONFIRMED' ? 'CONFIRMADO' : 'CANCELADO'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right space-x-1 whitespace-nowrap">
                              {b.status !== 'CONFIRMED' && (
                                <form action={handleUpdateBookingStatus} className="inline">
                                  <input type="hidden" name="bookingId" value={b.id} />
                                  <input type="hidden" name="status" value="CONFIRMED" />
                                  <button
                                    type="submit"
                                    className="text-[10px] bg-green-50 hover:bg-green-100 text-green-700 font-bold px-2 py-1 rounded-lg border border-green-200 transition-all cursor-pointer"
                                  >
                                    Confirmar
                                  </button>
                                </form>
                              )}
                              {b.status !== 'CANCELLED' && (
                                <form action={handleUpdateBookingStatus} className="inline">
                                  <input type="hidden" name="bookingId" value={b.id} />
                                  <input type="hidden" name="status" value="CANCELLED" />
                                  <button
                                    type="submit"
                                    className="text-[10px] bg-red-50 hover:bg-red-100 text-red-700 font-bold px-2 py-1 rounded-lg border border-red-200 transition-all cursor-pointer"
                                  >
                                    Cancelar
                                  </button>
                                </form>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
