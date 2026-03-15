'use client';

import React from 'react';
import { useSubscription } from '@/context/subscription/SubscriptionContext';
import { SubscriptionTier, PaymentMethod } from '@/lib/subscription/ppp';

export default function PricingPage() {
  const { prices, detectedRegion, paymentMethod, setPaymentMethod } = useSubscription();

  const tiers: { id: SubscriptionTier; name: string; description: string; features: string[] }[] = [
    { 
      id: 'PRO', 
      name: 'Pro', 
      description: 'The Fair Standard',
      features: ['24/7 Priority Support', 'Basic Knowledge Graph', '5 Private Vault Slots'] 
    },
    { 
      id: 'ULTRA', 
      name: 'Ultra', 
      description: 'The Intelligence Engine',
      features: ['AI Knowledge Expansion', 'Advanced Flow Automations', 'Zero-Knowledge DMs'] 
    },
    { 
      id: 'ENTERPRISE', 
      name: 'Enterprise', 
      description: 'The Absolute Tier',
      features: ['Unlimited Scale', 'Custom AI Models', 'Full Governance Control'] 
    },
  ];

  return (
    <div className="pricing-container" style={{ padding: '40px', maxWidth: '1200px', margin: '0 auto', fontFamily: 'Satoshi, sans-serif' }}>
      <header style={{ textAlign: 'center', marginBottom: '60px' }}>
        <h1 style={{ fontFamily: 'Clash Display', fontSize: '3rem', marginBottom: '10px' }}>Global Pricing</h1>
        <p style={{ opacity: 0.7 }}>Regional adjustments for {detectedRegion.name} ({detectedRegion.countryCode})</p>
        
        {/* Payment Method Toggle */}
        <div style={{ marginTop: '30px', display: 'flex', justifyContent: 'center', gap: '20px' }}>
          <button 
            onClick={() => setPaymentMethod('CRYPTO')}
            style={{
              padding: '10px 24px',
              borderRadius: '30px',
              border: '1px solid #ccc',
              cursor: 'pointer',
              background: paymentMethod === 'CRYPTO' ? '#fff' : 'transparent',
              color: paymentMethod === 'CRYPTO' ? '#000' : '#888',
              fontWeight: 600,
              transition: 'all 0.3s ease'
            }}
          >
            Crypto (The Fair Price)
          </button>
          <button 
            onClick={() => setPaymentMethod('CARD')}
            style={{
              padding: '10px 24px',
              borderRadius: '30px',
              border: '1px solid #ccc',
              cursor: 'pointer',
              background: paymentMethod === 'CARD' ? '#fff' : 'transparent',
              color: paymentMethod === 'CARD' ? '#000' : '#888',
              fontWeight: 600,
              transition: 'all 0.3s ease'
            }}
          >
            Legacy Card (Surcharge 1.25x)
          </button>
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '30px', marginBottom: '60px' }}>
        {tiers.map((tier) => (
          <div 
            key={tier.id} 
            className="tier-card" 
            style={{
              padding: '40px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '24px',
              background: 'rgba(255, 255, 255, 0.03)',
              backdropFilter: 'blur(10px)',
              display: 'flex',
              flexDirection: 'column',
              transition: 'transform 0.3s ease'
            }}
          >
            <h2 style={{ fontFamily: 'Clash Display', fontSize: '1.8rem', margin: '0 0 10px 0' }}>{tier.name}</h2>
            <p style={{ opacity: 0.6, fontSize: '0.9rem', marginBottom: '30px' }}>{tier.description}</p>
            
            <div style={{ marginBottom: '40px' }}>
              <span style={{ fontSize: '2.5rem', fontWeight: 800 }}>
                {detectedRegion.currencySymbol}{prices[tier.id].toFixed(2)}
              </span>
              <span style={{ opacity: 0.5, marginLeft: '5px' }}>/mo</span>
            </div>

            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 40px 0', flexGrow: 1 }}>
              {tier.features.map((feature, i) => (
                <li key={i} style={{ marginBottom: '15px', display: 'flex', alignItems: 'center', opacity: 0.8 }}>
                  <span style={{ marginRight: '10px', color: '#4CAF50' }}>✓</span>
                  {feature}
                </li>
              ))}
            </ul>

            <button style={{
              padding: '16px',
              borderRadius: '16px',
              border: 'none',
              background: tier.id === 'ULTRA' ? '#fff' : 'rgba(255, 255, 255, 0.1)',
              color: tier.id === 'ULTRA' ? '#000' : '#fff',
              fontWeight: 800,
              cursor: 'pointer',
              fontFamily: 'Satoshi'
            }}>
              Select {tier.name}
            </button>
          </div>
        ))}
      </div>

      {/* Free Tier Callout */}
      <div 
        style={{
          padding: '30px 40px',
          borderRadius: '24px',
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backdropFilter: 'blur(10px)',
          marginTop: '40px'
        }}
      >
        <div>
          <h3 style={{ fontFamily: 'Clash Display', fontSize: '1.4rem', margin: '0 0 5px 0' }}>Kylrix Free</h3>
          <p style={{ opacity: 0.6, margin: 0, fontSize: '0.9rem' }}>Basic access for individuals. No credit card required.</p>
        </div>
        <button 
          onClick={() => window.location.assign('/dashboard')}
          style={{
            padding: '12px 30px',
            borderRadius: '12px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            background: 'transparent',
            color: '#fff',
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            fontFamily: 'Satoshi'
          }}
          onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
          onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
        >
          Continue Free
        </button>
      </div>

      <style jsx>{`
        .tier-card:hover {
          transform: translateY(-10px);
          border-color: rgba(255, 255, 255, 0.2);
          background: rgba(255, 255, 255, 0.05);
        }
      `}</style>
    </div>
  );
}
