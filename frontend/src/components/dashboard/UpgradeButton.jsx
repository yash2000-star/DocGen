import { useState } from 'react';
import { supabase } from '../../lib/auth'; // Ensure this path is correct
import { apiFetch } from '../../lib/api'; // Ensure this path is correct

export default function UpgradeButton() {
  const [loading, setLoading] = useState(false);

  async function handleUpgrade() {
    setLoading(true);
    try {
      // 1. Get current user session for email/name
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;

      // 2. Call your brand new backend route
      const res = await apiFetch(`/api/billing/create-subscription`, {
        method: 'POST',
      });
      const { subscriptionId, keyId } = await res.json();

      // 3. Open Razorpay checkout popup
      const options = {
        key: keyId,
        subscription_id: subscriptionId,
        name: 'DocGen',
        description: 'Pro Plan — ₹999/month',
        prefill: {
          name: user?.user_metadata?.full_name || '',
          email: user?.email || '',
        },
        theme: {
          color: '#10b981', 
        },
        handler: function(response) {
          alert("Payment Successful! Welcome to Pro.");
          window.location.reload(); 
        },
        modal: {
          ondismiss: function() {
            setLoading(false);
          }
        }
      };

      const razorpayInstance = new window.Razorpay(options);
      razorpayInstance.open();

    } catch (error) {
      console.error(error);
      alert('Could not start checkout. Please try again.');
      setLoading(false);
    }
  }

  return (
    <button 
      onClick={handleUpgrade} 
      disabled={loading}
      style={{ padding: '10px 20px', backgroundColor: '#10b981', color: 'white', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
    >
      {loading ? 'Starting...' : 'Upgrade to Pro - ₹999'}
    </button>
  );
}