import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Braces, Hash, Settings2, Search } from "lucide-react";

export default function LandingPage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans overflow-x-hidden selection:bg-green-200 pb-32" style={{ fontFamily: "'Inter', sans-serif" }}>
      
      {/* 1. Navbar */}
      <div className="w-full flex justify-center py-6 px-4 md:px-8 z-50 relative bg-white">
        <nav className="flex items-center justify-between w-full max-w-[1280px]">
          {/* Logo */}
          <div className="flex items-center gap-2 cursor-pointer">
             <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="#16a34a" />
                <path d="M2 17L12 22L22 17" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M2 12L12 17L22 12" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
             </svg>
            <span className="font-bold tracking-tight text-2xl text-slate-900 relative top-[1px]">prismify</span>
          </div>

          {/* Center Pill Links */}
          <div className="hidden lg:flex items-center space-x-7 px-8 py-2.5 border border-slate-200 rounded-full shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
             <a href="#" className="text-[13px] font-semibold text-slate-500 hover:text-slate-900 transition-colors">Products</a>
             <a href="#" className="text-[13px] font-semibold text-slate-500 hover:text-slate-900 transition-colors">Documentation</a>
             <a href="#" className="text-[13px] font-semibold text-slate-500 hover:text-slate-900 transition-colors">Customers</a>
             <a href="#" className="text-[13px] font-semibold text-slate-500 hover:text-slate-900 transition-colors">Pricing</a>
             <a href="#" className="text-[13px] font-semibold text-slate-500 hover:text-slate-900 transition-colors">Careers</a>
             <a href="#" className="text-[13px] font-semibold text-slate-500 hover:text-slate-900 transition-colors">Blog</a>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-5">
            <Link to="/login" className="text-[14px] font-semibold text-slate-600 hover:text-slate-900 transition-colors hidden sm:block">
              Sign in
            </Link>
            <Link to="/login" className="px-5 py-2.5 bg-[#171717] hover:bg-black text-white text-[14px] font-bold rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.1)] transition-all active:scale-95">
              Start for free
            </Link>
          </div>
        </nav>
      </div>

      {/* 2. Hero Section */}
      <main className="relative pt-10 md:pt-16 flex flex-col items-center z-10 px-4 w-full">
        
        {/* Agent Badge */}
        <div className="flex items-center justify-center mb-10">
          <div className="flex items-center gap-2.5 px-4 py-1.5 bg-white border border-slate-200 rounded-full shadow-sm text-[13px] text-slate-600 font-semibold cursor-pointer hover:bg-slate-50 transition-all">
            <div className="w-2.5 h-2.5 bg-green-100 flex items-center justify-center rounded-[2px] border border-green-200">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-[1px]"></div>
            </div>
            Are your docs agent-friendly?
          </div>
        </div>

        {/* Headline */}
        <h1 className="text-5xl md:text-[5.5rem] font-bold tracking-tighter text-slate-900 text-center leading-[1.05] mb-6 max-w-4xl" style={{ letterSpacing: '-0.04em' }}>
          Instant Docs and SDKs <br /> for your API
        </h1>
        
        {/* Subtitle */}
        <p className="text-[17px] md:text-[19px] text-slate-500 max-w-[620px] text-center leading-[1.6] font-medium" style={{ letterSpacing: '-0.01em' }}>
          Start with an API spec. <span className="font-bold text-slate-800">Generate</span> SDKs in multiple languages and interactive API documentation tailored to your brand.
        </p>

        {/* CTAs */}
        <div className="flex items-center gap-6 mt-10 mb-20">
          <Link 
            to="/demo"
            className="text-slate-500 font-semibold hover:text-slate-900 flex items-center transition-colors text-[14px]"
          >
            Book a demo <ChevronRight className="w-3.5 h-3.5 ml-1 relative top-[1px]" />
          </Link>
          <Link 
            to="/login"
            className="px-6 py-3 bg-[#0c8b27] hover:bg-[#0a7a22] text-white text-[15px] font-bold rounded-lg shadow-[0_4px_14px_rgba(12,139,39,0.3)] transition-all active:scale-95 tracking-wide"
          >
            Start for free
          </Link>
        </div>

        {/* 3. The Visual Diagram */}
        <div className="w-full max-w-[1200px] mx-auto relative h-[480px] flex items-center justify-center pointer-events-none scale-90 md:scale-100">
          
          {/* Detailed SVG Connective Lines */}
          <div className="absolute inset-0 z-0">
             <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
                {/* Prismify active path */}
                <path d="M 330 225 L 370 225 C 410 225, 430 260, 480 260 L 520 260" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                
                {/* Passive paths (AsyncAPI, OpenAPI, gRPC) */}
                <path d="M 300 120 C 350 120, 390 260, 480 260" fill="none" stroke="#f1f5f9" strokeWidth="2" />
                <path d="M 300 370 C 350 370, 390 260, 480 260" fill="none" stroke="#f1f5f9" strokeWidth="2" />

                {/* Simulated Green dots passing through terminal */}
                <circle cx="520" cy="260" r="1.5" fill="#22c55e" className="animate-ping" />
                <circle cx="524" cy="256" r="1" fill="#4ade80" className="animate-pulse" />
                <circle cx="518" cy="264" r="1" fill="#bbf7d0" className="animate-pulse delay-75" />

                {/* Path coming out of terminal */}
                <path d="M 800 260 C 850 260, 880 150, 930 150" fill="none" stroke="#f1f5f9" strokeWidth="2" />
                <path d="M 800 260 C 850 260, 880 390, 930 390" fill="none" stroke="#f1f5f9" strokeWidth="2" />
             </svg>
          </div>

          {/* Left Container (Inputs) */}
          <div className="absolute left-10 h-full flex flex-col justify-center items-end pr-10 z-10 w-96">
            
            {/* AsyncAPI Pill */}
            <div className="absolute top-[85px] right-20 flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-[#fafafa]/50 border border-slate-100 text-slate-300 font-bold text-sm shadow-sm backdrop-blur-sm">
              <div className="bg-indigo-50/50 p-1.5 rounded-lg text-indigo-300">
                <Hash className="w-4 h-4" />
              </div>
              AsyncAPI
            </div>
            
            {/* OpenAPI Pill */}
            <div className="absolute top-[150px] right-28 flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-white/70 border border-slate-100 text-slate-400 font-bold text-sm shadow-sm backdrop-blur-sm">
              <div className="bg-emerald-50 p-1.5 rounded-lg text-emerald-400">
                <Braces className="w-4 h-4" />
              </div>
              OpenAPI
            </div>

            {/* Active Prismify Pill */}
            <div className="absolute top-[210px] right-0 flex items-center gap-3 px-5 py-3 rounded-2xl bg-white border border-slate-200 text-[#0b8a24] font-extrabold shadow-[0_15px_40px_-10px_rgba(0,0,0,0.12)] z-20 pointer-events-auto hover:-translate-y-0.5 transition-transform tracking-wide text-[15px]">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="#16a34a" />
                <path d="M2 17L12 22L22 17" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M2 12L12 17L22 12" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Prismify Definition
            </div>

            {/* gRPC Pill */}
            <div className="absolute top-[350px] right-28 flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-white/50 border border-slate-100 text-slate-300 font-bold text-sm shadow-sm backdrop-blur-sm">
              <div className="bg-slate-50 p-1.5 rounded-lg text-slate-300">
                <Settings2 className="w-4 h-4" />
              </div>
              gRPC
            </div>
            
          </div>

          {/* Center Terminal */}
          <div className="bg-white border border-slate-200 rounded-[20px] w-[340px] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.08)] z-20 pointer-events-auto overflow-hidden">
            <div className="flex items-center justify-center h-10 border-b border-slate-100 bg-white relative">
              <div className="absolute left-4 flex gap-1.5">
                 <div className="w-2.5 h-2.5 rounded-full bg-slate-200"></div>
                 <div className="w-2.5 h-2.5 rounded-full bg-slate-200"></div>
                 <div className="w-2.5 h-2.5 rounded-full bg-slate-200"></div>
              </div>
              <span className="text-[11px] font-mono text-slate-400 font-medium tracking-wide">terminal</span>
            </div>
            <div className="px-5 py-4 font-mono text-[13px] text-slate-500 h-[80px] flex items-center bg-[#fafafa]">
              <span className="text-slate-300 mr-2">~</span> <span className="mr-2 text-slate-300">%</span> 
              <span className="text-slate-600 font-medium">prismify generate</span>
              <span className="w-1.5 h-3.5 bg-green-500 ml-1.5 animate-pulse rounded-sm relative top-[1px]"></span>
            </div>
          </div>

          {/* Right Inputs Column (Outputs) */}
          <div className="absolute right-0 h-full w-[450px] flex flex-col items-start justify-center z-10 pointer-events-auto">
             
             {/* SDK Architecture Mockup */}
             <div className="absolute top-[30px] left-8 bg-white border border-slate-200 rounded-[18px] shadow-[0_15px_40px_-15px_rgba(0,0,0,0.08)] p-6 w-[420px] hover:-translate-y-1 transition-transform">
               
               <div className="flex gap-6 mb-6 text-[11px] font-bold text-slate-500 justify-between items-end border-b border-slate-100 pb-4">
                 <div className="flex flex-col items-center gap-2">
                   <div className="w-7 h-7 bg-[#2563eb] rounded flex items-center justify-center text-white text-[10px] shadow-sm">TS</div>
                   <span className="text-slate-600">Typescript</span>
                 </div>
                 <div className="flex flex-col items-center gap-2 opacity-50">
                   <div className="w-7 h-7 bg-[#eab308] rounded flex items-center justify-center text-white text-[10px] font-serif italic shadow-sm">py</div>
                   <span>Python</span>
                 </div>
                 <div className="flex flex-col items-center gap-2 opacity-50">
                   <div className="w-7 h-7 bg-[#06b6d4] rounded flex items-center justify-center text-white text-[10px] shadow-sm">GO</div>
                   <span>Go</span>
                 </div>
                 <div className="flex flex-col items-center gap-2 opacity-50">
                   <div className="w-7 h-7 bg-[#f97316] rounded flex items-center justify-center text-white text-[10px] shadow-sm">J</div>
                   <span>Java</span>
                 </div>
                 <div className="flex flex-col items-center gap-2 opacity-50">
                   <div className="w-7 h-7 bg-[#8b5cf6] rounded flex items-center justify-center text-white text-[10px] shadow-sm">.NET</div>
                   <span>.NET</span>
                 </div>
                 <div className="flex flex-col items-center gap-2 opacity-50">
                   <div className="w-7 h-7 bg-[#64748b] rounded flex items-center justify-center text-white text-[10px] shadow-sm">PHP</div>
                 </div>
               </div>
               
               <div className="font-mono text-[13px] text-slate-600 font-medium flex items-center">
                 <span className="text-slate-300 mr-3 text-lg relative -top-[1px] font-light">$</span> npm install your-company
               </div>
             </div>

             {/* Docs Architecture Mockup */}
             <div className="absolute top-[240px] left-16 bg-[#f8fafc] border border-slate-200 rounded-[18px] shadow-[0_15px_40px_-15px_rgba(0,0,0,0.08)] w-[420px] h-[220px] overflow-hidden flex flex-col pt-3 px-3 hover:-translate-y-1 transition-transform">
               {/* Tiny search bar */}
               <div className="h-7 w-36 bg-white border border-slate-200 rounded-md absolute top-3 right-4 shadow-sm flex items-center px-2 gap-1.5 z-20">
                 <Search className="w-3 h-3 text-slate-300" />
                 <div className="h-1 w-12 bg-slate-100 rounded"></div>
               </div>
               <div className="h-2.5 w-2.5 rounded-full bg-slate-300 absolute top-5 left-5 z-20"></div>

               {/* UI Frames */}
               <div className="flex gap-3 mt-8 h-full">
                 {/* Sidebar */}
                 <div className="w-24 h-full bg-slate-200/50 rounded-t-lg p-3 flex flex-col gap-2">
                    <div className="h-2 bg-slate-300 rounded w-full"></div>
                    <div className="h-2 bg-slate-300 rounded w-3/4 mb-3"></div>
                    <div className="h-1.5 bg-slate-200 rounded w-full"></div>
                    <div className="h-1.5 bg-slate-200 rounded w-full"></div>
                    <div className="h-1.5 bg-slate-200 rounded w-5/6"></div>
                 </div>
                 {/* Content */}
                 <div className="flex-1 bg-white rounded-t-xl border-x border-t border-slate-200 p-6 shadow-sm flex flex-col gap-3 relative overflow-hidden">
                    <div className="absolute inset-x-0 h-16 bg-gradient-to-b from-white via-white to-transparent top-0 z-10 hidden"></div>
                    <div className="h-4 w-1/3 bg-[#0f172a] rounded-sm mb-2"></div>
                    <div className="h-2 w-full bg-slate-100 rounded"></div>
                    <div className="h-2 w-full bg-slate-100 rounded"></div>
                    <div className="h-2 w-3/4 bg-slate-100 rounded mb-6"></div>
                    
                    <div className="h-20 w-full bg-slate-50 border border-slate-100 rounded-lg flex p-3">
                       <div className="h-3 w-16 bg-slate-200 rounded"></div>
                    </div>
                 </div>
               </div>
             </div>

          </div>

        </div>

      </main>
    </div>
  );
}
