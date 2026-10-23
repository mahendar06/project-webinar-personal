import { Video, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Landing() {
  return (
    <div className="flex-col flex-center" style={{ height: '100vh' }}>
      <div className="glass-panel flex-col flex-center fade-in" style={{ maxWidth: '420px', textAlign: 'center' }}>
        <div style={{ background: 'rgba(99, 102, 241, 0.2)', padding: '16px', borderRadius: '50%', marginBottom: '24px' }}>
          <Video size={48} color="var(--primary-color)" />
        </div>
        <h2>Welcome to Webinar</h2>
        <p className="text-muted mt-4">
          To join a session as an attendee, please use the invite link provided by your host.
        </p>

        <div style={{ width: '100%', marginTop: '24px', paddingTop: '20px', borderTop: '1px solid var(--border-color)' }}>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '12px' }}>
            Are you hosting a session?
          </p>
          <Link
            to="/login"
            className="btn btn-primary"
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              textDecoration: 'none',
              padding: '12px 20px',
            }}
          >
            <span>Host / Organizer Sign In</span>
            <ArrowRight size={18} />
          </Link>
        </div>
      </div>
    </div>
  );
}
