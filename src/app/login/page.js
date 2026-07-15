import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { db } from '../../lib/db';
import { verifyPassword } from '../../lib/hash';
import { signJWT } from '../../lib/auth';

export const metadata = {
  title: 'Iniciar Sesión - SPP Labs',
  description: 'Accede al panel de control de tu sitio web, base de datos y analíticas.',
};

export default async function LoginPage(props) {
  // Extract search params safely in Next.js App Router
  const searchParams = await props.searchParams;
  const errorMsg = searchParams?.error || '';

  async function handleLogin(formData) {
    'use server';

    const domainInput = formData.get('domain')?.trim().toLowerCase();
    const passwordInput = formData.get('password');

    let redirectUrl = '';
    if (!domainInput || !passwordInput) {
      redirectUrl = `/login?error=${encodeURIComponent('Todos los campos son obligatorios.')}`;
    } else {
      try {
        // 1. Fetch website
        const website = await db.withAdmin(async (tx) => {
          return await tx.website.findUnique({
            where: { domain: domainInput },
          });
        });

        if (!website || !website.passwordHash) {
          redirectUrl = `/login?error=${encodeURIComponent('Dominio o contraseña incorrectos.')}`;
        } else {
          // 2. Verify password with Argon2id
          const isValid = await verifyPassword(website.passwordHash, passwordInput);
          if (!isValid) {
            redirectUrl = `/login?error=${encodeURIComponent('Dominio o contraseña incorrectos.')}`;
          } else {
            // 3. Generate JWT token
            const jwt = await signJWT({
              userId: website.id,
              domain: website.domain,
              role: website.role,
            });

            // 4. Set HttpOnly secure cookie
            const cookieStore = await cookies();
            cookieStore.set('token', jwt, {
              httpOnly: true,
              secure: process.env.NODE_ENV === 'production',
              sameSite: 'strict',
              maxAge: 60 * 60 * 24, // 24 hours
              path: '/',
            });

            redirectUrl = '/dashboard';
          }
        }
      } catch (error) {
        console.error('Login error:', error);
        redirectUrl = `/login?error=${encodeURIComponent('Ocurrió un error al iniciar sesión. Por favor, inténtalo de nuevo.')}`;
      }
    }

    if (redirectUrl) {
      redirect(redirectUrl);
    }
  }

  return (
    <div className="flex min-h-screen flex-col justify-center py-12 sm:px-6 lg:px-8 bg-slate-50 text-slate-900 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <Link href="/" className="flex flex-col items-center justify-center space-y-3 hover:opacity-85 transition-all">
          <img src="/icon.png" alt="Logo SPP Labs" className="w-12 h-12 object-contain" />
          <span className="text-3xl font-extrabold tracking-tight text-slate-950">
            SPP <span className="text-primary">labs</span>
          </span>
        </Link>
        
        <h2 className="mt-6 text-center text-3xl font-extrabold tracking-tight text-slate-950">
          Iniciar sesión en tu cuenta
        </h2>
        <p className="mt-2 text-center text-sm text-slate-500 font-light">
          Administra tus formularios de contacto, reservas, chatbot de IA y analíticas.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 border border-slate-100 shadow-2xl rounded-3xl sm:px-10">
          {errorMsg && (
            <div className="mb-6 rounded-xl bg-red-50 p-4 border border-red-200">
              <div className="text-xs font-semibold text-red-800 text-center">{errorMsg}</div>
            </div>
          )}

          <form action={handleLogin} className="space-y-5">
            <div>
              <label htmlFor="domain" className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                Dominio de tu Sitio Web
              </label>
              <div className="mt-1.5">
                <input
                  id="domain"
                  name="domain"
                  type="text"
                  required
                  placeholder="ejemplo.com"
                  className="block w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 placeholder-slate-400 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm font-sans"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                Contraseña
              </label>
              <div className="mt-1.5">
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  placeholder="••••••••"
                  className="block w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 placeholder-slate-400 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm font-sans"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                className="flex w-full justify-center rounded-xl bg-primary px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-primary/10 hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-primary transition-all cursor-pointer"
              >
                Acceder al Panel
              </button>
            </div>
          </form>

          <div className="mt-6 border-t border-slate-100 pt-6 text-center text-xs">
            <span className="text-slate-400">¿Eres un nuevo cliente? </span>
            <Link href="/signup" className="font-extrabold text-primary hover:underline">
              Activa tu token aquí
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
