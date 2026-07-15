import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { db } from '../../lib/db';
import { hashPassword } from '../../lib/hash';
import { signJWT } from '../../lib/auth';

export const metadata = {
  title: 'Sign Up - SPP Labs',
  description: 'Register your website dashboard using your signup token.',
};

export default async function SignupPage(props) {
  // Extract search params safely in Next.js App Router (handles promise or object context)
  const searchParams = await props.searchParams;
  const errorMsg = searchParams?.error || '';
  const successMsg = searchParams?.success || '';

  async function handleSignup(formData) {
    'use server';

    const domainInput = formData.get('domain')?.trim().toLowerCase();
    const passwordInput = formData.get('password');
    const tokenInput = formData.get('token')?.trim();

    if (!domainInput || !passwordInput || !tokenInput) {
      redirect(`/signup?error=${encodeURIComponent('All fields are required.')}`);
    }

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
        redirect(`/signup?error=${encodeURIComponent('Invalid token or domain mismatch. Please verify your details.')}`);
      }

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

    } catch (error) {
      console.error('Signup error:', error);
      redirect(`/signup?error=${encodeURIComponent('An error occurred during sign up. Please try again.')}`);
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
          Activate Your Account
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Enter the token sent by your admin to unlock your dashboard.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 border border-gray-200 shadow-xl rounded-2xl sm:px-10">
          {errorMsg && (
            <div className="mb-4 rounded-md bg-red-50 p-4 border border-red-200">
              <div className="text-sm font-medium text-red-800">{errorMsg}</div>
            </div>
          )}

          <form action={handleSignup} className="space-y-6">
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
              <label htmlFor="token" className="block text-sm font-semibold text-gray-800">
                Onboarding Token
              </label>
              <div className="mt-1">
                <input
                  id="token"
                  name="token"
                  type="text"
                  required
                  placeholder="Paste your activation token"
                  className="block w-full rounded-lg border border-gray-300 px-4 py-3 text-black placeholder-gray-400 shadow-sm focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/20 transition-all font-sans"
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
                Sign Up & Launch
              </button>
            </div>
          </form>

          <div className="mt-6 border-t border-gray-200 pt-6 text-center text-sm">
            <span className="text-gray-500">Already registered? </span>
            <Link href="/login" className="font-bold text-secondary hover:underline">
              Log In here
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
