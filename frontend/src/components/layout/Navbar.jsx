import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useTheme } from '../../context/ThemeContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import Modal from '../common/Modal.jsx';
import Button from '../common/Button.jsx';
import Input from '../common/Input.jsx';
import {
  Video, Sun, Moon, Menu, X, LogOut, ChevronDown,
  Link as LinkIcon, PlusCircle, HelpCircle, ArrowRight, ShieldCheck, Mail
} from 'lucide-react';
import { extractRoomCode } from '../../utils/urlHelper.js';

const Navbar = ({ onOpenNewMeeting }) => {
  const { token, user, logout, addToUserHistory, createNewMeeting } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const isFrontPage = location.pathname === '/';


  const [isOpen, setIsOpen] = useState(false);
  const [isMeetDropdownOpen, setIsMeetDropdownOpen] = useState(false);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);
  const [meetingCode, setMeetingCode] = useState('');

  const dropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsMeetDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleJoinMeeting = async () => {
    const cleanCode = extractRoomCode(meetingCode);
    if (!cleanCode) {
      addToast('Please enter a valid meeting ID, code, or link', 'error');
      return;
    }
    if (token) {
      try {
        await addToUserHistory(cleanCode);
      } catch (err) {
        // ignore history error for guests
      }
    }
    setIsJoinModalOpen(false);
    setMeetingCode('');
    setIsMeetDropdownOpen(false);
    setIsOpen(false);
    addToast('Joining meeting...', 'success');
    navigate(`/${cleanCode}`);
  };

  const handleHostMeeting = async (e) => {
    if (e) e.preventDefault();
    setIsMeetDropdownOpen(false);
    setIsOpen(false);

    if (onOpenNewMeeting) {
      onOpenNewMeeting();
      return;
    }

    const chars = 'abcdefghijklmnopqrstuvwxyz';
    const randPart = (len) => Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    const code = `${randPart(3)}-${randPart(4)}-${randPart(3)}`;

    if (token) {
      try {
        await createNewMeeting({ meetingCode: code, title: "Instant Meeting", status: "Live" });
      } catch (err) {
        console.warn("Could not record meeting in database:", err);
      }
    }

    addToast('Creating meeting room...', 'success');
    navigate(`/${code}`);
  };

  return (
    <nav style={{
      position: 'sticky',
      top: 0,
      zIndex: 900,
      background: 'var(--surface)',
      borderBottom: '1px solid var(--border)',
      padding: '14px 24px',
      backdropFilter: 'blur(10px)',
      backgroundOpacity: 0.85
    }}>
      <style>{`
        .nav-wrapper {
          display: flex;
          align-items: center;
          justify-content: space-between;
          max-width: 1200px;
          margin: 0 auto;
          width: 100%;
        }
        .desktop-menu {
          display: flex;
          align-items: center;
          gap: 24px;
        }
        .nav-dropdown-wrapper {
          position: relative;
        }
        .nav-dropdown-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          background: none;
          border: none;
          color: var(--text);
          font-size: 0.95rem;
          font-weight: 600;
          cursor: pointer;
          padding: 8px 12px;
          border-radius: var(--radius-md);
          transition: background 0.2s, color 0.2s;
        }
        .nav-dropdown-btn:hover {
          background: var(--surface-hover);
          color: var(--primary);
        }
        .dropdown-menu-box {
          position: absolute;
          top: calc(100% + 8px);
          left: 0;
          width: 310px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-lg);
          padding: 10px;
          display: flex;
          flex-direction: column;
          gap: 6px;
          z-index: 1000;
        }
        .dropdown-item-btn {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 12px;
          border: none;
          background: transparent;
          border-radius: var(--radius-md);
          cursor: pointer;
          text-align: left;
          width: 100%;
          transition: background 0.2s;
        }
        .dropdown-item-btn:hover {
          background: var(--surface-hover);
        }
        .nav-link-item {
          background: none;
          border: none;
          color: var(--text-muted);
          font-size: 0.95rem;
          font-weight: 500;
          cursor: pointer;
          transition: color 0.2s;
          padding: 6px 12px;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .nav-link-item:hover {
          color: var(--primary);
        }
        .mobile-toggle-btn {
          display: none;
          background: none;
          border: 1px solid var(--border);
          padding: 8px;
          border-radius: var(--radius-md);
          color: var(--text);
          cursor: pointer;
        }
        .mobile-dropdown {
          display: flex;
          flex-direction: column;
          gap: 16px;
          padding: 20px 8px 12px;
          border-top: 1px solid var(--border);
          margin-top: 16px;
        }
        @media (max-width: 768px) {
          .desktop-menu {
            display: none !important;
          }
          .mobile-toggle-btn {
            display: flex !important;
            align-items: center;
            justify-content: center;
          }
          .desktop-actions {
            display: none !important;
          }
        }
      `}</style>

      <div className="nav-wrapper">
        {/* Brand logo */}
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
          <img src="/logo.png" alt="Connect Meet Logo" style={{ height: '38px', objectFit: 'contain' }} />
          <span style={{ fontWeight: 800, fontSize: '1.35rem', color: 'var(--text)', letterSpacing: '-0.02em' }}>Connect Meet</span>
        </Link>


        {/* Nav Links - Desktop */}
        <div className="desktop-menu">
          <Link to="/" style={{ color: 'var(--text)', fontSize: '0.92rem', fontWeight: 600, textDecoration: 'none' }}>Home</Link>
          {!token && isFrontPage && (
            <>
              <a href="#features" style={{ color: 'var(--text-muted)', fontSize: '0.92rem', fontWeight: 500, textDecoration: 'none' }}>Features</a>
              <a href="#solutions" style={{ color: 'var(--text-muted)', fontSize: '0.92rem', fontWeight: 500, textDecoration: 'none' }}>Solutions</a>
            </>
          )}
          <a href="#support" onClick={(e) => { e.preventDefault(); setIsSupportModalOpen(true); }} style={{ color: 'var(--text-muted)', fontSize: '0.92rem', fontWeight: 500, textDecoration: 'none', cursor: 'pointer' }}>Support</a>



          {/* Meet Dropdown Button */}
          <div className="nav-dropdown-wrapper" ref={dropdownRef}>
            <button type="button"
              onClick={(e) => { e.stopPropagation(); setIsMeetDropdownOpen(prev => !prev); }}
              className="nav-dropdown-btn"
            >
              <Video size={17} color="var(--primary)" />
              <span>Meet</span>
              <ChevronDown size={14} style={{ transform: isMeetDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
            </button>

            {isMeetDropdownOpen && (
              <div className="dropdown-menu-box scale-up">
                {/* Option 1: Join Meeting */}
                <button type="button"
                  onClick={() => {
                    setIsMeetDropdownOpen(false);
                    setIsJoinModalOpen(true);
                  }}
                  className="dropdown-item-btn"
                >
                  <div style={{
                    background: 'rgba(14, 113, 235, 0.1)',
                    color: 'var(--primary)',
                    padding: '8px',
                    borderRadius: '8px',
                    display: 'flex'
                  }}>
                    <LinkIcon size={18} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text)' }}>Join Meeting</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px', lineHeight: 1.3 }}>
                      Join using Meeting ID (No signup required)
                    </div>
                  </div>
                </button>

                {/* Option 2: Host Meeting */}
                <button type="button"
                  onClick={handleHostMeeting}
                  className="dropdown-item-btn"
                >
                  <div style={{
                    background: 'rgba(16, 185, 129, 0.1)',
                    color: 'var(--secondary)',
                    padding: '8px',
                    borderRadius: '8px',
                    display: 'flex'
                  }}>
                    <PlusCircle size={18} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text)' }}>Host Meeting</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px', lineHeight: 1.3 }}>
                      Create room (Signup required first)
                    </div>
                  </div>
                </button>
              </div>
            )}
          </div>

          {token && <Link to="/home" style={{ color: 'var(--primary)', fontSize: '0.92rem', fontWeight: 600 }}>Dashboard</Link>}
        </div>

        {/* Action Buttons & Theme Toggles */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button type="button"
            onClick={toggleTheme}
            style={{
              background: 'none',
              border: '1px solid var(--border)',
              padding: '8px',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              color: 'var(--text)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title="Toggle theme"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          <div className="desktop-actions" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {token ? (
              <>
                <Button variant="outline" onClick={() => navigate('/home')}>Dashboard</Button>
                <div
                  onClick={() => navigate('/settings')}
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, var(--primary), var(--accent))',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    boxShadow: 'var(--shadow)'
                  }}
                  title={user?.name || 'User Profile'}
                >
                  {user?.avatar && user.avatar.startsWith('http') ? (
                    <img src={user.avatar} alt="Avatar" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                  ) : (
                    user?.name?.charAt(0).toUpperCase() || 'U'
                  )}
                </div>
                <Button variant="danger" onClick={logout} iconLeft={<LogOut size={16} />}>Logout</Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => navigate('/auth')}>Login</Button>
                <Button variant="primary" onClick={() => navigate('/auth')}>Get Started Free</Button>
              </>
            )}
          </div>


          {/* Mobile Hamburger Toggle Button */}
          <button type="button"
            className="mobile-toggle-btn"
            onClick={(e) => { e.stopPropagation(); setIsOpen(prev => !prev); }}
            aria-label="Toggle Navigation Menu"
          >
            {isOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Dropdown Menu */}
      {isOpen && (
        <div className="mobile-dropdown fade-in">
          <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
            Meet & Support
          </div>

          <button type="button"
            onClick={() => { setIsOpen(false); setIsJoinModalOpen(true); }}
            style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', textAlign: 'left', cursor: 'pointer', color: 'var(--text)' }}
          >
            <LinkIcon size={18} color="var(--primary)" />
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Join Meeting</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Using Meeting ID (No signup required)</div>
            </div>
          </button>

          <button type="button"
            onClick={handleHostMeeting}
            style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', textAlign: 'left', cursor: 'pointer', color: 'var(--text)' }}
          >
            <PlusCircle size={18} color="var(--secondary)" />
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Host Meeting</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Create a room (Signup required first)</div>
            </div>
          </button>

          <button type="button"
            onClick={() => { setIsOpen(false); setIsSupportModalOpen(true); }}
            style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', textAlign: 'left', cursor: 'pointer', color: 'var(--text)' }}
          >
            <HelpCircle size={18} color="var(--primary)" />
            <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Support & Help</div>
          </button>

          {token ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px' }}>
              <Button variant="outline" onClick={() => { setIsOpen(false); navigate('/home'); }}>Dashboard</Button>
              <Button variant="outline" onClick={() => { setIsOpen(false); navigate('/settings'); }}>Settings</Button>
              <Button variant="danger" onClick={() => { setIsOpen(false); logout(); }} iconLeft={<LogOut size={16} />}>Logout</Button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px' }}>
              <Button variant="outline" onClick={() => { setIsOpen(false); navigate('/auth'); }}>Login</Button>
              <Button variant="primary" onClick={() => { setIsOpen(false); navigate('/auth'); }}>Get Started</Button>
            </div>
          )}
        </div>
      )}

      {/* Modal: Join Meeting without Signup */}
      <Modal
        isOpen={isJoinModalOpen}
        onClose={() => setIsJoinModalOpen(false)}
        title="Join Meeting (No Signup Required)"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: 1.5, margin: 0 }}>
            Enter a shared meeting code below to jump directly into an active call room as a guest.
          </p>

          <Input
            placeholder="e.g. abc-defg-hij"
            value={meetingCode}
            onChange={(e) => setMeetingCode(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleJoinMeeting()}
            iconLeft={<LinkIcon size={18} color="var(--primary)" />}
            autoFocus
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
            <Button variant="outline" onClick={() => setIsJoinModalOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleJoinMeeting} iconRight={<ArrowRight size={16} />}>Join Now</Button>
          </div>
        </div>
      </Modal>

      {/* Modal: Support & Help */}
      <Modal
        isOpen={isSupportModalOpen}
        onClose={() => setIsSupportModalOpen(false)}
        title="Connect Meet Support"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '16px', background: 'rgba(14, 113, 235, 0.08)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(14, 113, 235, 0.2)' }}>
            <ShieldCheck size={32} color="var(--primary)" />
            <div>
              <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)', margin: 0 }}>Need Assistance?</h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px', margin: 0 }}>
                We are available 24/7 to help you with meeting access, real-time translation setup, and WebRTC streaming issues.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ padding: '12px 16px', background: 'var(--background)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
              <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text)' }}>How do I host a meeting?</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Click on the <strong>Meet</strong> dropdown in the top bar and select <strong>Host Meeting</strong>. You will be prompted to sign up or log in first.
              </div>
            </div>

            <div style={{ padding: '12px 16px', background: 'var(--background)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
              <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text)' }}>Do guests need an account to join?</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                No! Anyone with a meeting code can click <strong>Join Meeting</strong> in the Meet dropdown and join immediately without signing up.
              </div>
            </div>

            <div style={{ padding: '12px 16px', background: 'var(--background)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
              <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text)' }}>Contact Support Team</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--primary)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Mail size={16} /> support@connectmeet.io
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
            <Button variant="primary" onClick={() => setIsSupportModalOpen(false)}>Close</Button>
          </div>
        </div>
      </Modal>
    </nav>
  );
};

export default Navbar;
