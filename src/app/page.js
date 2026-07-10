import Image from "next/image";

export default function Home() {
  return (
    <div className="relative min-h-screen bg-[#030303] text-zinc-100 flex flex-col font-sans antialiased overflow-hidden">
      {/* Background Gradients */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-violet-600/10 blur-[120px] pointer-events-none animate-glow" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-pink-500/5 blur-[120px] pointer-events-none" />

      {/* Grid Pattern Overlay */}
      <div className="absolute inset-0 grid-bg opacity-40 pointer-events-none" />

      {/* Navigation Header */}
      <header className="relative z-10 w-full max-w-7xl mx-auto px-6 py-6 flex items-center justify-between border-b border-white/5">
        <div className="flex items-center gap-2">
          {/* Logo Icon */}
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-violet-600 to-pink-500 flex items-center justify-center shadow-lg shadow-violet-500/20">
            <span className="font-bold text-white text-sm">S</span>
          </div>
          <span className="font-semibold tracking-tight text-xl text-white">SPP <span className="text-zinc-400 font-light">labs</span></span>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-xs font-medium text-emerald-400">All Systems Operational</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 flex flex-col justify-center items-center px-6 py-20 max-w-5xl mx-auto w-full">
        {/* Sub-badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 hover:border-violet-500/30 transition-colors mb-8 cursor-pointer">
          <span className="text-xs font-semibold uppercase tracking-wider text-gradient-purple">New Infrastructure</span>
          <div className="w-1 h-1 rounded-full bg-zinc-600" />
          <span className="text-xs text-zinc-400 font-medium">spplabs.es</span>
        </div>

        {/* Hero Headline */}
        <div className="text-center max-w-3xl mb-8">
          <h1 className="text-4xl sm:text-6xl font-bold tracking-tight text-white mb-6 leading-[1.15]">
            Specialized Platform <br />
            <span className="text-gradient-purple">Pipelines for SaaS</span>
          </h1>
          <p className="text-lg sm:text-xl text-zinc-400 leading-relaxed font-light">
            Deploy container-native applications at the edge. Custom sovereign nodes routed through Cloudflare tunnels and orchestrated securely on localized containers.
          </p>
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 mb-24 w-full sm:w-auto">
          <a
            href="#features"
            className="px-8 py-3.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-medium text-center transition-all shadow-lg shadow-violet-600/20 hover:shadow-violet-600/30 active:scale-98"
          >
            Explore Services
          </a>
          <a
            href="#infrastructure"
            className="px-8 py-3.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white font-medium text-center transition-all hover:border-white/20 active:scale-98"
          >
            System Specs
          </a>
        </div>

        {/* Features Section */}
        <section id="features" className="w-full grid grid-cols-1 md:grid-cols-3 gap-6 mb-24">
          <div className="glass-card p-8 rounded-2xl transition-all duration-300">
            <div className="w-12 h-12 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mb-6">
              <svg className="w-6 h-6 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Automated Pipelines</h3>
            <p className="text-sm text-zinc-400 leading-relaxed font-light">
              Continuous deployment designed specifically for containerized SaaS. Push code and let our runner orchestrate updates seamlessly.
            </p>
          </div>

          <div className="glass-card p-8 rounded-2xl transition-all duration-300">
            <div className="w-12 h-12 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center mb-6">
              <svg className="w-6 h-6 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Zero-Trust Security</h3>
            <p className="text-sm text-zinc-400 leading-relaxed font-light">
              End-to-end encryption with Cloudflare Tunnels. Your servers remain hidden from the public internet, preventing direct attacks.
            </p>
          </div>

          <div className="glass-card p-8 rounded-2xl transition-all duration-300">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-6">
              <svg className="w-6 h-6 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 15a4.5 4.5 0 004.5 4.5H18a3.75 3.75 0 001.332-7.257 3 3 0 00-3.758-3.848 5.25 5.25 0 00-10.233 2.33A4.502 4.502 0 002.25 15z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Sovereign Hosting</h3>
            <p className="text-sm text-zinc-400 leading-relaxed font-light">
              Run on your own hardware using Traefik and Docker. Maintain total data ownership, sovereignty, and compliance.
            </p>
          </div>
        </section>

        {/* Infrastructure Details Section */}
        <section id="infrastructure" className="w-full glass-card p-8 sm:p-12 rounded-3xl border border-white/5 relative overflow-hidden mb-12">
          {/* Subtle grid pattern inside */}
          <div className="absolute inset-0 grid-bg opacity-10 pointer-events-none" />
          
          <div className="relative z-10 flex flex-col md:flex-row gap-8 justify-between items-start md:items-center">
            <div className="max-w-md">
              <span className="text-xs font-semibold text-violet-400 uppercase tracking-widest mb-2 block">Enterprise Stack</span>
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">Optimized Internal Routing</h2>
              <p className="text-zinc-400 text-sm sm:text-base font-light leading-relaxed">
                We design lightweight pipelines that route securely through Traefik proxy and run isolated containers within Docker overlay networks. Highly performant. Zero bloated processes.
              </p>
            </div>

            {/* Architecture specs table */}
            <div className="w-full md:w-auto flex flex-col gap-4 border-t md:border-t-0 md:border-l border-white/10 pt-6 md:pt-0 md:pl-10 min-w-[260px]">
              <div className="flex justify-between items-center gap-12">
                <span className="text-zinc-500 text-sm">Proxy Router</span>
                <span className="text-white text-sm font-mono bg-white/5 px-2.5 py-1 rounded">Traefik Container</span>
              </div>
              <div className="flex justify-between items-center gap-12">
                <span className="text-zinc-500 text-sm">Docker Network</span>
                <span className="text-white text-sm font-mono bg-white/5 px-2.5 py-1 rounded">web</span>
              </div>
              <div className="flex justify-between items-center gap-12">
                <span className="text-zinc-500 text-sm">Secure Tunnel</span>
                <span className="text-white text-sm font-mono bg-white/5 px-2.5 py-1 rounded">Cloudflared</span>
              </div>
              <div className="flex justify-between items-center gap-12">
                <span className="text-zinc-500 text-sm">Deployment Host</span>
                <span className="text-white text-sm font-mono bg-white/5 px-2.5 py-1 rounded">spplabs.es</span>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full max-w-7xl mx-auto px-6 py-8 mt-auto border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-zinc-500">© {new Date().getFullYear()} SPP Labs. All rights reserved.</span>
        </div>
        <div className="flex items-center gap-6 text-sm text-zinc-500">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse-slow" />
            Powered by Docker & Traefik
          </span>
        </div>
      </footer>
    </div>
  );
}
