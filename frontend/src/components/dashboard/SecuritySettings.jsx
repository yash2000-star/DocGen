import { useState, useEffect } from 'react';
import { supabase } from '../../lib/auth';
import TwoFactorSetup from './TwoFactorSetup'; 

export default function SecuritySettings() {
  const [twoFAStatus, setTwoFAStatus] = useState('loading');

  // Fetch the current status from Supabase
  async function fetch2FAStatus() {
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) {
      console.error("Error fetching MFA factors:", error);
      setTwoFAStatus('disabled');
      return;
    }
    
    // Check if there is an active TOTP factor
    const active = data?.totp?.find(f => f.status === 'verified');
    setTwoFAStatus(active ? 'enabled' : 'disabled');
  }

  useEffect(() => {
    fetch2FAStatus();
  }, []);

  // Handle turning off 2FA
  async function disable2FA() {
    const { data } = await supabase.auth.mfa.listFactors();
    const activeFactor = data?.totp?.find(f => f.status === 'verified');
    
    if (activeFactor) {
      await supabase.auth.mfa.unenroll({ factorId: activeFactor.id });
      setTwoFAStatus('disabled');
    }
  }

  return (
    <div style={{ maxWidth: '600px' }}>
      <div style={{ marginBottom: "24px" }}>
        <h2 style={{ fontSize: "18px", fontWeight: "600", color: "var(--text-heading)", margin: "0 0 4px 0" }}>Account Security</h2>
        <p style={{ fontSize: "14px", color: "var(--text-muted)", margin: 0 }}>Manage your authentication and 2FA settings.</p>
      </div>
      
      <div style={{ backgroundColor: 'var(--bg-main)', padding: '24px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
        <h3 style={{ marginTop: 0, fontSize: '16px', color: 'var(--text-heading)' }}>Two-Factor Authentication (2FA)</h3>
        
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '16px' }}>
          Status: <strong style={{ color: twoFAStatus === 'enabled' ? '#059669' : '#dc2626', marginLeft: '4px' }}>
            {twoFAStatus === 'loading' ? 'Checking...' : twoFAStatus.toUpperCase()}
          </strong>
        </p>

        {twoFAStatus === 'loading' && <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Loading security settings...</p>}
        
        {/* Show the Setup UI if disabled */}
        {twoFAStatus === 'disabled' && (
          <TwoFactorSetup onComplete={() => setTwoFAStatus('enabled')} />
        )}
        
        {/* Show the Disable button if already enabled */}
        {twoFAStatus === 'enabled' && (
          <button 
            onClick={disable2FA} 
            style={{ padding: '8px 16px', backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #f87171', borderRadius: '6px', cursor: 'pointer', fontWeight: 500 }}
          >
            Disable 2FA
          </button>
        )}
      </div>
    </div>
  );
}