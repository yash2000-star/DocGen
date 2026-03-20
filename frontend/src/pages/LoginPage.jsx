import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase, loginWithGitHub, sendOTP, verifyOTP } from "../lib/auth";

export default function LoginPage() {
  // --- STATE ---
  const [screen, setScreen] = useState("login"); // 'login', 'otp', '2fa', 'success'
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle"); 
  const [errorMessage, setErrorMessage] = useState("");
  
  // OTP & 2FA specific state
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [timer, setTimer] = useState(0);
  const [factorId2fa, setFactorId2fa] = useState(null);
  const inputRefs = useRef([]);

  const navigate = useNavigate();

  // --- SESSION AUTO-DETECT ---
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session && session.user.factors?.length > 0) {
         if (session.aal === 'aal2') navigate("/dashboard", { replace: true });
      } else if (session) {
         navigate("/dashboard", { replace: true });
      }
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
    if (!email) return;
    setStatus("loading");
    setErrorMessage("");
    
    const { error } = await sendOTP(email);
    
    if (error) {
      setErrorMessage(error.message);
      setStatus("idle");
    } else {
      setStatus("idle");
      setScreen("otp");
      setTimer(60); 
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
      setOtp(["", "", "", "", "", ""]); 
      await checkFor2FA();
    }
  };

  // --- 2FA SECURITY CHECK ---
  const checkFor2FA = async () => {
    const { data } = await supabase.auth.mfa.listFactors();
    const totpFactor = data?.totp?.find(f => f.status === 'verified');

    if (totpFactor) {
      setScreen("2fa");
      setFactorId2fa(totpFactor.id);
      setStatus("idle");
    } else {
      setScreen("success");
      setTimeout(() => navigate("/dashboard", { replace: true }), 1000);
    }
  };

  const handleVerify2FA = async (e) => {
    e.preventDefault();
    const code = otp.join("");
    if (code.length !== 6) return;

    setStatus("loading");
    setErrorMessage("");

    const { data: challenge, error: challengeErr } = await supabase.auth.mfa.challenge({ factorId: factorId2fa });
    
    if (challengeErr) {
      setErrorMessage("Failed to start 2FA verification.");
      setStatus("idle");
      return;
    }

    const { error: verifyErr } = await supabase.auth.mfa.verify({
      factorId: factorId2fa,
      challengeId: challenge.id,
      code: code,
    });

    if (verifyErr) {
      setErrorMessage("Invalid authenticator code. Please try again.");
      setStatus("idle");
    } else {
      setScreen("success");
      setTimeout(() => navigate("/dashboard", { replace: true }), 1000);
    }
  };

  // --- 6-CELL OTP LOGIC ---
  const handleOtpChange = (index, value) => {
    if (!/^[0-9]*$/.test(value)) return; 
    
    const newOtp = [...otp];
    newOtp[index] = value.substring(value.length - 1); 
    setOtp(newOtp);

    if (value && index < 5) {
      inputRefs.current[index + 1].focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1].focus();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text/plain").slice(0, 6).split("");
    if (pastedData.some(char => !/^[0-9]$/.test(char))) return; 

    const newOtp = [...otp];
    pastedData.forEach((char, i) => { newOtp[i] = char; });
    setOtp(newOtp);
    
    const focusIndex = Math.min(pastedData.length, 5);
    if (inputRefs.current[focusIndex]) {
       inputRefs.current[focusIndex].focus();
    }
  };

  // --- SHARED STYLES ---
  const inputStyle = {
    width: "100%",
    padding: "12px",
    borderRadius: "8px",
    border: "1px solid #333",
    backgroundColor: "transparent",
    color: "#fff",
    fontSize: "15px",
    outline: "none",
    transition: "border-color 0.2s",
    boxSizing: "border-box"
  };

  const buttonStyle = {
    width: "100%",
    padding: "12px",
    backgroundColor: "transparent",
    border: "1px solid #333",
    borderRadius: "8px",
    color: "#fff",
    fontSize: "14px",
    fontWeight: "500",
    cursor: "pointer",
    transition: "all 0.2s",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px"
  };

  // --- UI RENDER ---
  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#09090b", color: "#ededed", fontFamily: "system-ui, -apple-system, sans-serif", display: "flex", flexDirection: "column", alignItems: "center" }}>
      
      <div style={{ width: "100%", maxWidth: "360px", marginTop: "12vh", padding: "0 20px" }}>
        
        {/* Logo */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "32px" }}>
          <div style={{ width: "36px", height: "36px", backgroundColor: "#0fba81", borderRadius: "8px", position: "relative", transform: "rotate(-15deg)" }}>
            <div style={{ position: "absolute", bottom: "6px", right: "6px", width: "12px", height: "12px", backgroundColor: "#09090b", borderRadius: "50%" }}></div>
          </div>
        </div>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <h1 style={{ fontSize: "24px", fontWeight: "600", margin: "0 0 8px 0", letterSpacing: "-0.5px" }}>
            {screen === "login" && "Sign in to DocGen"}
            {screen === "otp" && "Check your email"}
            {screen === "2fa" && "Two-Factor Authentication"}
            {screen === "success" && "Welcome back"}
          </h1>
          <p style={{ color: "#a1a1aa", fontSize: "14px", margin: 0 }}>
            {screen === "login" && (
              <>New to DocGen? Just enter your email below to automatically create an account.</>
            )}
            {screen === "otp" && `We sent a 6-digit code to ${email}`}
            {screen === "2fa" && "Enter the 6-digit code from your authenticator app."}
            {screen === "success" && "Redirecting you to the platform..."}
          </p>
        </div>

        {errorMessage && (
          <div style={{ marginBottom: "24px", padding: "12px", backgroundColor: "rgba(239, 68, 68, 0.1)", color: "#ef4444", borderRadius: "8px", fontSize: "13px", border: "1px solid rgba(239, 68, 68, 0.2)", textAlign: "center" }}>
            {errorMessage}
          </div>
        )}

        {/* SCREEN 1: LOGIN */}
        {screen === "login" && (
          <>
            <form onSubmit={handleSendOtp}>
              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", marginBottom: "8px", fontSize: "13px", fontWeight: "500", color: "#e4e4e7" }}>Enter your email</label>
                <div style={{ position: "relative" }}>
                  <svg style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#52525b" }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="4" width="20" height="16" rx="2"></rect>
                    <path d="Mm22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"></path>
                  </svg>
                  <input 
                    type="email" 
                    placeholder="name@email.com" 
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)} 
                    required 
                    style={{ ...inputStyle, paddingLeft: "36px" }} 
                    onFocus={(e) => e.target.style.borderColor = "#10b981"}
                    onBlur={(e) => e.target.style.borderColor = "#333"}
                  />
                </div>
              </div>

              <button 
                type="submit" 
                disabled={status === "loading" || !email} 
                style={{ ...buttonStyle, backgroundColor: email ? "#18181b" : "transparent", opacity: status === "loading" ? 0.7 : 1 }}
                onMouseOver={(e) => { if(email && status !== "loading") e.currentTarget.style.backgroundColor = "#27272a" }}
                onMouseOut={(e) => { if(email && status !== "loading") e.currentTarget.style.backgroundColor = "#18181b" }}
              >
                {status === "loading" ? "Sending..." : "Continue with email"}
              </button>
            </form>

            <div style={{ display: "flex", alignItems: "center", margin: "24px 0" }}>
              <div style={{ flex: 1, height: "1px", backgroundColor: "#27272a" }}></div>
              <span style={{ padding: "0 12px", color: "#52525b", fontSize: "12px", textTransform: "uppercase" }}>or</span>
              <div style={{ flex: 1, height: "1px", backgroundColor: "#27272a" }}></div>
            </div>

            <button 
              onClick={handleGitHubLogin} 
              style={{ ...buttonStyle, backgroundColor: "#18181b" }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#27272a"}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = "#18181b"}
            >
              <svg height="16" width="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path>
              </svg>
              Continue with GitHub
            </button>
          </>
        )}

        {/* SCREEN 2 & 3: OTP or 2FA ENTRY */}
        {(screen === "otp" || screen === "2fa") && (
          <form onSubmit={screen === "otp" ? handleVerifyOtp : handleVerify2FA}>
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
                  style={{ width: "45px", height: "55px", textAlign: "center", fontSize: "20px", fontWeight: "600", color: "#fff", border: "1px solid #333", borderRadius: "8px", backgroundColor: "#18181b", outline: "none", transition: "border-color 0.2s" }}
                  onFocus={(e) => e.target.style.borderColor = "#10b981"}
                  onBlur={(e) => e.target.style.borderColor = "#333"}
                />
              ))}
            </div>
            
            <button 
              type="submit" 
              disabled={status === "loading" || otp.join("").length !== 6} 
              style={{ ...buttonStyle, backgroundColor: "#fff", color: "#000", border: "none", opacity: (status === "loading" || otp.join("").length !== 6) ? 0.7 : 1 }}
            >
              {status === "loading" ? "Verifying..." : "Verify Code"}
            </button>

            <div style={{ display: "flex", justifyContent: "center", marginTop: "20px", fontSize: "13px" }}>
              <button type="button" onClick={() => setScreen("login")} style={{ background: "none", border: "none", color: "#a1a1aa", cursor: "pointer" }}>
                ← Back to login
              </button>
            </div>
          </form>
        )}

        {/* SCREEN 4: SUCCESS */}
        {screen === "success" && (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ width: "56px", height: "56px", backgroundColor: "rgba(16, 185, 129, 0.1)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto", color: "#10b981" }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ marginTop: "32px", textAlign: "center", fontSize: "12px", color: "#71717a" }}>
          By signing in, you agree to the <span style={{ textDecoration: "underline", cursor: "pointer" }}>Terms of Service</span> and <span style={{ textDecoration: "underline", cursor: "pointer" }}>Privacy Policy</span>.
        </div>

      </div>
    </div>
  );
}