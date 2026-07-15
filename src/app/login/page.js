import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { db } from '../../lib/db';
import { verifyPassword } from '../../lib/hash';
import { signJWT } from '../../lib/auth';

export const metadata = {
  title: 'Log In - SPP Labs',
  description: 'Log in to your website analytics and management dashboard.',
};

export default async function LoginPage(props) {
  // Extract search params safely in Next.js App Router
  const searchParams = await props.searchParams;
  const errorMsg = searchParams?.error || '';

  async function handleLogin(formData) {
    'use server';

    const domainInput = formData.get('domain')?.trim().toLowerCase();
    const passwordInput = formData.get('password');

    if (!domainInput || !passwordInput) {
      redirect(`/login?error=${encodeURIComponent('All fields are required.')}`);
    }

    try {
      // 1. Fetch website
      const website = await db.withAdmin(async (tx) => {
        return await tx.website.findUnique({
          where: { domain: domainInput },
        });
      });

      if (!website || !website.passwordHash) {
        redirect(`/login?error=${encodeURIComponent('Invalid domain or password.')}`);
      }

      // 2. Verify password with Argon2id
      const isValid = await verifyPassword(website.passwordHash, passwordInput);
      if (!isValid) {
        redirect(`/login?error=${encodeURIComponent('Invalid domain or password.')}`);
      }

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

    } catch (error) {
      console.error('Login error:', error);
      redirect(`/login?error=${encodeURIComponent('An error occurred during log in. Please try again.')}`);
    }

    // Redirect to dashboard on success
    redirect('/dashboard');
  }

  return (
    <div className="flex min-h-screen flex-col justify-center py-12 sm:px-6 lg:px-8 bg-white text-black font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <Link href="/" className="flex justify-center text-4xl font-extrabold tracking-tight text-black hover:opacity-80">
          SPP<span className="text-primary">Labs</span>
        </Link>
        <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-black">
          Sign in to your account
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Access contact forms, bookings, chatbot knowledge, and analytics.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 border border-gray-200 shadow-xl rounded-2xl sm:px-10">
          {errorMsg && (
            <div className="mb-4 rounded-md bg-red-50 p-4 border border-red-200">
              <div className="text-sm font-medium text-red-800">{errorMsg}</div>
            </div>
          )}

          <form action={handleLogin} className="space-y-6">
            <div>
              <label htmlFor="domain" className="block text-sm font-semibold text-gray-800">
                Website Domain
              </label>
              <div className="mt-1">
                <input
                  id="domain"
                  name="domain"
                  type="text"
                  required
                  placeholder="example.com"
                  className="block w-full rounded-lg border border-gray-300 px-4 py-3 text-black placeholder-gray-400 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-sans"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-gray-800">
                Password
              </label>
              <div className="mt-1">
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  placeholder="••••••••"
                  className="block w-full rounded-lg border border-gray-300 px-4 py-3 text-black placeholder-gray-400 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-sans"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                className="flex w-full justify-center rounded-lg border border-transparent bg-black px-4 py-3 text-base font-bold text-white shadow-sm hover:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 transition-all cursor-pointer"
              >
                Log In
              </button>
            </div>
          </form>

          <div className="mt-6 border-t border-gray-200 pt-6 text-center text-sm">
            <span className="text-gray-500">New client? </span>
            <Link href="/signup" className="font-bold text-primary hover:underline">
              Activate your token
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
