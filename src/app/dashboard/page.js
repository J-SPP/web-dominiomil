import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { db } from '../../lib/db';
import { verifyJWT } from '../../lib/auth';
import crypto from 'crypto';

export const metadata = {
  title: 'Dashboard - SPP Labs',
  description: 'Manage your website, analytics, chatbot, contact forms, and bookings.',
};

export default async function DashboardPage(props) {
  // Extract search params safely in Next.js App Router
  const searchParams = await props.searchParams;
  const errorMsg = searchParams?.error || '';
  const successMsg = searchParams?.success || '';
  const viewDomain = searchParams?.viewDomain || '';
  const generatedToken = searchParams?.token || '';
  const generatedApiKey = searchParams?.apiKey || '';
  const generatedDomain = searchParams?.domain || '';

  // 1. Authenticate user
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) {
    redirect('/login');
  }

  const payload = await verifyJWT(token);
  if (!payload) {
    redirect('/login');
  }

  // 2. Fetch current user (website) details
  const currentUser = await db.withAdmin(async (tx) => {
    return await tx.website.findUnique({
      where: { id: payload.userId },
    });
  });

  if (!currentUser) {
    redirect('/login');
  }

  const isAdmin = currentUser.role === 'ADMIN' && currentUser.domain === 'spplabs.es';

  // Determine which tenant's data to display
  let activeDomain = currentUser.domain;
  let activeWebsiteId = currentUser.id;
  let activeWebsite = currentUser;
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
      activeWebsite = targetWebsite;
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
      redirect('/dashboard?error=Domain+name+is+required');
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

      redirectUrl = `/dashboard?success=${encodeURIComponent(`Credentials generated for ${targetDomain}`)}&token=${tokenString}&apiKey=${rawApiKey}&domain=${targetDomain}`;
    } catch (e) {
      console.error(e);
      redirectUrl = '/dashboard?error=Failed+to+generate+token+and+API+key';
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
      redirectUrl = '/dashboard?success=Token+deleted';
    } catch (e) {
      redirectUrl = '/dashboard?error=Failed+to+delete+token';
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
      redirectUrl = '/dashboard?success=Website+deleted';
    } catch (e) {
      redirectUrl = '/dashboard?error=Failed+to+delete+website';
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
      redirectUrl = `/dashboard?viewDomain=${activeDomain}&success=Booking+status+updated`;
    } catch (e) {
      redirectUrl = `/dashboard?viewDomain=${activeDomain}&error=Failed+to+update+booking+status`;
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
            title: 'Chatbot Knowledge Updated',
            message: 'Your Qdrant chatbot knowledge database was successfully updated.',
          }
        });
      });

      redirectUrl = `/dashboard?viewDomain=${activeDomain}&success=Chatbot+knowledge+saved`;
    } catch (e) {
      console.error(e);
      redirectUrl = `/dashboard?viewDomain=${activeDomain}&error=Failed+to+save+chatbot+knowledge`;
    }

    if (redirectUrl) {
      redirect(redirectUrl);
    }
  }

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
              
              <span className="text-sm font-bold text-black border-b-2 border-black pb-1">
                Workspace Dashboard
              </span>

              <Link 
                href={isViewingAsAdmin ? `/dashboard/analytics?viewDomain=${activeDomain}` : '/dashboard/analytics'} 
                className="text-sm font-semibold text-gray-500 hover:text-black transition-all"
              >
                Web Analytics
              </Link>

              <span className="text-sm text-gray-500 hidden md:inline">
                Logged in as: <strong className="text-black">{currentUser.domain}</strong>
              </span>

              <form action={handleLogout}>
                <button
                  type="submit"
                  className="text-sm bg-black hover:bg-gray-900 text-white font-bold px-4 py-2 rounded-lg transition-all cursor-pointer"
                >
                  Log Out
                </button>
              </form>
            </div>
          </div>
        </div>
      </nav>

      {/* Main dashboard content container */}
      <main className="flex-grow mx-auto max-w-7xl w-full px-4 py-8 sm:px-6 lg:px-8">
        
        {/* Banner Alert Messages */}
        {errorMsg && (
          <div className="mb-6 rounded-xl bg-red-50 p-4 border border-red-200 flex justify-between items-center">
            <span className="text-sm font-medium text-red-800">{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="mb-6 rounded-xl bg-green-50 p-4 border border-green-200 flex justify-between items-center">
            <span className="text-sm font-medium text-green-800">{successMsg}</span>
          </div>
        )}

        {/* --- ADMIN INTERFACE (Console view) --- */}
        {isAdmin && !isViewingAsAdmin && (
          <div className="space-y-8">
            <h1 className="text-3xl font-extrabold text-black tracking-tight border-b-2 border-black pb-2">
              Admin Control Console
            </h1>

            {/* Token and API Key Generation Success Alert */}
            {generatedToken && generatedApiKey && (
              <div className="bg-green-50 border-2 border-green-200 shadow-xl rounded-2xl p-6 space-y-4">
                <h3 className="text-xl font-bold text-green-800 flex items-center gap-2">
                  🎉 Client Credentials Generated Successfully!
                </h3>
                <p className="text-sm text-green-700">
                  Below are the credentials for <strong>{generatedDomain}</strong>. Please copy them now. The API key is stored hashed in the database and <strong>will never be shown again</strong>.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white border border-green-200 rounded-xl p-4 space-y-2">
                    <span className="block text-xs font-bold uppercase tracking-wider text-gray-500">Onboarding Signup Token</span>
                    <div className="flex items-center justify-between bg-gray-50 border border-gray-100 rounded-lg p-2.5 font-mono text-sm text-red-600 break-all select-all font-bold">
                      <span>{generatedToken}</span>
                    </div>
                    <p className="text-xs text-gray-500 font-sans">Give this token to the client so they can activate their dashboard account at `/signup`.</p>
                  </div>
                  <div className="bg-white border border-green-200 rounded-xl p-4 space-y-2">
                    <span className="block text-xs font-bold uppercase tracking-wider text-gray-500">Website API Key (.env)</span>
                    <div className="flex items-center justify-between bg-gray-50 border border-gray-100 rounded-lg p-2.5 font-mono text-sm text-green-600 break-all select-all font-bold">
                      <span>{generatedApiKey}</span>
                    </div>
                    <p className="text-xs text-gray-500 font-sans">Store this key in the individual website's <code>.env</code> file: <code>API_KEY={generatedApiKey}</code></p>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              
              {/* Token Generator Panel */}
              <div className="bg-white border border-gray-200 shadow-lg rounded-2xl p-6 md:col-span-1 space-y-4">
                <h2 className="text-xl font-bold text-black border-b border-gray-200 pb-2">
                  Generate Signup Token
                </h2>
                <form action={handleGenerateToken} className="space-y-4">
                  <div>
                    <label htmlFor="domain" className="block text-xs font-bold uppercase tracking-wider text-gray-500">
                      Client Domain
                    </label>
                    <input
                      type="text"
                      name="domain"
                      required
                      placeholder="clientdomain.com"
                      className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full bg-primary hover:bg-green-600 text-white font-bold text-sm px-4 py-2.5 rounded-lg transition-all cursor-pointer"
                  >
                    Generate & Save Token
                  </button>
                </form>
              </div>

              {/* Tokens Table */}
              <div className="bg-white border border-gray-200 shadow-lg rounded-2xl p-6 md:col-span-2 space-y-4">
                <h2 className="text-xl font-bold text-black border-b border-gray-200 pb-2">
                  Pending Activation Tokens
                </h2>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead>
                      <tr>
                        <th className="px-4 py-2 text-left font-bold text-gray-500 uppercase tracking-wider">Domain</th>
                        <th className="px-4 py-2 text-left font-bold text-gray-500 uppercase tracking-wider">Token Code</th>
                        <th className="px-4 py-2 text-left font-bold text-gray-500 uppercase tracking-wider">Created</th>
                        <th className="px-4 py-2 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {signupTokens.length === 0 ? (
                        <tr>
                          <td colSpan="4" className="px-4 py-4 text-center text-gray-400">
                            No pending signup tokens.
                          </td>
                        </tr>
                      ) : (
                        signupTokens.map((t) => (
                          <tr key={t.id}>
                            <td className="px-4 py-3 font-semibold">{t.domain}</td>
                            <td className="px-4 py-3"><code className="bg-gray-100 border border-gray-200 px-2 py-1 rounded text-red-600 text-xs font-mono select-all">{t.token}</code></td>
                            <td className="px-4 py-3 text-gray-500">{new Date(t.createdAt).toLocaleDateString()}</td>
                            <td className="px-4 py-3 text-right">
                              <form action={handleDeleteToken} className="inline">
                                <input type="hidden" name="tokenId" value={t.id} />
                                <button
                                  type="submit"
                                  className="text-xs bg-red-50 hover:bg-red-100 text-red-600 font-bold px-2 py-1 rounded-lg border border-red-200 transition-all cursor-pointer"
                                >
                                  Cancel Token
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
            <div className="bg-white border border-gray-200 shadow-lg rounded-2xl p-6">
              <h2 className="text-xl font-bold text-black border-b border-gray-200 pb-3 mb-4">
                Active Client Sites
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {allWebsites.map((w) => (
                  <div key={w.id} className="border border-gray-200 rounded-xl p-5 hover:border-secondary shadow-sm transition-all flex flex-col justify-between space-y-4">
                    <div>
                      <h3 className="text-lg font-bold text-black">{w.domain}</h3>
                      <p className="text-xs text-gray-500 mt-1">Role: <span className="font-semibold">{w.role}</span></p>
                      <p className="text-xs text-gray-500">Registered: {w.registeredAt ? new Date(w.registeredAt).toLocaleDateString() : 'Pending'}</p>
                    </div>
                    <div className="flex space-x-2 pt-2 border-t border-gray-100">
                      <Link
                        href={`/dashboard?viewDomain=${w.domain}`}
                        className="flex-1 text-center bg-secondary hover:bg-blue-600 text-white text-xs font-bold px-3 py-2 rounded-lg transition-all"
                      >
                        Inspect Panel
                      </Link>
                      {w.domain !== 'spplabs.es' && (
                        <form action={handleDeleteWebsite} className="inline">
                          <input type="hidden" name="websiteId" value={w.id} />
                          <button
                            type="submit"
                            className="bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold px-3 py-2 rounded-lg border border-red-100 transition-all cursor-pointer"
                          >
                            Delete
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
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b-2 border-black pb-4 space-y-2 sm:space-y-0">
              <div>
                <h1 className="text-3xl font-extrabold text-black tracking-tight font-sans">
                  Workspace Dashboard
                </h1>
                <p className="text-sm text-gray-500 mt-1">
                  Overview and analytics integration for <strong className="text-black">{activeDomain}</strong>
                </p>
              </div>
              <div className="bg-primary/10 border border-primary/20 rounded-xl px-4 py-2 text-primary font-bold text-xs">
                Status: Active
              </div>
            </div>

            {/* Analytics Overview Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white border border-gray-200 shadow-md rounded-2xl p-5 border-l-4 border-l-primary space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-400 block">Total Contact Requests</span>
                <span className="text-3xl font-extrabold text-black block">{contacts.length}</span>
                <span className="text-xs text-green-600 font-semibold">Active website submission log</span>
              </div>
              <div className="bg-white border border-gray-200 shadow-md rounded-2xl p-5 border-l-4 border-l-secondary space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-400 block">Active Bookings</span>
                <span className="text-3xl font-extrabold text-black block">
                  {bookings.filter(b => b.status === 'PENDING').length} <span className="text-sm text-gray-400 font-normal">pending</span>
                </span>
                <span className="text-xs text-blue-600 font-semibold">{bookings.length} total scheduled bookings</span>
              </div>
              <div className="bg-white border border-gray-200 shadow-md rounded-2xl p-5 border-l-4 border-l-black space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-400 block">Monthly RAG Token usage</span>
                <span className="text-3xl font-extrabold text-black block">0</span>
                <span className="text-xs text-gray-500 font-semibold">Connected to Qdrant vector DB</span>
              </div>
              <div className="bg-white border border-gray-200 shadow-md rounded-2xl p-5 border-l-4 border-l-green-600 space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-400 block">Chatbot Knowledge</span>
                <span className="text-lg font-bold text-black block truncate">
                  {chatbotKnowledge?.content ? `${chatbotKnowledge.content.length} chars` : 'Empty / Not Set'}
                </span>
                <span className="text-xs text-green-600 font-semibold">Synced: {chatbotKnowledge?.lastSyncedAt ? new Date(chatbotKnowledge.lastSyncedAt).toLocaleDateString() : 'Never'}</span>
              </div>
            </div>

            {/* API Keys Configuration Card */}
            <div className="bg-gray-50 border border-gray-200 shadow-lg rounded-2xl p-6 space-y-4">
              <div>
                <h2 className="text-xl font-bold text-black flex items-center gap-2">
                  🔑 Website API Key &amp; Integration
                </h2>
                <p className="text-xs text-gray-500 mt-1">
                  Use this key to authorize form submissions and API requests from your individual website to <code>api.spplabs.es</code>.
                </p>
              </div>
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                {apiKeysList.length === 0 ? (
                  <div className="text-center py-4 text-sm text-gray-400">
                    No API keys have been generated yet. Please contact the administrator.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {apiKeysList.map((key) => (
                      <div key={key.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-gray-100 last:border-b-0 pb-3 last:pb-0">
                        <div className="space-y-1">
                          <p className="text-sm font-bold text-black">{key.name}</p>
                          <p className="text-xs text-gray-500">
                            Key Hash: <code className="bg-gray-50 border border-gray-100 px-1 py-0.5 rounded text-gray-600 font-mono text-[10px]">{key.keyHash.substring(0, 16)}...</code>
                          </p>
                          <p className="text-xs text-gray-400">
                            Created: {new Date(key.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="text-right sm:text-right mt-2 sm:mt-0 whitespace-nowrap">
                          <span className="inline-block bg-green-50 text-green-700 text-xs font-bold px-2 py-1 rounded border border-green-100">
                            Last Used: {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleString() : 'Never'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Split Panels: Contact forms and Chatbot knowledge */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              {/* Chatbot Knowledge Plain Text Editor */}
              <div className="lg:col-span-1 bg-white border border-gray-200 shadow-lg rounded-2xl p-6 space-y-4">
                <div>
                  <h2 className="text-xl font-bold text-black">Chatbot Knowledge Base</h2>
                  <p className="text-xs text-gray-500 mt-1">Provide clear facts, FAQs, and product knowledge in plain text format for your custom Qdrant bot.</p>
                </div>
                <form action={handleSaveChatbotKnowledge} className="space-y-4">
                  <textarea
                    name="knowledgeContent"
                    rows="14"
                    required
                    placeholder="Enter plain text context here..."
                    defaultValue={chatbotKnowledge?.content || ''}
                    className="w-full rounded-xl border border-gray-300 p-4 text-sm font-sans focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary shadow-inner bg-gray-50 text-black"
                  ></textarea>
                  <button
                    type="submit"
                    className="w-full bg-black hover:bg-gray-900 text-white font-bold text-sm px-4 py-3 rounded-xl transition-all cursor-pointer flex justify-center items-center"
                  >
                    Save & Update Embedding Vector
                  </button>
                </form>
              </div>

              {/* Contact Form Submissions Table */}
              <div className="lg:col-span-2 bg-white border border-gray-200 shadow-lg rounded-2xl p-6 space-y-4">
                <div>
                  <h2 className="text-xl font-bold text-black">Latest Contact Requests</h2>
                  <p className="text-xs text-gray-500 mt-1">Captured leads and emails sent through your site contact form.</p>
                </div>
                <div className="overflow-y-auto max-h-[460px] border border-gray-100 rounded-xl">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50 sticky top-0 z-10">
                      <tr>
                        <th className="px-4 py-3 text-left font-bold text-gray-600 uppercase tracking-wider">Client Info</th>
                        <th className="px-4 py-3 text-left font-bold text-gray-600 uppercase tracking-wider">Message Details</th>
                        <th className="px-4 py-3 text-left font-bold text-gray-600 uppercase tracking-wider">Submitted</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {contacts.length === 0 ? (
                        <tr>
                          <td colSpan="3" className="px-4 py-8 text-center text-gray-400">
                            No contact forms submitted yet.
                          </td>
                        </tr>
                      ) : (
                        contacts.map((c) => (
                          <tr key={c.id} className="hover:bg-gray-50 transition-all">
                            <td className="px-4 py-3 space-y-1">
                              <div className="font-bold text-black">{c.name}</div>
                              <div className="text-xs text-gray-500">{c.email}</div>
                              {c.phone && <div className="text-xs text-gray-400">{c.phone}</div>}
                            </td>
                            <td className="px-4 py-3">
                              <p className="text-xs text-gray-800 whitespace-pre-wrap max-w-md line-clamp-3 hover:line-clamp-none transition-all">{c.message}</p>
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
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
            <div className="bg-white border border-gray-200 shadow-lg rounded-2xl p-6 space-y-4">
              <div>
                <h2 className="text-xl font-bold text-black">Calendar Bookings Scheduler</h2>
                <p className="text-xs text-gray-500 mt-1">Review scheduled appointments, check dates/times, and manage status logs.</p>
              </div>
              <div className="overflow-x-auto border border-gray-100 rounded-xl">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left font-bold text-gray-600 uppercase tracking-wider">Target Date & Time</th>
                      <th className="px-4 py-3 text-left font-bold text-gray-600 uppercase tracking-wider">User Details</th>
                      <th className="px-4 py-3 text-left font-bold text-gray-600 uppercase tracking-wider">Message</th>
                      <th className="px-4 py-3 text-left font-bold text-gray-600 uppercase tracking-wider">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {bookings.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="px-4 py-8 text-center text-gray-400">
                          No calendar bookings scheduled.
                        </td>
                      </tr>
                    ) : (
                      bookings.map((b) => (
                        <tr key={b.id} className="hover:bg-gray-50 transition-all">
                          <td className="px-4 py-3 space-y-1 whitespace-nowrap">
                            <span className="inline-block bg-blue-50 text-blue-800 text-xs font-bold px-2 py-1 rounded border border-blue-100">
                              {new Date(b.date).toLocaleDateString()}
                            </span>
                            <div className="text-xs font-bold text-black mt-1">🕒 {b.time}</div>
                          </td>
                          <td className="px-4 py-3 space-y-1">
                            <div className="font-bold text-black">{b.name}</div>
                            <div className="text-xs text-gray-500">{b.email}</div>
                            {b.phone && <div className="text-xs text-gray-400">{b.phone}</div>}
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-xs text-gray-700 whitespace-pre-wrap max-w-xs">{b.message}</p>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`inline-block text-xs font-extrabold px-2.5 py-1 rounded-full border ${
                              b.status === 'CONFIRMED' ? 'bg-green-50 text-green-700 border-green-200' :
                              b.status === 'CANCELLED' ? 'bg-red-50 text-red-700 border-red-200' :
                              'bg-yellow-50 text-yellow-700 border-yellow-200'
                            }`}>
                              {b.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right space-x-1 whitespace-nowrap">
                            {b.status !== 'CONFIRMED' && (
                              <form action={handleUpdateBookingStatus} className="inline">
                                <input type="hidden" name="bookingId" value={b.id} />
                                <input type="hidden" name="status" value="CONFIRMED" />
                                <button
                                  type="submit"
                                  className="text-xs bg-green-50 hover:bg-green-100 text-green-700 font-bold px-2.5 py-1.5 rounded-lg border border-green-200 transition-all cursor-pointer"
                                >
                                  Approve
                                </button>
                              </form>
                            )}
                            {b.status !== 'CANCELLED' && (
                              <form action={handleUpdateBookingStatus} className="inline">
                                <input type="hidden" name="bookingId" value={b.id} />
                                <input type="hidden" name="status" value="CANCELLED" />
                                <button
                                  type="submit"
                                  className="text-xs bg-red-50 hover:bg-red-100 text-red-700 font-bold px-2.5 py-1.5 rounded-lg border border-red-200 transition-all cursor-pointer"
                                >
                                  Cancel
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

            {/* System Notifications Log */}
            <div className="bg-white border border-gray-200 shadow-lg rounded-2xl p-6">
              <h2 className="text-xl font-bold text-black border-b border-gray-200 pb-3 mb-4">
                Recent Audit Logs & Notifications
              </h2>
              <div className="space-y-3">
                {notifications.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">No recent notifications.</p>
                ) : (
                  notifications.map((n) => (
                    <div key={n.id} className="flex justify-between items-start border-b border-gray-50 pb-3 last:border-b-0 last:pb-0">
                      <div className="space-y-1">
                        <p className="text-sm font-bold text-black">{n.title}</p>
                        <p className="text-xs text-gray-600">{n.message}</p>
                      </div>
                      <span className="text-xs text-gray-400 whitespace-nowrap ml-4">
                        {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
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
