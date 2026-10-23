import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

/**
 * ClassEnded — standalone full-page route shown at /ended.
 * Displayed when a session ends, either via navigation from Classroom
 * or by direct URL (e.g. after page refresh while on the ended state).
 */
export default function ClassEnded() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [countdown, setCountdown] = useState(10);

  const title = searchParams.get('title') || 'the webinar';
  const hostName = searchParams.get('host') || '';

  // Auto-redirect to home after 10 seconds
  useEffect(() => {
    if (countdown <= 0) {
      navigate('/', { replace: true });
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown, navigate]);

  return (
    <div className="class-ended-page">
      <div className="ended-card">
        {/* Icon */}
        <div className="ended-icon" aria-hidden="true">
          <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" width="72" height="72">
            <circle cx="32" cy="32" r="30" stroke="url(#grad)" strokeWidth="3" />
            <path d="M20 32l8 8 16-16" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            <defs>
              <linearGradient id="grad" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
                <stop stopColor="#2563eb" />
                <stop offset="1" stopColor="#7c3aed" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        <h1 className="ended-title">Session Ended</h1>
        <p className="ended-subtitle">
          {hostName
            ? <>Thank you for attending <strong>{title}</strong> hosted by <strong>{hostName}</strong>.</>
            : <>Thank you for attending <strong>{title}</strong>.</>}
        </p>
        <p className="ended-body">
          The session has concluded. We hope you found it valuable!
        </p>

        <div className="ended-actions">
          <button
            id="btn-back-home"
            className="btn-primary"
            onClick={() => navigate('/', { replace: true })}
          >
            Back to Home
          </button>
        </div>

        <p className="ended-countdown" aria-live="polite">
          Redirecting in <strong>{countdown}s</strong>…
        </p>
      </div>

      <style>{`
        .class-ended-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: radial-gradient(ellipse at 50% 0%, #1e1b4b 0%, #0f0c29 60%, #0a0a0f 100%);
          padding: 24px;
          font-family: 'Inter', 'Outfit', system-ui, sans-serif;
        }
        .ended-card {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          backdrop-filter: blur(20px);
          border-radius: 24px;
          padding: 56px 48px;
          max-width: 520px;
          width: 100%;
          text-align: center;
          box-shadow: 0 32px 80px rgba(0,0,0,0.5);
          animation: fadeUp 0.6s cubic-bezier(0.22, 1, 0.36, 1);
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(32px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .ended-icon {
          margin-bottom: 28px;
          display: flex;
          justify-content: center;
          filter: drop-shadow(0 0 24px rgba(124,58,237,0.4));
        }
        .ended-title {
          font-size: 2rem;
          font-weight: 700;
          color: #fff;
          margin: 0 0 12px;
          letter-spacing: -0.02em;
          background: linear-gradient(135deg, #fff 0%, #a5b4fc 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .ended-subtitle {
          font-size: 1.05rem;
          color: rgba(255,255,255,0.75);
          margin: 0 0 12px;
          line-height: 1.6;
        }
        .ended-body {
          font-size: 0.95rem;
          color: rgba(255,255,255,0.5);
          margin: 0 0 36px;
          line-height: 1.6;
        }
        .ended-actions {
          margin-bottom: 24px;
        }
        .btn-primary {
          background: linear-gradient(135deg, #2563eb, #7c3aed);
          color: #fff;
          border: none;
          border-radius: 12px;
          padding: 14px 36px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: opacity 0.2s, transform 0.15s;
        }
        .btn-primary:hover { opacity: 0.88; transform: translateY(-1px); }
        .btn-primary:active { transform: translateY(0); }
        .ended-countdown {
          font-size: 0.85rem;
          color: rgba(255,255,255,0.35);
        }
      `}</style>
    </div>
  );
}
