import { useState } from 'react';
import { supabase } from '../../lib/auth';

export default function TwoFactorSetup({ onComplete }) {
  const [qrCode, setQrCode] = useState(null);
  const [factorId, setFactorId] = useState(null);
  const [code, setCode] = useState('');
  const [step, setStep] = useState('start'); // 'start' | 'scan' | 'done'
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function startSetup() {
    setLoading(true);
    setError('');
    
    // Enroll a new TOTP factor — generates the QR code
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: 'Prismify Authenticator',
    });

    if (error) { 
      console.error(error); 
      setError('Failed to start 2FA setup.');
      setLoading(false);
      return; 
    }

    setQrCode(data.totp.qr_code);
    setFactorId(data.id);
    setStep('scan');
    setLoading(false);
  }

  async function verifySetup() {
    setLoading(true);
    setError('');

    // Create a challenge to verify the code
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
    
    if (challengeError) {
      setError('Failed to create verification challenge.');
      setLoading(false);
      return;
    }

    // Verify the code the user typed in
    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code,
    });

    if (verifyError) {
      setError('Invalid 6-digit code. Please try again.');
      setLoading(false);
      return;
    }

    setStep('done');
    setLoading(false);
    if (onComplete) onComplete();
  }

  if (step === 'start') {
    return (
      <div style={{ border: '1px solid var(--border-color)', padding: '24px', borderRadius: '8px', backgroundColor: 'var(--bg-main)' }}>
        <h3 style={{ marginTop: 0, color: 'var(--text-heading)' }}>Two-Factor Authentication</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Add an extra layer of security to your Prismify account. This is recommended for all team admins.</p>
        <button 
          onClick={startSetup} 
          disabled={loading}
          style={{ padding: '8px 16px', backgroundColor: 'var(--primary-brand, #0fba81)', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 500 }}
        >
          {loading ? 'Starting...' : 'Enable 2FA'}
        </button>
      </div>
    );
  }

  if (step === 'scan') {
    return (
      <div style={{ border: '1px solid var(--border-color)', padding: '24px', borderRadius: '8px', backgroundColor: 'var(--bg-main)' }}>
        <h3 style={{ marginTop: 0, color: 'var(--text-heading)' }}>Scan this QR code</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Open Google Authenticator, Authy, or 1Password and scan this code.</p>
        
        {/* QR code is a data URI — render as an image */}
        <div style={{ padding: '16px', backgroundColor: 'white', display: 'inline-block', borderRadius: '8px', marginBottom: '16px' }}>
          <img src={qrCode} alt='2FA QR Code' style={{ width: 160, height: 160 }} />
        </div>
        
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: '0 0 8px 0' }}>Enter the 6-digit code from your app to confirm setup:</p>
        
        {error && <p style={{ color: '#dc2626', fontSize: '13px', margin: '0 0 8px 0' }}>{error}</p>}
        
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type='text'
            maxLength={6}
            value={code}
            onChange={e => setCode(e.target.value.replace(/[^0-9]/g, ''))} // Only allow numbers
            placeholder='000 000'
            style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', width: '120px', fontSize: '16px', letterSpacing: '2px', textAlign: 'center' }}
          />
          <button 
            onClick={verifySetup} 
            disabled={loading || code.length !== 6}
            style={{ padding: '8px 16px', backgroundColor: 'var(--primary-brand, #0fba81)', color: 'white', border: 'none', borderRadius: '6px', cursor: (loading || code.length !== 6) ? 'not-allowed' : 'pointer', fontWeight: 500, opacity: (loading || code.length !== 6) ? 0.7 : 1 }}
          >
            {loading ? 'Verifying...' : 'Verify & Enable'}
          </button>
        </div>
      </div>
    );
  }

  if (step === 'done') {
    return (
      <div style={{ border: '1px solid #10b981', padding: '24px', borderRadius: '8px', backgroundColor: '#ecfdf5' }}>
        <h3 style={{ marginTop: 0, color: '#065f46', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
          2FA Enabled Successfully
        </h3>
        <p style={{ color: '#047857', fontSize: '14px', margin: 0 }}>
          Your account is now protected. You will be asked for a code from your authenticator app every time you log in.
        </p>
      </div>
    );
  }

  return null;
}