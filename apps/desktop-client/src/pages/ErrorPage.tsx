import { useNavigate, useSearchParams } from 'react-router-dom';

/**
 * ErrorPage — standalone full-page route shown at /error.
 * Used for session join failures, token expiry, and unexpected errors
 * that should survive page refresh / direct navigation.
 */
export default function ErrorPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const code = searchParams.get('code') || '';
  const message = searchParams.get('message') || 'An unexpected error occurred.';

  const friendlyMessages: Record<string, { title: string; body: string }> = {
    TOKEN_EXPIRED:    { title: 'Link Expired',      body: 'Your join link has expired. Please contact the host for a new invitation.' },
    SESSION_ENDED:    { title: 'Session Has Ended',  body: 'This webinar session has already concluded.' },
    SESSION_NOT_LIVE: { title: 'Not Live Yet',       body: 'This session is not currently live. Please check back at the scheduled time.' },
    NOT_REGISTERED:   { title: 'Not Registered',     body: 'You are not registered for this webinar. Please use the registration link.' },
    FORBIDDEN:        { title: 'Access Denied',      body: 'You do not have permission to join this session.' },
    NOT_FOUND:        { title: 'Not Found',          body: 'The webinar you\'re looking for could not be found.' },
  };

  const info = code && friendlyMessages[code]
    ? friendlyMessages[code]
    : { title: 'Something Went Wrong', body: message };

  return (
    <div className="error-page">
      <div className="error-card">
        {/* Error icon */}
        <div className="error-icon" aria-hidden="true">
          <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" width="72" height="72">
            <circle cx="32" cy="32" r="30" stroke="url(#errGrad)" strokeWidth="3" />
            <path d="M32 20v14" stroke="white" strokeWidth="3" strokeLinecap="round" />
            <circle cx="32" cy="43" r="2" fill="white" />
            <defs>
              <linearGradient id="errGrad" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
                <stop stopColor="#ef4444" />
                <stop offset="1" stopColor="#b91c1c" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        {code && (
          <p className="error-code" aria-label="Error code">{code}</p>
        )}
        <h1 className="error-title">{info.title}</h1>
        <p className="error-body">{info.body}</p>

        <div className="error-actions">
          <button
            id="btn-go-home"
            className="btn-primary"
            onClick={() => navigate('/', { replace: true })}
          >
            Go Home
          </button>
          <button
            id="btn-go-back"
            className="btn-secondary"
            onClick={() => navigate(-1)}
          >
            ← Go Back
          </button>
        </div>
      </div>

      <style>{`
        .error-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: radial-gradient(ellipse at 50% 0%, #2d0a0a 0%, #1a0808 50%, #0a0a0f 100%);
          padding: 24px;
          font-family: 'Inter', 'Outfit', system-ui, sans-serif;
        }
        .error-card {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(239,68,68,0.2);
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
        .error-icon {
          margin-bottom: 20px;
          display: flex;
          justify-content: center;
          filter: drop-shadow(0 0 24px rgba(239,68,68,0.4));
        }
        .error-code {
          font-size: 0.75rem;
          font-family: monospace;
          color: rgba(239,68,68,0.7);
          letter-spacing: 0.12em;
          text-transform: uppercase;
          margin: 0 0 8px;
        }
        .error-title {
          font-size: 1.9rem;
          font-weight: 700;
          color: #fff;
          margin: 0 0 16px;
          letter-spacing: -0.02em;
          background: linear-gradient(135deg, #fff 0%, #fca5a5 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .error-body {
          font-size: 0.95rem;
          color: rgba(255,255,255,0.6);
          margin: 0 0 36px;
          line-height: 1.65;
        }
        .error-actions {
          display: flex;
          gap: 12px;
          justify-content: center;
          flex-wrap: wrap;
        }
        .btn-primary {
          background: linear-gradient(135deg, #2563eb, #7c3aed);
          color: #fff;
          border: none;
          border-radius: 12px;
          padding: 13px 28px;
          font-size: 0.95rem;
          font-weight: 600;
          cursor: pointer;
          transition: opacity 0.2s, transform 0.15s;
        }
        .btn-primary:hover { opacity: 0.88; transform: translateY(-1px); }
        .btn-secondary {
          background: rgba(255,255,255,0.08);
          color: rgba(255,255,255,0.8);
          border: 1px solid rgba(255,255,255,0.15);
          border-radius: 12px;
          padding: 13px 28px;
          font-size: 0.95rem;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s, transform 0.15s;
        }
        .btn-secondary:hover { background: rgba(255,255,255,0.14); transform: translateY(-1px); }
      `}</style>
    </div>
  );
}
