import Link from 'next/link';
import { db } from '../lib/db';
import { redirect } from 'next/navigation';

export const metadata = {
  title: 'SPP Labs - Sovereign Platform Pipelines',
  description: 'Deploy container-native applications at the edge. Sovereign nodes routed securely.',
};

export default async function Home(props) {
  // Extract search parameters safely
  const searchParams = await props.searchParams;
  const errorMsg = searchParams?.error || '';
  const successMsg = searchParams?.success || '';

  // Server Action for Contact Form
  async function handleContact(formData) {
    'use server';

    const name = formData.get('name')?.trim();
    const phone = formData.get('phone')?.trim() || '';
    const email = formData.get('email')?.trim();
    const message = formData.get('message')?.trim();

    if (!name || !email || !message) {
      redirect('/?error=Please+fill+all+contact+form+fields#contact');
    }

    const apiUrl = process.env.API_URL || 'https://api.spplabs.es';
    const apiKey = process.env.API_KEY;

    if (!apiKey) {
      redirect('/?error=API+Key+not+configured+in+.env#contact');
    }

    try {
      const response = await fetch(`${apiUrl}/contacts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
        },
        body: JSON.stringify({ name, phone, email, message }),
      });

      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        redirect(`/?error=${encodeURIComponent(result.error || 'Failed to send message')}#contact`);
      }
    } catch (e) {
      console.error(e);
      redirect('/?error=Failed+to+send+message#contact');
    }

    redirect('/?success=Thank+you!+Your+message+has+been+received.#contact');
  }

  // Server Action for Booking Form
  async function handleBooking(formData) {
    'use server';

    const name = formData.get('name')?.trim();
    const phone = formData.get('phone')?.trim() || '';
    const email = formData.get('email')?.trim();
    const dateInput = formData.get('date');
    const timeInput = formData.get('time');
    const message = formData.get('message')?.trim() || '';

    if (!name || !email || !dateInput || !timeInput) {
      redirect('/?error=All+booking+fields+except+message+are+required#booking');
    }

    const apiUrl = process.env.API_URL || 'https://api.spplabs.es';
    const apiKey = process.env.API_KEY;

    if (!apiKey) {
      redirect('/?error=API+Key+not+configured+in+.env#booking');
    }

    try {
      const response = await fetch(`${apiUrl}/bookings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
        },
        body: JSON.stringify({ name, phone, email, date: dateInput, time: timeInput, message }),
      });

      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        redirect(`/?error=${encodeURIComponent(result.error || 'Failed to schedule booking')}#booking`);
      }
    } catch (e) {
      console.error(e);
      redirect('/?error=Failed+to+schedule+booking#booking');
    }

    redirect('/?success=Booking+scheduled+successfully!#booking');
  }

  return (
    <div className="min-h-screen bg-white text-black font-sans flex flex-col">
      {/* Header */}
      <header className="w-full bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="mx-auto max-w-7xl px-6 h-20 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-3xl font-extrabold tracking-tight text-black">
              SPP<span className="text-primary font-curly text-4xl ml-0.5">Labs</span>
            </span>
          </div>

          <nav className="hidden md:flex space-x-8 text-sm font-bold text-gray-700">
            <a href="#services" className="hover:text-primary transition-all">Services</a>
            <a href="#about" className="hover:text-primary transition-all">Architecture</a>
            <a href="#booking" className="hover:text-primary transition-all">Book Calendar</a>
            <a href="#contact" className="hover:text-primary transition-all">Contact</a>
          </nav>

          <div className="flex items-center space-x-4">
            <Link
              href="/login"
              className="bg-black hover:bg-gray-900 text-white text-sm font-bold px-5 py-2.5 rounded-full transition-all"
            >
              Client Dashboard →
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden py-24 border-b border-gray-100 bg-white">
        <div className="mx-auto max-w-7xl px-6 text-center space-y-8">
          <span className="inline-flex items-center px-4 py-1.5 rounded-full text-xs font-bold bg-primary/10 border border-primary/20 text-primary">
            SaaS Infrastructure &amp; Automation
          </span>
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-black max-w-4xl mx-auto leading-none">
            Specialized Platform <br />
            <span className="text-secondary font-curly text-6xl md:text-8xl">Pipelines for Sovereign Nodes</span>
          </h1>
          <p className="text-lg md:text-xl text-gray-600 max-w-2xl mx-auto font-light leading-relaxed">
            Deploy secure containerized software. Custom routed tunnels, ClickHouse analytics, Qdrant vector retrieval, and automated deployments configured on-premise.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4 pt-4">
            <a
              href="#booking"
              className="bg-primary hover:bg-green-600 text-white font-bold text-base px-8 py-3.5 rounded-full shadow-lg shadow-primary/20 transition-all text-center"
            >
              Book Setup Call
            </a>
            <a
              href="#contact"
              className="bg-black hover:bg-gray-950 text-white font-bold text-base px-8 py-3.5 rounded-full transition-all text-center"
            >
              Get in Touch
            </a>
          </div>
        </div>
      </section>

      {/* Alerts */}
      {errorMsg && (
        <div className="mx-auto max-w-3xl w-full px-6 mt-6">
          <div className="rounded-xl bg-red-50 p-4 border border-red-200 text-sm font-medium text-red-800 text-center">
            {errorMsg}
          </div>
        </div>
      )}
      {successMsg && (
        <div className="mx-auto max-w-3xl w-full px-6 mt-6">
          <div className="rounded-xl bg-green-50 p-4 border border-green-200 text-sm font-medium text-green-800 text-center">
            {successMsg}
          </div>
        </div>
      )}

      {/* Services Section */}
      <section id="services" className="py-20 border-b border-gray-100 bg-white">
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center max-w-xl mx-auto mb-16">
            <h2 className="text-3xl font-extrabold text-black">Our Technology Offerings</h2>
            <p className="text-sm text-gray-500 mt-2 font-curly text-base">Crafted with modern infrastructure components</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white border border-gray-200 hover:border-primary rounded-3xl p-8 transition-all shadow-sm">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-bold text-lg mb-6">
                P
              </div>
              <h3 className="text-xl font-bold text-black mb-3">Database Sovereignty</h3>
              <p className="text-sm text-gray-600 leading-relaxed font-light">
                Securely managed PostgreSQL instance running as single source of truth, optimized with Prisma models and row-level security parameters.
              </p>
            </div>

            <div className="bg-white border border-gray-200 hover:border-secondary rounded-3xl p-8 transition-all shadow-sm">
              <div className="w-12 h-12 rounded-2xl bg-secondary/10 flex items-center justify-center text-secondary font-bold text-lg mb-6">
                A
              </div>
              <h3 className="text-xl font-bold text-black mb-3">RAG Chatbots</h3>
              <p className="text-sm text-gray-600 leading-relaxed font-light">
                Advanced AI chatbot systems powered by Qdrant vector databases. Manage knowledge bases dynamically directly from your client workspace.
              </p>
            </div>

            <div className="bg-white border border-gray-200 hover:border-black rounded-3xl p-8 transition-all shadow-sm">
              <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center text-black font-bold text-lg mb-6">
                C
              </div>
              <h3 className="text-xl font-bold text-black mb-3">ClickHouse Analytics</h3>
              <p className="text-sm text-gray-600 leading-relaxed font-light">
                High-speed analytics capture designed to run on a ClickHouse cluster. Fast queries, real-time visualization, and customized dashboards.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Main Form Fields */}
      <section className="py-24 bg-white border-b border-gray-100">
        <div className="mx-auto max-w-7xl px-6 grid grid-cols-1 lg:grid-cols-2 gap-16">
          
          {/* Booking Calendar Form */}
          <div id="booking" className="bg-white border border-gray-200 shadow-xl rounded-3xl p-8 space-y-6">
            <div>
              <span className="text-secondary font-curly text-2xl">Calendar Booking</span>
              <h2 className="text-3xl font-extrabold text-black mt-1">Schedule a Setup Call</h2>
              <p className="text-sm text-gray-500 mt-2 font-light">Select a date and preferred hour slot below. Our engineers will verify the reservation.</p>
            </div>

            <form action={handleBooking} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-600">Your Name</label>
                  <input type="text" name="name" required placeholder="John Doe" className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-secondary focus:ring-1 focus:ring-secondary focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-600">Email Address</label>
                  <input type="email" name="email" required placeholder="john@example.com" className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-secondary focus:ring-1 focus:ring-secondary focus:outline-none" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-600">Select Date</label>
                  <input type="date" name="date" required className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-secondary focus:ring-1 focus:ring-secondary focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-600">Select Time</label>
                  <select name="time" required className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-secondary focus:ring-1 focus:ring-secondary focus:outline-none bg-white">
                    <option value="09:00">09:00</option>
                    <option value="10:00">10:00</option>
                    <option value="11:00">11:00</option>
                    <option value="12:00">12:00</option>
                    <option value="14:00">14:00</option>
                    <option value="15:00">15:00</option>
                    <option value="16:00">16:00</option>
                    <option value="17:00">17:00</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600">Phone (Optional)</label>
                <input type="text" name="phone" placeholder="+34 600 000 000" className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-secondary focus:ring-1 focus:ring-secondary focus:outline-none" />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600">Brief Message / Requirements</label>
                <textarea name="message" rows="3" placeholder="Tell us about your sovereign node requirements..." className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-secondary focus:ring-1 focus:ring-secondary focus:outline-none"></textarea>
              </div>

              <button
                type="submit"
                className="w-full bg-secondary hover:bg-blue-600 text-white font-bold text-sm px-6 py-3 rounded-xl transition-all cursor-pointer shadow-md shadow-secondary/10"
              >
                Confirm Booking Request
              </button>
            </form>
          </div>

          {/* Contact Inquiry Form */}
          <div id="contact" className="bg-white border border-gray-200 shadow-xl rounded-3xl p-8 space-y-6">
            <div>
              <span className="text-primary font-curly text-2xl">Contact Us</span>
              <h2 className="text-3xl font-extrabold text-black mt-1">General Inquiry</h2>
              <p className="text-sm text-gray-500 mt-2 font-light">Have general questions? Send us a direct line and our team will get back to you within 24 hours.</p>
            </div>

            <form action={handleContact} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600">Full Name</label>
                <input type="text" name="name" required placeholder="Jane Smith" className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-600">Email</label>
                  <input type="email" name="email" required placeholder="jane@example.com" className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-600">Phone</label>
                  <input type="text" name="phone" placeholder="+34 600 000 000" className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600">Message Body</label>
                <textarea name="message" rows="4" required placeholder="How can SPP Labs assist you today?" className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"></textarea>
              </div>

              <button
                type="submit"
                className="w-full bg-primary hover:bg-green-600 text-white font-bold text-sm px-6 py-3 rounded-xl transition-all cursor-pointer shadow-md shadow-primary/10"
              >
                Send Message Inquiry
              </button>
            </form>
          </div>

        </div>
      </section>

      {/* Footer */}
      <footer className="w-full bg-white border-t border-gray-100 py-10 mt-auto">
        <div className="mx-auto max-w-7xl px-6 flex flex-col sm:flex-row justify-between items-center text-xs text-gray-400 gap-4">
          <span>&copy; {new Date().getFullYear()} SPP Labs. All rights reserved.</span>
          <div className="space-x-4">
            <Link href="/login" className="hover:text-black">Dashboard Portal</Link>
            <Link href="/signup" className="hover:text-black">Token Activation</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
