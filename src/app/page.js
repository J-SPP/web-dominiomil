import Link from 'next/link';
import { db } from '../lib/db';
import { redirect } from 'next/navigation';
import BookingCalendar from '../components/BookingCalendar';

export const metadata = {
  title: 'SPP Labs - Crea Webs Premium, Chatbots de IA y CRM Integrado',
  description: 'Fusión perfecta de diseño web, automatización de reservas y métricas en tiempo real. Convierte visitas en clientes hoy.',
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

    let redirectUrl = '';
    if (!name || !email || !message) {
      redirectUrl = '/?error=Por+favor,+completa+todos+los+campos+del+formulario#contacto';
    } else {
      const apiUrl = process.env.API_URL || 'https://api.spplabs.es';
      const apiKey = process.env.API_KEY;

      if (!apiKey) {
        redirectUrl = '/?error=La+clave+API+no+está+configurada+en+el+servidor#contacto';
      } else {
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
            redirectUrl = `/?error=${encodeURIComponent(result.error || 'No se pudo enviar el mensaje')}#contacto`;
          } else {
            redirectUrl = '/?success=¡Gracias!+Hemos+recibido+tu+mensaje+correctamente.#contacto';
          }
        } catch (e) {
          console.error(e);
          redirectUrl = '/?error=Error+al+enviar+el+mensaje#contacto';
        }
      }
    }

    if (redirectUrl) {
      redirect(redirectUrl);
    }
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

    let redirectUrl = '';
    if (!name || !email || !dateInput || !timeInput) {
      redirectUrl = '/?error=Todos+los+campos+de+la+reserva+son+obligatorios#reserva';
    } else {
      const apiUrl = process.env.API_URL || 'https://api.spplabs.es';
      const apiKey = process.env.API_KEY;

      if (!apiKey) {
        redirectUrl = '/?error=La+clave+API+no+está+configurada+en+el+servidor#reserva';
      } else {
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
            redirectUrl = `/?error=${encodeURIComponent(result.error || 'No se pudo programar la reserva')}#reserva`;
          } else {
            redirectUrl = '/?success=¡Reserva+programada+con+éxito!#reserva';
          }
        } catch (e) {
          console.error(e);
          redirectUrl = '/?error=Error+al+programar+la+reserva#reserva';
        }
      }
    }

    if (redirectUrl) {
      redirect(redirectUrl);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col selection:bg-primary/20">
      
      {/* Top Navbar */}
      <header className="w-full bg-white/80 backdrop-blur-md border-b border-slate-100 sticky top-0 z-50">
        <div className="mx-auto max-w-7xl px-6 h-20 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <img src="/icon.png" alt="Logo SPP Labs" className="w-8 h-8 object-contain" />
            <span className="text-xl font-extrabold tracking-tight text-slate-950">
              SPP <span className="text-primary">labs</span>
            </span>
          </div>

          <nav className="hidden md:flex space-x-8 text-sm font-semibold text-slate-600">
            <a href="#inicio" className="hover:text-primary transition-all">Inicio</a>
            <a href="#servicios" className="hover:text-primary transition-all">Servicios</a>
            <a href="#funcionalidades" className="hover:text-primary transition-all">Funcionalidades</a>
            <a href="#reserva" className="hover:text-primary transition-all">Reservas</a>
            <a href="#contacto" className="hover:text-primary transition-all">Contacto</a>
          </nav>

          <div className="flex items-center space-x-4">
            <Link href="/login" className="text-sm font-semibold text-slate-600 hover:text-slate-900 transition-all">
              Iniciar sesión
            </Link>
            <a
              href="#reserva"
              className="bg-primary hover:bg-green-600 text-white text-sm font-bold px-5 py-2.5 rounded-full transition-all shadow-md shadow-primary/10"
            >
              Solicitar demo
            </a>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section id="inicio" className="relative overflow-hidden py-16 lg:py-24 bg-white">
        <div className="mx-auto max-w-7xl px-6 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Left Column (Content) */}
          <div className="lg:col-span-7 space-y-8">
            <span className="inline-flex items-center px-3.5 py-1 rounded-full text-xs font-bold bg-primary/10 border border-primary/20 text-primary uppercase tracking-wider">
              IA • WEB • SEO • CRM
            </span>
            
            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-slate-950 leading-none">
              convierte <br />
              visitas en <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">clientes</span>
            </h1>
            
            <p className="text-lg text-slate-600 font-light leading-relaxed max-w-xl">
              Fusión perfecta entre diseño web premium, posicionamiento estratégico y asistencia inteligente. Atrae más tráfico, automatiza tus reservas y domina tus métricas con la suite todo en uno de SPP Labs.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 pt-2">
              <a
                href="#reserva"
                className="bg-primary hover:bg-green-600 text-white font-bold text-base px-8 py-3.5 rounded-full shadow-lg shadow-primary/20 transition-all text-center"
              >
                Solicitar demo &rarr;
              </a>
              <a
                href="#servicios"
                className="bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-800 font-bold text-base px-8 py-3.5 rounded-full transition-all text-center flex items-center justify-center gap-2"
              >
                <span className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[10px] text-slate-700">&#9658;</span>
                Ver ejemplo
              </a>
            </div>

            {/* Badges footer */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-6 border-t border-slate-100">
              {['Chatbot IA', 'SEO + GEO', 'Reservas', 'CRM'].map((badge, i) => (
                <div key={i} className="flex items-center space-x-2 text-slate-700 font-bold text-xs">
                  <span className="text-primary text-base">&bull;</span>
                  <span>{badge}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column (Visual Mock) */}
          <div className="lg:col-span-5 relative flex justify-center">
            <div className="w-full max-w-sm space-y-6 relative z-10">
              
              {/* Floating Widget 1: Clinica Preview */}
              <div className="bg-white border border-slate-100 shadow-2xl rounded-2xl p-5 space-y-4 hover:-translate-y-1 transition-all duration-300">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">CLIENTE DESTACADO</span>
                    <h4 className="text-lg font-bold text-slate-900 mt-0.5">Clínica Vitalis</h4>
                    <div className="flex items-center space-x-1.5 mt-1 text-amber-500 text-xs">
                      <span>4,9</span>
                      <span>&#9733;&#9733;&#9733;&#9733;&#9733;</span>
                      <span className="text-slate-400">(128 reseñas)</span>
                    </div>
                  </div>
                  <span className="text-xs font-bold bg-green-50 text-green-600 px-2.5 py-1 rounded-full">Abierto</span>
                </div>

                <div className="grid grid-cols-4 gap-1 text-center border-t border-b border-slate-100 py-3 text-[10px] font-bold text-slate-500">
                  <div className="hover:text-primary cursor-pointer">📞 Llamar</div>
                  <div className="hover:text-primary cursor-pointer">📍 Mapa</div>
                  <div className="hover:text-primary cursor-pointer">💾 Guardar</div>
                  <div className="hover:text-primary cursor-pointer">🌐 Sitio</div>
                </div>

                <div className="text-xs text-slate-500 space-y-1.5 font-light">
                  <p>📍 C. de Velázquez, 123, Salamanca, Madrid</p>
                  <p>🕒 Abierto - Cierra a las 20:00</p>
                  <p className="text-primary font-medium">🌐 clinicavitalis.es</p>
                </div>
              </div>

              {/* Floating Widget 2: Google Maps Search Preview */}
              <div className="bg-white border border-slate-100 shadow-2xl rounded-2xl p-4 flex items-center gap-4 hover:-translate-y-1 transition-all duration-300">
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-700">
                  G
                </div>
                <div>
                  <h5 className="text-xs font-extrabold text-slate-950">Posicionamiento Local SEO</h5>
                  <p className="text-[10px] text-slate-500 mt-0.5">Aparece en el mapa de Madrid de forma prioritaria.</p>
                </div>
                <span className="ml-auto text-xs text-emerald-500 font-bold">#1 Top</span>
              </div>

            </div>

            {/* Glowing background blob */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 rounded-full bg-primary/10 blur-3xl -z-10"></div>
          </div>

        </div>
      </section>

      {/* Trust Banner */}
      <section className="bg-slate-50 py-10 border-t border-b border-slate-100">
        <div className="mx-auto max-w-7xl px-6 text-center">
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 block mb-6">Confían en nosotros</span>
          <div className="flex flex-wrap justify-center gap-6 sm:gap-12 text-slate-500 text-xs font-extrabold uppercase tracking-wider">
            {['🩺 CLÍNICAS', '🍔 RESTAURANTES', '⚖️ ABOGADOS', '💪 GIMNASIOS', '🏠 INMOBILIARIAS', '💅 ESTÉTICAS'].map((item, i) => (
              <span key={i} className="hover:text-slate-900 transition-all">{item}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Solutions Grid */}
      <section id="servicios" className="py-20 bg-white">
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center max-w-xl mx-auto mb-16">
            <span className="text-xs font-extrabold uppercase tracking-widest text-primary">Soluciones Completas</span>
            <h2 className="text-4xl font-extrabold text-slate-950 mt-1">Todo lo que tu negocio necesita para crecer online</h2>
            <p className="text-sm text-slate-500 mt-3 font-light">Combinamos diseño de alta fidelidad, automatización inteligente y datos analíticos en una solución integrada de 360 grados.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { title: 'Web Premium', desc: 'Diseño moderno, rápido y optimizado para una conversión inmediata.', icon: '💻', border: 'hover:border-primary' },
              { title: 'Chatbot IA', desc: 'Entrenado con la información de tu empresa para atender y convertir visitas 24/7.', icon: '🤖', border: 'hover:border-secondary' },
              { title: 'SEO + GEO', desc: 'Posicionamiento estratégico en buscadores y asistentes de IA para maximizar visibilidad.', icon: '🔍', border: 'hover:border-slate-800' },
              { title: 'CRM & Reservas', desc: 'Gestiona clientes, citas, agenda y analíticas en tiempo real desde un solo panel.', icon: '📅', border: 'hover:border-green-600' }
            ].map((sol, idx) => (
              <div key={idx} className={`bg-white border border-slate-100 rounded-2xl p-6 shadow-md transition-all duration-300 ${sol.border}`}>
                <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-lg mb-4">
                  {sol.icon}
                </div>
                <h3 className="text-lg font-bold text-slate-950 mb-2">{sol.title}</h3>
                <p className="text-xs text-slate-500 leading-relaxed font-light">{sol.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works timeline */}
      <section id="funcionalidades" className="py-20 bg-slate-50 border-t border-b border-slate-100">
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center max-w-xl mx-auto mb-16">
            <span className="text-xs font-extrabold uppercase tracking-widest text-primary">Cómo Funciona</span>
            <h2 className="text-4xl font-extrabold text-slate-950 mt-1">Un proceso simple, resultados reales</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 relative">
            {[
              { num: '1', title: 'Cuéntanos tu negocio', desc: 'Entendemos tus objetivos, público objetivo y necesidades de automatización.', icon: '💬' },
              { num: '2', title: 'Entrenamos la IA', desc: 'Preparamos el chatbot inteligente con la información detallada de tu empresa.', icon: '🎯' },
              { num: '3', title: 'Lanzamos tu web y CRM', desc: 'Diseñamos, desarrollamos y configuramos tu panel unificado todo en uno.', icon: '💻' },
              { num: '4', title: 'Empiezas a recibir clientes', desc: 'Tu negocio trabaja de forma automatizada y tú controlas los datos y conversiones.', icon: '🚀' }
            ].map((step, idx) => (
              <div key={idx} className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm relative z-10 space-y-4 hover:shadow-lg transition-all">
                <div className="flex justify-between items-center">
                  <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-sm font-extrabold text-primary">
                    {step.icon}
                  </div>
                  <span className="text-2xl font-black text-slate-200">0{step.num}</span>
                </div>
                <h4 className="text-sm font-extrabold text-slate-950">{step.title}</h4>
                <p className="text-xs text-slate-500 leading-relaxed font-light">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Dashboard Preview section */}
      <section className="py-20 bg-white">
        <div className="mx-auto max-w-7xl px-6 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Left info column */}
          <div className="lg:col-span-5 space-y-6">
            <span className="text-xs font-extrabold uppercase tracking-widest text-primary">DASHBOARD TODO EN UNO</span>
            <h2 className="text-4xl font-extrabold text-slate-950 leading-tight">
              Gestiona y mide todo desde un solo lugar
            </h2>
            
            <ul className="space-y-3 font-semibold text-xs text-slate-700">
              {[
                'Panel de control intuitivo y moderno',
                'Estadísticas en tiempo real de visitas',
                'Clientes y leads unificados',
                'Reservas y citas automáticas',
                'Chatbot de IA integrado con RAG',
                'Reportes y métricas avanzadas'
              ].map((item, idx) => (
                <li key={idx} className="flex items-center space-x-2.5">
                  <span className="text-green-500 text-sm">&#10003;</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            <Link
              href="/login"
              className="inline-block bg-primary hover:bg-green-600 text-white font-bold text-sm px-6 py-3 rounded-full transition-all"
            >
              Ver demo del dashboard &rarr;
            </Link>
          </div>

          {/* Right graphics preview */}
          <div className="lg:col-span-7 bg-slate-50 border border-slate-100 rounded-3xl p-6 shadow-inner relative overflow-hidden">
            <div className="bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden text-xs">
              <div className="bg-slate-50 border-b border-slate-200 p-3.5 flex justify-between items-center">
                <span className="font-extrabold text-slate-950 flex items-center gap-1.5">
                  <img src="/icon.png" alt="Logo" className="w-4 h-4 object-contain" />
                  SPP Labs
                </span>
                <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-slate-500 font-bold">client.com</span>
              </div>
              
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <span className="text-[10px] text-slate-400 block font-bold">Clientes</span>
                    <strong className="text-slate-900 block text-base font-black">1.284</strong>
                    <span className="text-[9px] text-green-500 font-bold">+12.5%</span>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <span className="text-[10px] text-slate-400 block font-bold">Reservas</span>
                    <strong className="text-slate-900 block text-base font-black">356</strong>
                    <span className="text-[9px] text-green-500 font-bold">+8.1%</span>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <span className="text-[10px] text-slate-400 block font-bold">Conversión</span>
                    <strong className="text-slate-900 block text-base font-black">18,4%</strong>
                    <span className="text-[9px] text-green-500 font-bold">+3.6%</span>
                  </div>
                </div>

                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 h-28 flex flex-col justify-between">
                  <span className="text-[10px] font-bold text-slate-500">Tráfico de visitas</span>
                  {/* Mock chart */}
                  <svg className="w-full h-16" viewBox="0 0 100 30">
                    <path d="M0 25 L10 20 L20 22 L30 15 L40 18 L50 10 L60 12 L70 8 L80 14 L90 5 L100 2" fill="none" stroke="#22c55e" strokeWidth="1.5" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* Success Testimonials */}
      <section className="py-20 bg-slate-50 border-t border-b border-slate-100">
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center max-w-xl mx-auto mb-16">
            <span className="text-xs font-extrabold uppercase tracking-widest text-primary">Casos de Éxito</span>
            <h2 className="text-4xl font-extrabold text-slate-950 mt-1">Negocios que ya crecen con SPP Labs</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { quote: "Duplicamos las reservas online en tres meses gracias a la web y al asistente IA.", name: "María López", role: "Clínica estética" },
              { quote: "El chatbot de IA responde al instante y nuestros clientes están más satisfechos.", name: "Carlos García", role: "Restaurante" },
              { quote: "Ahora tenemos todo organizado en un solo CRM. Más clientes, menos caos.", name: "Laura Martínez", role: "Estudio jurídico" }
            ].map((testi, i) => (
              <div key={i} className="bg-white border border-slate-100 shadow-md rounded-2xl p-6 space-y-4 hover:-translate-y-1 transition-all">
                <p className="text-slate-600 font-light italic leading-relaxed text-sm">
                  &ldquo;{testi.quote}&rdquo;
                </p>
                <div className="flex items-center space-x-3 pt-2 border-t border-slate-50">
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-xs text-slate-700">
                    {testi.name[0]}
                  </div>
                  <div>
                    <h5 className="text-xs font-extrabold text-slate-950">{testi.name}</h5>
                    <span className="text-[10px] text-slate-400 font-medium block">{testi.role}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Main Form Fields Section */}
      <section className="py-20 bg-white">
        
        {/* Error/Success Alert Banners */}
        {errorMsg && (
          <div className="mx-auto max-w-3xl w-full px-6 mb-8">
            <div className="rounded-xl bg-red-50 p-4 border border-red-200 text-sm font-medium text-red-800 text-center">
              {errorMsg}
            </div>
          </div>
        )}
        {successMsg && (
          <div className="mx-auto max-w-3xl w-full px-6 mb-8">
            <div className="rounded-xl bg-green-50 p-4 border border-green-200 text-sm font-medium text-green-800 text-center">
              {successMsg}
            </div>
          </div>
        )}

        <div className="mx-auto max-w-7xl px-6 grid grid-cols-1 lg:grid-cols-2 gap-16">
          
          {/* Booking Calendar Form */}
          <div id="reserva" className="scroll-mt-24 flex items-start justify-center">
            <BookingCalendar onSubmitAction={handleBooking} />
          </div>

          {/* Contact Inquiry Form */}
          <div id="contacto" className="scroll-mt-24 bg-white border border-gray-200 shadow-xl rounded-3xl p-6 md:p-8 space-y-6">
            <div>
              <span className="text-primary font-semibold text-sm uppercase tracking-wider block">Contacto Directo</span>
              <h2 className="text-3xl font-extrabold text-black mt-1">Escríbenos tu Consulta</h2>
              <p className="text-sm text-gray-500 mt-2 font-light">¿Tienes alguna duda o requerimiento especial? Escríbenos directamente y nuestro equipo te responderá en menos de 24 horas.</p>
            </div>

            <form action={handleContact} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600">Nombre Completo</label>
                <input
                  type="text"
                  name="name"
                  required
                  placeholder="Ej. María Gómez"
                  className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-600">Email</label>
                  <input
                    type="email"
                    name="email"
                    required
                    placeholder="maria@ejemplo.com"
                    className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-600">Teléfono</label>
                  <input
                    type="text"
                    name="phone"
                    placeholder="+34 600 000 000"
                    className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600">Detalle de tu Consulta</label>
                <textarea
                  name="message"
                  rows="4"
                  required
                  placeholder="¿En qué te podemos ayudar?"
                  className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
                ></textarea>
              </div>

              <button
                type="submit"
                className="w-full bg-primary hover:bg-green-600 text-white font-bold text-sm px-6 py-3 rounded-xl transition-all cursor-pointer shadow-md shadow-primary/10"
              >
                Enviar Mensaje
              </button>
            </form>
          </div>

        </div>
      </section>

      {/* Gradient Bottom Banner */}
      <section className="bg-white py-10 px-6">
        <div className="mx-auto max-w-7xl rounded-3xl bg-gradient-to-r from-primary to-secondary p-8 md:p-12 text-center text-white space-y-6 shadow-xl relative overflow-hidden">
          <h2 className="text-3xl md:text-5xl font-black tracking-tight max-w-xl mx-auto leading-tight">
            ¿Listo para digitalizar tu negocio?
          </h2>
          <p className="text-slate-100 font-light text-sm md:text-base max-w-lg mx-auto leading-relaxed">
            Solicita una demostración totalmente gratuita de tu futura web, chatbot y panel CRM de SPP Labs hoy mismo.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4 pt-2">
            <a
              href="#reserva"
              className="bg-white hover:bg-slate-100 text-slate-900 font-extrabold text-sm px-8 py-3 rounded-full shadow-lg transition-all"
            >
              Reservar demo
            </a>
            <a
              href="https://wa.me/34600000000"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-green-500 hover:bg-green-600 text-white font-extrabold text-sm px-8 py-3 rounded-full shadow-lg transition-all flex items-center justify-center gap-2 border border-green-400/20"
            >
              Hablar por WhatsApp
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="w-full bg-white border-t border-slate-100 py-10 mt-auto">
        <div className="mx-auto max-w-7xl px-6 flex flex-col sm:flex-row justify-between items-center text-xs text-slate-400 gap-4">
          <span>&copy; {new Date().getFullYear()} SPP Labs. Todos los derechos reservados.</span>
          <div className="space-x-6 font-bold">
            <Link href="/login" className="hover:text-slate-800 transition-all">Portal de Clientes</Link>
            <Link href="/signup" className="hover:text-slate-800 transition-all">Activar Token</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
