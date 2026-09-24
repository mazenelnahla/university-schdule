import { useState, type FormEvent, type FC } from 'react';
import { ShieldAlert, ShieldCheck, Lock, User, X } from 'lucide-react';
import { authenticateAdmin } from '../db/scheduleService';
import type { AdminUser } from '../db/schema';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: AdminUser) => void;
}

export const LoginModal: FC<LoginModalProps> = ({ isOpen, onClose, onLoginSuccess }) => {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const user = await authenticateAdmin(username, password);
      if (user) {
        onLoginSuccess(user);
        onClose();
      } else {
        setError('Invalid username or password. Default credentials: admin / admin123');
      }
    } catch (err) {
      setError('Authentication error: ' + (err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUseDemo = () => {
    setUsername('admin');
    setPassword('admin123');
    setError(null);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card login-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-wrap">
            <div className="modal-title-icon admin-badge-glow">
              <ShieldCheck size={22} />
            </div>
            <div>
              <h2 className="modal-title">Admin Authentication</h2>
              <p className="modal-subtitle">Log in to manage rooms, professors, and scheduling</p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          {error && (
            <div className="alert-banner alert-danger">
              <ShieldAlert size={18} />
              <span>{error}</span>
            </div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="username">
              Username
            </label>
            <div className="input-with-icon">
              <User size={16} className="input-icon" />
              <input
                id="username"
                type="text"
                className="form-input"
                placeholder="e.g. admin"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoFocus
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">
              Password
            </label>
            <div className="input-with-icon">
              <Lock size={16} className="input-icon" />
              <input
                id="password"
                type="password"
                className="form-input"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="demo-credentials-box">
            <div className="demo-credentials-info">
              <span className="demo-tag">Default Credentials</span>
              <span className="demo-text">Username: <strong>admin</strong> | Password: <strong>admin123</strong></span>
            </div>
            <button
              type="button"
              className="action-btn text-btn text-xs"
              onClick={handleUseDemo}
            >
              Fill Demo
            </button>
          </div>

          <div className="modal-footer">
            <button type="button" className="action-btn secondary-btn" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="action-btn primary-btn"
              disabled={isLoading}
            >
              {isLoading ? 'Verifying...' : 'Sign In as Admin'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
