import { Link } from "react-router-dom";

export default function LandingPage() {
  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f8fafc", fontFamily: "system-ui, -apple-system, sans-serif", overflowX: "hidden" }}>
      
      {/* PUBLIC NAVBAR */}
      <nav style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 48px", backgroundColor: "rgba(255, 255, 255, 0.8)", backdropFilter: "blur(12px)", position: "sticky", top: 0, zIndex: 100, borderBottom: "1px solid #e2e8f0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ width: "28px", height: "28px", backgroundColor: "#0f172a", borderRadius: "6px" }}></div>
          <span style={{ fontSize: "20px", fontWeight: "700", color: "#0f172a", letterSpacing: "-0.5px" }}>Prismify</span>
        </div>
        <div style={{ display: "flex", gap: "24px", alignItems: "center" }}>
          <Link to="/login" style={{ color: "#64748b", textDecoration: "none", fontSize: "14px", fontWeight: "600" }}>Log in</Link>
          <Link to="/login" style={{ backgroundColor: "#0f172a", color: "white", textDecoration: "none", padding: "8px 16px", borderRadius: "6px", fontSize: "14px", fontWeight: "600", transition: "transform 0.2s" }}>
            Get Started Free
          </Link>
        </div>
      </nav>

      {/* 1. THE HERO SECTION (Document360 Style) */}
      <div style={{ padding: "80px 20px 40px", textAlign: "center", maxWidth: "900px", margin: "0 auto" }}>
        <div style={{ display: "inline-block", padding: "6px 16px", backgroundColor: "#eff6ff", color: "#2563eb", borderRadius: "99px", fontSize: "13px", fontWeight: "600", marginBottom: "24px", border: "1px solid #bfdbfe" }}>
          ✨ The MDX Ferrari Engine is Live
        </div>
        
        <h1 style={{ fontSize: "64px", fontWeight: "800", color: "#0f172a", lineHeight: "1.1", letterSpacing: "-2px", margin: "0 0 24px 0" }}>
          Beautiful documentation, <br />
          <span style={{ color: "#10b981" }}>generated in seconds.</span>
        </h1>
        
        <p style={{ fontSize: "20px", color: "#64748b", lineHeight: "1.6", marginBottom: "40px", maxWidth: "600px", margin: "0 auto 40px auto" }}>
          Prismify connects to your GitHub repository, reads your code, and automatically generates stunning, interactive MDX documentation.
        </p>
        
        <div style={{ display: "flex", gap: "16px", justifyContent: "center", alignItems: "center" }}>
          <Link to="/login" style={{ backgroundColor: "#0f172a", color: "white", textDecoration: "none", padding: "14px 28px", borderRadius: "8px", fontSize: "16px", fontWeight: "600", boxShadow: "0 4px 14px 0 rgba(0,0,0,0.1)" }}>
            Start Building
          </Link>
          <a href="#features" style={{ backgroundColor: "white", color: "#0f172a", textDecoration: "none", padding: "14px 28px", borderRadius: "8px", fontSize: "16px", fontWeight: "600", border: "1px solid #e2e8f0", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
            View Demo
          </a>
        </div>
      </div>

      {/* 2. THE FLOATING MOCKUP */}
      <div style={{ maxWidth: "1000px", margin: "0 auto", padding: "0 20px", transform: "translateY(20px)" }}>
        <div style={{ backgroundColor: "white", borderRadius: "16px", border: "1px solid #e2e8f0", boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)", overflow: "hidden", display: "flex", height: "500px" }}>
          
          {/* Mockup Sidebar */}
          <div style={{ width: "240px", borderRight: "1px solid #e2e8f0", backgroundColor: "#f8fafc", padding: "24px" }}>
            <div style={{ width: "100%", height: "24px", backgroundColor: "#e2e8f0", borderRadius: "4px", marginBottom: "32px" }}></div>
            <div style={{ width: "40%", height: "12px", backgroundColor: "#94a3b8", borderRadius: "4px", marginBottom: "16px" }}></div>
            <div style={{ width: "80%", height: "12px", backgroundColor: "#cbd5e1", borderRadius: "4px", marginBottom: "12px" }}></div>
            <div style={{ width: "70%", height: "12px", backgroundColor: "#cbd5e1", borderRadius: "4px", marginBottom: "12px", borderLeft: "2px solid #10b981", paddingLeft: "8px", color: "transparent" }}>_</div>
            <div style={{ width: "85%", height: "12px", backgroundColor: "#cbd5e1", borderRadius: "4px", marginBottom: "32px" }}></div>
          </div>

          {/* Mockup Content */}
          <div style={{ flex: 1, padding: "40px" }}>
            <div style={{ width: "50%", height: "32px", backgroundColor: "#cbd5e1", borderRadius: "6px", marginBottom: "24px" }}></div>
            <div style={{ width: "100%", height: "12px", backgroundColor: "#e2e8f0", borderRadius: "4px", marginBottom: "12px" }}></div>
            <div style={{ width: "90%", height: "12px", backgroundColor: "#e2e8f0", borderRadius: "4px", marginBottom: "32px" }}></div>
            
            {/* Mockup Code Block */}
            <div style={{ width: "100%", height: "160px", backgroundColor: "#0f172a", borderRadius: "8px", padding: "20px", position: "relative" }}>
              <div style={{ width: "30%", height: "12px", backgroundColor: "#38bdf8", borderRadius: "4px", marginBottom: "16px" }}></div>
              <div style={{ width: "60%", height: "12px", backgroundColor: "#a78bfa", borderRadius: "4px", marginBottom: "12px", marginLeft: "24px" }}></div>
              <div style={{ width: "40%", height: "12px", backgroundColor: "#a78bfa", borderRadius: "4px", marginLeft: "24px" }}></div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. SOCIAL PROOF LOGOS */}
      <div style={{ padding: "80px 20px", textAlign: "center", borderBottom: "1px solid #e2e8f0", backgroundColor: "white" }}>
        <p style={{ fontSize: "14px", color: "#64748b", fontWeight: "600", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "32px" }}>
          Powering documentation for modern engineering teams
        </p>
        <div style={{ display: "flex", justifyContent: "center", gap: "60px", flexWrap: "wrap", opacity: 0.5, filter: "grayscale(100%)" }}>
          <h2 style={{ margin: 0, fontSize: "24px", fontWeight: "800", color: "#0f172a" }}>Acme Corp</h2>
          <h2 style={{ margin: 0, fontSize: "24px", fontWeight: "800", color: "#0f172a" }}>GlobalTech</h2>
          <h2 style={{ margin: 0, fontSize: "24px", fontWeight: "800", color: "#0f172a" }}>Stripeify</h2>
          <h2 style={{ margin: 0, fontSize: "24px", fontWeight: "800", color: "#0f172a" }}>Vercelly</h2>
        </div>
      </div>

      {/* 4. THE WORKFLOW (Z-Pattern Layout) */}
      <div id="features" style={{ padding: "100px 20px", backgroundColor: "#f8fafc" }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "120px" }}>
          
          {/* Feature 1: AI Ghostwriter (Text Left, Image Right) */}
          <div style={{ display: "flex", alignItems: "center", gap: "60px", flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 400px" }}>
              <div style={{ display: "inline-block", padding: "4px 12px", backgroundColor: "#f0fdf4", color: "#16a34a", borderRadius: "6px", fontSize: "12px", fontWeight: "700", marginBottom: "16px", textTransform: "uppercase", letterSpacing: "1px" }}>
                AI Generation
              </div>
              <h2 style={{ fontSize: "36px", fontWeight: "800", color: "#0f172a", marginBottom: "20px", lineHeight: "1.2" }}>
                Your code explains itself.
              </h2>
              <p style={{ fontSize: "18px", color: "#64748b", lineHeight: "1.6", marginBottom: "24px" }}>
                Stop writing docs by hand. Prismify's AI Ghostwriter scans your GitHub repository, understands your Express routes, and automatically generates perfectly structured MDX files.
              </p>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, color: "#475569", fontSize: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
                <li style={{ display: "flex", alignItems: "center", gap: "8px" }}><span style={{ color: "#10b981" }}>✔</span> Auto-detects endpoints & parameters</li>
                <li style={{ display: "flex", alignItems: "center", gap: "8px" }}><span style={{ color: "#10b981" }}>✔</span> Generates code examples automatically</li>
                <li style={{ display: "flex", alignItems: "center", gap: "8px" }}><span style={{ color: "#10b981" }}>✔</span> Keeps docs in sync with main branch</li>
              </ul>
            </div>
            
            <div style={{ flex: "1 1 400px", position: "relative" }}>
               {/* Decorative Background Blob */}
               <div style={{ position: "absolute", top: "-20px", right: "-20px", width: "100%", height: "100%", backgroundColor: "#d1fae5", borderRadius: "24px", zIndex: 0 }}></div>
               <div style={{ position: "relative", backgroundColor: "#0f172a", borderRadius: "16px", padding: "24px", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)", zIndex: 1, border: "1px solid #1e293b" }}>
                 <div style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
                   <div style={{ width: "12px", height: "12px", borderRadius: "50%", backgroundColor: "#ef4444" }}></div>
                   <div style={{ width: "12px", height: "12px", borderRadius: "50%", backgroundColor: "#eab308" }}></div>
                   <div style={{ width: "12px", height: "12px", borderRadius: "50%", backgroundColor: "#22c55e" }}></div>
                 </div>
                 <pre style={{ color: "#38bdf8", fontSize: "13px", fontFamily: "monospace", margin: 0, lineHeight: "1.5" }}>
                   <code>
                     <span style={{ color: "#a78bfa" }}>router</span>.post(<span style={{ color: "#a3e635" }}>'/api/users'</span>, auth, <span style={{ color: "#f472b6" }}>async</span> (req, res) {`=>`} {'{\n'}
                     {'  '}// AI detects this route...{'\n'}
                     {'  '}const {'{'} email, name {'}'} = req.body;{'\n'}
                     {'}'});{'\n'}
                     {'\n'}
                     <span style={{ color: "#94a3b8" }}>{'// Automatically generates:'}</span>{'\n'}
                     <span style={{ color: "#fbbf24" }}>&lt;ParamField</span> body=<span style={{ color: "#a3e635" }}>"email"</span> type=<span style={{ color: "#a3e635" }}>"string"</span><span style={{ color: "#fbbf24" }}>&gt;</span>{'\n'}
                     {'  '}The user's email address.{'\n'}
                     <span style={{ color: "#fbbf24" }}>&lt;/ParamField&gt;</span>
                   </code>
                 </pre>
               </div>
            </div>
          </div>

          {/* Feature 2: API Playground (Image Left, Text Right) */}
          <div style={{ display: "flex", alignItems: "center", gap: "60px", flexWrap: "wrap", flexDirection: "row-reverse" }}>
            <div style={{ flex: "1 1 400px" }}>
              <div style={{ display: "inline-block", padding: "4px 12px", backgroundColor: "#fff7ed", color: "#ea580c", borderRadius: "6px", fontSize: "12px", fontWeight: "700", marginBottom: "16px", textTransform: "uppercase", letterSpacing: "1px" }}>
                Interactive Testing
              </div>
              <h2 style={{ fontSize: "36px", fontWeight: "800", color: "#0f172a", marginBottom: "20px", lineHeight: "1.2" }}>
                Test APIs without leaving the page.
              </h2>
              <p style={{ fontSize: "18px", color: "#64748b", lineHeight: "1.6", marginBottom: "24px" }}>
                Give your developers a world-class experience. With built-in API Playgrounds, users can input variables and fire real requests directly from your MDX documentation.
              </p>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, color: "#475569", fontSize: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
                <li style={{ display: "flex", alignItems: "center", gap: "8px" }}><span style={{ color: "#ea580c" }}>✔</span> Bypasses CORS via backend proxy</li>
                <li style={{ display: "flex", alignItems: "center", gap: "8px" }}><span style={{ color: "#ea580c" }}>✔</span> Live JSON response rendering</li>
                <li style={{ display: "flex", alignItems: "center", gap: "8px" }}><span style={{ color: "#ea580c" }}>✔</span> Beautiful method color-coding</li>
              </ul>
            </div>
            
            <div style={{ flex: "1 1 400px", position: "relative" }}>
               <div style={{ position: "absolute", top: "20px", left: "-20px", width: "100%", height: "100%", backgroundColor: "#ffedd5", borderRadius: "24px", zIndex: 0 }}></div>
               <div style={{ position: "relative", backgroundColor: "white", borderRadius: "16px", padding: "0", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)", zIndex: 1, border: "1px solid #e2e8f0", overflow: "hidden" }}>
                  <div style={{ padding: "16px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", backgroundColor: "#f8fafc" }}>
                    <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                      <span style={{ backgroundColor: "#f0fdf4", color: "#16a34a", padding: "4px 8px", borderRadius: "4px", fontSize: "12px", fontWeight: "bold" }}>POST</span>
                      <span style={{ fontFamily: "monospace", fontSize: "13px", color: "#0f172a" }}>/v1/checkout/sessions</span>
                    </div>
                    <button style={{ backgroundColor: "#0f172a", color: "white", border: "none", padding: "6px 16px", borderRadius: "6px", fontSize: "12px", fontWeight: "bold" }}>Test Request</button>
                  </div>
                  <div style={{ padding: "16px", backgroundColor: "#0f172a", color: "#38bdf8", fontFamily: "monospace", fontSize: "12px" }}>
                    {'{'}<br/>
                    &nbsp;&nbsp;"id": "cs_test_a1b2c3",<br/>
                    &nbsp;&nbsp;"object": "checkout.session",<br/>
                    &nbsp;&nbsp;"payment_status": "unpaid"<br/>
                    {'}'}
                  </div>
               </div>
            </div>
          </div>

        </div>
      </div>

      {/* 5. FINAL CTA SECTION */}
      <div style={{ padding: "100px 20px", textAlign: "center", backgroundColor: "#0f172a", color: "white" }}>
        <h2 style={{ fontSize: "48px", fontWeight: "800", marginBottom: "24px", letterSpacing: "-1px" }}>
          Ready to upgrade your docs?
        </h2>
        <p style={{ fontSize: "20px", color: "#94a3b8", marginBottom: "40px", maxWidth: "600px", margin: "0 auto 40px auto", lineHeight: "1.6" }}>
          Join the next generation of SaaS companies building interactive, AI-powered documentation in seconds.
        </p>
        <div style={{ display: "flex", gap: "16px", justifyContent: "center" }}>
          <Link to="/login" style={{ backgroundColor: "#10b981", color: "white", textDecoration: "none", padding: "16px 32px", borderRadius: "8px", fontSize: "16px", fontWeight: "700", boxShadow: "0 4px 14px 0 rgba(16, 185, 129, 0.3)", transition: "transform 0.2s" }}>
            Get Started for Free
          </Link>
        </div>
      </div>

      {/* 6. SIMPLE FOOTER */}
      <footer style={{ backgroundColor: "#ffffff", borderTop: "1px solid #e2e8f0", padding: "60px 20px 40px" }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "40px" }}>
          
          <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "40px" }}>
            {/* Footer Logo & Tagline */}
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
                <div style={{ width: "24px", height: "24px", backgroundColor: "#0f172a", borderRadius: "6px" }}></div>
                <span style={{ fontSize: "18px", fontWeight: "700", color: "#0f172a" }}>Prismify</span>
              </div>
              <p style={{ color: "#64748b", fontSize: "14px", maxWidth: "250px", lineHeight: "1.6" }}>
                The MDX Ferrari Engine. Built for developers, designed for users.
              </p>
            </div>
            
            {/* Footer Links */}
            <div style={{ display: "flex", gap: "80px", flexWrap: "wrap" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <strong style={{ color: "#0f172a", fontSize: "14px", textTransform: "uppercase", letterSpacing: "1px" }}>Product</strong>
                <a href="#" style={{ color: "#64748b", textDecoration: "none", fontSize: "14px" }}>Features</a>
                <a href="#" style={{ color: "#64748b", textDecoration: "none", fontSize: "14px" }}>Integrations</a>
                <a href="#" style={{ color: "#64748b", textDecoration: "none", fontSize: "14px" }}>Pricing</a>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <strong style={{ color: "#0f172a", fontSize: "14px", textTransform: "uppercase", letterSpacing: "1px" }}>Resources</strong>
                <a href="#" style={{ color: "#64748b", textDecoration: "none", fontSize: "14px" }}>Documentation</a>
                <a href="#" style={{ color: "#64748b", textDecoration: "none", fontSize: "14px" }}>API Reference</a>
                <a href="#" style={{ color: "#64748b", textDecoration: "none", fontSize: "14px" }}>Blog</a>
              </div>
            </div>
          </div>
          
          {/* Copyright Row */}
          <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: "24px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "20px" }}>
            <p style={{ color: "#94a3b8", fontSize: "13px", margin: 0 }}>© 2026 Prismify. All rights reserved.</p>
            <div style={{ display: "flex", gap: "24px" }}>
              <a href="#" style={{ color: "#94a3b8", textDecoration: "none", fontSize: "13px" }}>Privacy Policy</a>
              <a href="#" style={{ color: "#94a3b8", textDecoration: "none", fontSize: "13px" }}>Terms of Service</a>
            </div>
          </div>

        </div>
      </footer>

    </div>
  );
}