import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { db } from '../../lib/db';
import { hashPassword } from '../../lib/hash';
import { signJWT } from '../../lib/auth';

export const metadata = {
  title: 'Activar Cuenta - SPP Labs',
  description: 'Registra y activa el panel de control de tu sitio web usando tu token de activación.',
};

export default async function SignupPage(props) {
  // Extract search params safely in Next.js App Router (handles promise or object context)
  const searchParams = await props.searchParams;
  const errorMsg = searchParams?.error || '';

  async function handleSignup(formData) {
    'use server';

    const domainInput = formData.get('domain')?.trim().toLowerCase();
    const passwordInput = formData.get('password');
    const tokenInput = formData.get('token')?.trim();

    let redirectUrl = '';
    if (!domainInput || !passwordInput || !tokenInput) {
      redirectUrl = `/signup?error=${encodeURIComponent('Todos los campos son obligatorios.')}`;
    } else {
      try {
        const { website, signupToken } = await db.withAdmin(async (tx) => {
          // 1. Verify token
          const tokenRecord = await tx.signupToken.findFirst({
            where: {
              domain: domainInput,
              token: tokenInput,
            },
          });

          if (!tokenRecord) {
            return { website: null, signupToken: null };
          }

          // 2. Hash password
          const hashedPassword = await hashPassword(passwordInput);

          // 3. Create or update website account
          const websiteRecord = await tx.website.upsert({
            where: { domain: domainInput },
            update: {
              displayName: domainInput,
              passwordHash: hashedPassword,
              role: 'USER',
              registeredAt: new Date(),
            },
            create: {
              domain: domainInput,
              displayName: domainInput,
              passwordHash: hashedPassword,
              role: 'USER',
              registeredAt: new Date(),
            },
          });

          // 4. Delete the token so it cannot be reused
          await tx.signupToken.delete({
            where: { id: tokenRecord.id },
          });

          return { website: websiteRecord, signupToken: tokenRecord };
        });

        if (!signupToken || !website) {
          redirectUrl = `/signup?error=${encodeURIComponent('El token es inválido o no coincide con el dominio. Verifica tus datos.')}`;
        } else {
          // 5. Generate JWT token
          const jwt = await signJWT({
            userId: website.id,
            domain: website.domain,
            role: website.role,
          });

          // 6. Set HttpOnly secure cookie
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
      } catch (error) {
        console.error('Signup error:', error);
        redirectUrl = `/signup?error=${encodeURIComponent('Ocurrió un error durante la activación. Por favor, inténtalo de nuevo.')}`;
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
          Activa tu panel de control
        </h2>
        <p className="mt-2 text-center text-sm text-slate-500 font-light">
          Introduce el código de activación enviado por tu administrador para configurar tu contraseña.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 border border-slate-100 shadow-2xl rounded-3xl sm:px-10">
          {errorMsg && (
            <div className="mb-6 rounded-xl bg-red-50 p-4 border border-red-200">
              <div className="text-xs font-semibold text-red-800 text-center">{errorMsg}</div>
            </div>
          )}

          <form action={handleSignup} className="space-y-5">
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
                  className="block w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 placeholder-slate-400 shadow-sm focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/20 transition-all text-sm font-sans"
                />
              </div>
            </div>

            <div>
              <label htmlFor="token" className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                Código de Activación (Token)
              </label>
              <div className="mt-1.5">
                <input
                  id="token"
                  name="token"
                  type="text"
                  required
                  placeholder="Pega el token spp_tok_..."
                  className="block w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 placeholder-slate-400 shadow-sm focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/20 transition-all text-sm font-sans"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                Nueva Contraseña
              </label>
              <div className="mt-1.5">
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  placeholder="Mínimo 8 caracteres"
                  className="block w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 placeholder-slate-400 shadow-sm focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/20 transition-all text-sm font-sans"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                className="flex w-full justify-center rounded-xl bg-secondary px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-secondary/10 hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-secondary transition-all cursor-pointer"
              >
                Activar &amp; Acceder
              </button>
            </div>
          </form>

          <div className="mt-6 border-t border-slate-100 pt-6 text-center text-xs">
            <span className="text-slate-400">¿Ya tienes una cuenta activa? </span>
            <Link href="/login" className="font-extrabold text-secondary hover:underline">
              Inicia sesión aquí
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
