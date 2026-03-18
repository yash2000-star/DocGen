import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase, loginWithGitHub, sendOTP, verifyOTP } from "../lib/auth";

export default function LoginPage() {
  // --- STATE ---
  const [screen, setScreen] = useState("login"); // 'login', 'otp', 'success'
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle"); 
  const [errorMessage, setErrorMessage] = useState("");
  
  // OTP specific state
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [timer, setTimer] = useState(0);
  const inputRefs = useRef([]);

  const navigate = useNavigate();

  // --- SESSION AUTO-DETECT ---
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate("/dashboard", { replace: true });
    });
  }, [navigate]);

  // --- OTP COUNTDOWN TIMER ---
  useEffect(() => {
    let interval;
    if (timer > 0 && screen === "otp") {
      interval = setInterval(() => setTimer((prev) => prev - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [timer, screen]);

  // --- HANDLERS ---
  const handleGitHubLogin = async () => {
    await loginWithGitHub();
  };

  const handleSendOtp = async (e) => {
    e?.preventDefault();
    setStatus("loading");
    setErrorMessage("");
    
    const { error } = await sendOTP(email);
    
    if (error) {
      setErrorMessage(error.message);
      setStatus("idle");
    } else {
      setStatus("idle");
      setScreen("otp");
      setTimer(60); // Start 60s countdown
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    const otpCode = otp.join("");
    if (otpCode.length !== 6) return;

    setStatus("loading");
    setErrorMessage("");

    const { data, error } = await verifyOTP(email, otpCode);

    if (error) {
      setErrorMessage("Invalid code. Please try again.");
      setStatus("idle");
    } else if (data.session) {
      setScreen("success");
      setTimeout(() => navigate("/dashboard", { replace: true }), 1000);
    }
  };

  // --- 6-CELL OTP LOGIC ---
  const handleOtpChange = (index, value) => {
    if (!/^[0-9]*$/.test(value)) return; // Only allow numbers
    
    const newOtp = [...otp];
    newOtp[index] = value.substring(value.length - 1); // Take last char if they type fast
    setOtp(newOtp);

    // Auto-advance to next cell
    if (value && index < 5) {
      inputRefs.current[index + 1].focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    // Move back on backspace if empty
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1].focus();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text/plain").slice(0, 6).split("");
    if (pastedData.some(char => !/^[0-9]$/.test(char))) return; // Ensure all numbers

    const newOtp = [...otp];
    pastedData.forEach((char, i) => { newOtp[i] = char; });
    setOtp(newOtp);
    
    // Focus last filled input
    const focusIndex = Math.min(pastedData.length, 5);
    inputRefs.current[focusIndex].focus();
  };

  // --- UI RENDER ---
  return (
    <div style={{ display: "flex", minHeight: "100vh", backgroundColor: "var(--bg-main)", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      
      {/* LEFT PANEL: Branding & Marketing (Hidden on narrow screens) */}
      <div style={{ flex: 1, backgroundColor: "#0F111A", padding: "60px", display: "flex", flexDirection: "column", justifyContent: "space-between", color: "white", borderRight: "1px solid #1F2233" }}>
        
        {/* Logo area */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "40px" }}>
             {/* SVG Logo Mark */}
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="32" height="32" rx="8" fill="#3b82f6"/>
              <path d="M10 12C10 10.8954 10.8954 10 12 10H20C21.1046 10 22 10.8954 22 12V20C22 21.1046 21.1046 22 20 22H12C10.8954 22 10 21.1046 10 20V12Z" fill="white" fillOpacity="0.8"/>
              <path d="M14 14H18" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round"/>
              <path d="M14 18H16" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <span style={{ fontSize: "20px", fontWeight: "700", letterSpacing: "-0.5px" }}>DocGen</span>
          </div>
          
          <h2 style={{ fontSize: "36px", fontWeight: "600", lineHeight: "1.2", marginBottom: "24px", letterSpacing: "-1px" }}>
            The fastest way to build <br/>
            <span style={{ color: "#3b82f6" }}>world-class documentation.</span>
          </h2>
          
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "15px", color: "#A0A4B8" }}>
              <span style={{ color: "#10B981" }}>✓</span> AI-powered MDX generation
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "15px", color: "#A0A4B8" }}>
              <span style={{ color: "#10B981" }}>✓</span> Real-time GitHub sync
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "15px", color: "#A0A4B8" }}>
              <span style={{ color: "#10B981" }}>✓</span> Semantic search built-in
            </div>
          </div>
        </div>

        {/* Social Proof */}
        <div>
          <p style={{ fontSize: "13px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "1px", fontWeight: "600", marginBottom: "16px" }}>Trusted by engineering teams</p>
          <div style={{ display: "flex", gap: "24px", opacity: 0.5 }}>
             <span style={{ fontWeight: "bold", fontSize: "18px" }}>Acme Corp</span>
             <span style={{ fontWeight: "bold", fontSize: "18px" }}>Globex</span>
          </div>
        </div>
      </div>

      {/* RIGHT PANEL: Auth Form */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "40px", backgroundColor: "#ffffff" }}>
        <div style={{ width: "100%", maxWidth: "380px" }}>
          
          {/* Header */}
          <div style={{ marginBottom: "32px" }}>
            <h1 style={{ fontSize: "24px", fontWeight: "700", color: "#111827", marginBottom: "8px" }}>
              {screen === "login" && "Sign in"}
              {screen === "otp" && "Check your email"}
              {screen === "success" && "Welcome back"}
            </h1>
            <p style={{ color: "#6B7280", fontSize: "15px" }}>
              {screen === "login" && "to continue to your DocGen dashboard"}
              {screen === "otp" && `We sent a 6-digit code to ${email}`}
              {screen === "success" && "Redirecting you to the platform..."}
            </p>
          </div>

          {errorMessage && (
            <div style={{ marginBottom: "24px", padding: "12px", backgroundColor: "#FEF2F2", color: "#991B1B", borderRadius: "8px", fontSize: "14px", border: "1px solid #FECACA" }}>
              {errorMessage}
            </div>
          )}

          {/* SCREEN 1: LOGIN */}
          {screen === "login" && (
            <>
              <button 
                onClick={handleGitHubLogin} 
                style={{ width: "100%", padding: "12px", backgroundColor: "#18181B", border: "none", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", color: "white", fontSize: "15px", fontWeight: "500", cursor: "pointer", transition: "background 0.2s" }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#27272A"}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = "#18181B"}
              >
                {/* Official GitHub SVG */}
                <svg height="20" width="20" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path>
                </svg>
                Continue with GitHub
              </button>

              <div style={{ display: "flex", alignItems: "center", margin: "24px 0" }}>
                <div style={{ flex: 1, height: "1px", backgroundColor: "#E5E7EB" }}></div>
                <span style={{ padding: "0 12px", color: "#9CA3AF", fontSize: "13px" }}>or</span>
                <div style={{ flex: 1, height: "1px", backgroundColor: "#E5E7EB" }}></div>
              </div>

              <form onSubmit={handleSendOtp}>
                <div style={{ marginBottom: "20px" }}>
                  <label style={{ display: "block", marginBottom: "8px", fontSize: "14px", fontWeight: "500", color: "#374151" }}>Work email</label>
                  <input 
                    type="email" 
                    placeholder="you@company.com" 
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)} 
                    required 
                    style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #D1D5DB", backgroundColor: "#fff", color: "#111827", fontSize: "15px", outline: "none", transition: "border-color 0.2s" }} 
                    onFocus={(e) => e.target.style.borderColor = "#3b82f6"}
                    onBlur={(e) => e.target.style.borderColor = "#D1D5DB"}
                  />
                </div>
                <button type="submit" disabled={status === "loading"} style={{ width: "100%", padding: "12px", backgroundColor: "#fff", border: "1px solid #D1D5DB", borderRadius: "8px", color: "#374151", fontSize: "15px", fontWeight: "500", cursor: status === "loading" ? "not-allowed" : "pointer", transition: "background 0.2s" }}
                  onMouseOver={(e) => { if(status !== "loading") e.currentTarget.style.backgroundColor = "#F9FAFB" }}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = "#fff"}
                >
                  {status === "loading" ? "Sending..." : "Continue with email"}
                </button>
              </form>
            </>
          )}

          {/* SCREEN 2: OTP ENTRY */}
          {screen === "otp" && (
            <form onSubmit={handleVerifyOtp}>
              {/* 6-Cell Input Container */}
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "24px" }} onPaste={handleOtpPaste}>
                {otp.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => (inputRefs.current[index] = el)}
                    type="text"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(index, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(index, e)}
                    style={{ width: "45px", height: "55px", textAlign: "center", fontSize: "24px", fontWeight: "600", color: "#111827", border: "1px solid #D1D5DB", borderRadius: "8px", backgroundColor: "#fff", outline: "none", transition: "border-color 0.2s" }}
                    onFocus={(e) => e.target.style.borderColor = "#3b82f6"}
                    onBlur={(e) => e.target.style.borderColor = "#D1D5DB"}
                  />
                ))}
              </div>
              
              <button type="submit" disabled={status === "loading" || otp.join("").length !== 6} style={{ width: "100%", padding: "12px", backgroundColor: "#3b82f6", border: "none", borderRadius: "8px", color: "#fff", fontSize: "15px", fontWeight: "500", cursor: (status === "loading" || otp.join("").length !== 6) ? "not-allowed" : "pointer", marginBottom: "24px", opacity: otp.join("").length !== 6 ? 0.7 : 1 }}>
                {status === "loading" ? "Verifying..." : "Verify Code"}
              </button>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "13px" }}>
                <button type="button" onClick={() => setScreen("login")} style={{ background: "none", border: "none", color: "#6B7280", cursor: "pointer" }}>
                  ← Back to login
                </button>
                <button type="button" disabled={timer > 0} onClick={handleSendOtp} style={{ background: "none", border: "none", color: timer > 0 ? "#9CA3AF" : "#3b82f6", fontWeight: "500", cursor: timer > 0 ? "default" : "pointer" }}>
                  {timer > 0 ? `Resend code in ${timer}s` : "Resend code"}
                </button>
              </div>
            </form>
          )}

          {/* SCREEN 3: SUCCESS */}
          {screen === "success" && (
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <div style={{ width: "64px", height: "64px", backgroundColor: "#D1FAE5", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px", color: "#10B981" }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}