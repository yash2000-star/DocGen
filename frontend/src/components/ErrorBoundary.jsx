import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  // This lifecycle method catches the error before it crashes the app
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // You could send this to an error tracking service like Sentry later
    console.error("MDX Preview Error Caught:", error);
  }

  render() {
    if (this.state.hasError) {
      // Render a beautiful, SaaS-style error message instead of crashing
      return (
        <div style={{ 
          padding: '20px', 
          color: '#dc2626', 
          backgroundColor: '#fef2f2', 
          border: '1px solid #fecaca', 
          borderRadius: '8px', 
          fontSize: '14px',
          fontFamily: 'system-ui, sans-serif'
        }}>
          <strong style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', fontSize: '15px' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
              <line x1="12" y1="9" x2="12" y2="13"></line>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
            MDX Component Error
          </strong>
          <p style={{ margin: 0, opacity: 0.9 }}>
            It looks like there's a typo or an unclosed tag in your MDX. Check your syntax.
          </p>
          <div style={{ 
            marginTop: '12px', 
            padding: '10px', 
            backgroundColor: '#ffffff', 
            borderRadius: '4px', 
            fontFamily: 'monospace',
            fontSize: '12px',
            color: '#7f1d1d',
            overflowX: 'auto'
          }}>
            {this.state.error?.message || "Unknown rendering error."}
          </div>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{ 
              marginTop: '16px', padding: '8px 16px', backgroundColor: '#dc2626', 
              color: '#ffffff', border: 'none', borderRadius: '6px', 
              fontWeight: '500', cursor: 'pointer' 
            }}
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}