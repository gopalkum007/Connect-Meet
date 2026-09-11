import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useTheme } from '../../context/ThemeContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import Navbar from '../../components/layout/Navbar.jsx';
import Footer from '../../components/layout/Footer.jsx';
import Card from '../../components/common/Card.jsx';
import Button from '../../components/common/Button.jsx';
import Switch from '../../components/common/Switch.jsx';
import { Globe, User, Shield, Video, Volume2, Moon, Sun, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import LanguageSelector, { LANGUAGES } from '../../components/LanguageSelector/LanguageSelector.jsx';
import TranslationToggle from '../../components/TranslationToggle/TranslationToggle.jsx';

const Settings = () => {
  const { user, preferredLanguage, updateLanguage, updateProfile } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('translation');
  const [selectedLanguage, setSelectedLanguage] = useState(preferredLanguage || 'en');
  
  // Profile edit state
  const [profileName, setProfileName] = useState(user?.name || '');
  const [profileEmail, setProfileEmail] = useState(user?.email || '');
  const [profileAvatar, setProfileAvatar] = useState(user?.avatar || '');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  React.useEffect(() => {
    if (user) {
      setProfileName(user.name || '');
      setProfileEmail(user.email || '');
      setProfileAvatar(user.avatar || '');
    }
  }, [user]);

  // Translation settings from localStorage
  const [autoTranslate, setAutoTranslate] = useState(() => {
    return localStorage.getItem('setting_auto_translate') !== 'false';
  });
  const [translationDisplayMode, setTranslationDisplayMode] = useState(() => {
    return localStorage.getItem('setting_translation_display') || 'both'; // 'both', 'translated', 'original'
  });

  // Mock settings for media devices
  const [camera, setCamera] = useState('default');
  const [mic, setMic] = useState('default');
  const [speaker, setSpeaker] = useState('default');

  const handleSaveLanguageSettings = async () => {
    try {
      await updateLanguage(selectedLanguage);
      localStorage.setItem('setting_auto_translate', autoTranslate);
      localStorage.setItem('setting_translation_display', translationDisplayMode);
      addToast('Preferences saved successfully', 'success');
    } catch (error) {
      addToast('Failed to save language settings', 'error');
    }
  };

  const handleSaveProfile = async (e) => {
    e?.preventDefault();
    if (!profileName.trim()) {
      addToast('Name cannot be empty', 'error');
      return;
    }

    setIsSavingProfile(true);
    try {
      await updateProfile({
        name: profileName.trim(),
        email: profileEmail.trim(),
        avatar: profileAvatar.trim()
      });
      addToast('Profile updated successfully!', 'success');
    } catch (error) {
      addToast('Failed to update profile', 'error');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const tabs = [
    { id: 'translation', name: 'Language & Translation', icon: <Globe size={18} /> },
    { id: 'account', name: 'User Profile', icon: <User size={18} /> },
    { id: 'devices', name: 'Audio & Video', icon: <Video size={18} /> },
    { id: 'theme', name: 'Theme Settings', icon: <Moon size={18} /> }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'var(--background)' }}>
      <Navbar />

      <main style={{ flex: 1, padding: '40px 24px', maxWidth: '1050px', margin: '0 auto', width: '100%' }}>
        {/* Page Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '36px' }} className="fade-in">
          <Button 
            variant="outline" 
            size="small" 
            onClick={() => navigate('/home')} 
            style={{ padding: '10px', borderRadius: '50%', width: '42px', height: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <ArrowLeft size={16} />
          </Button>
          <div>
            <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text)', margin: 0, letterSpacing: '-0.02em' }}>System Settings</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>Configure your calling profile, translation services, and hardware devices.</p>
          </div>
        </div>

        <style>{`
          .settings-workspace-grid {
            display: grid;
            grid-template-columns: repeat(12, 1fr);
            gap: 28px;
            align-items: start;
            width: 100%;
            max-width: 100%;
            min-width: 0;
          }
          .settings-sidebar {
            grid-column: span 4;
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: var(--radius-lg);
            padding: 16px 12px;
            box-shadow: var(--shadow);
            display: flex;
            flex-direction: column;
            gap: 8px;
            min-width: 0;
          }
          .settings-content {
            grid-column: span 8;
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: var(--radius-lg);
            padding: 32px;
            box-shadow: var(--shadow);
            min-width: 0;
            overflow: hidden;
          }
          @media (max-width: 820px) {
            .settings-workspace-grid {
              grid-template-columns: 1fr;
              gap: 16px;
            }
            .settings-sidebar {
              grid-column: span 1;
              flex-direction: row;
              overflow-x: auto;
              padding: 8px;
              gap: 6px;
              scrollbar-width: none;
            }
            .settings-sidebar::-webkit-scrollbar {
              display: none;
            }
            .settings-sidebar button {
              white-space: nowrap;
              padding: 10px 14px !important;
              flex: 1;
              justify-content: center;
            }
            .settings-content {
              grid-column: span 1;
              padding: clamp(16px, 4vw, 24px);
            }
          }
        `}</style>

        {/* Workspace Panels Grid */}
        <div className="settings-workspace-grid fade-in">
          
          {/* Tab Navigation Sidebar */}
          <div className="settings-sidebar">
            {tabs.map((tab) => {
              const isSelected = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '14px',
                    padding: '14px 20px',
                    width: '100%',
                    border: 'none',
                    borderRadius: 'var(--radius-md)',
                    background: isSelected ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
                    color: isSelected ? 'var(--primary)' : 'var(--text-muted)',
                    cursor: 'pointer',
                    fontWeight: isSelected ? 800 : 600,
                    textAlign: 'left',
                    transition: 'all 0.25s ease',
                    position: 'relative'
                  }}
                >
                  {/* Glowing active bar indicator */}
                  {isSelected && (
                    <span style={{
                      position: 'absolute',
                      left: 0,
                      top: '25%',
                      bottom: '25%',
                      width: '4px',
                      background: 'var(--primary)',
                      borderRadius: '0 4px 4px 0',
                      boxShadow: '0 0 10px rgba(99, 102, 241, 0.5)'
                    }}></span>
                  )}
                  <span style={{ color: isSelected ? 'var(--primary)' : 'var(--text-muted)' }}>{tab.icon}</span>
                  <span style={{ fontSize: '0.9rem' }}>{tab.name}</span>
                </button>
              );
            })}
          </div>

          {/* Settings Panels Content */}
          <div className="settings-content">
            {activeTab === 'translation' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }} className="scale-up">
                <div>
                  <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: '0 0 6px 0', color: 'var(--text)', letterSpacing: '-0.01em' }}>Language & Translation</h2>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>Configure your native language for real-time captions and translations.</p>
                </div>

                <LanguageSelector
                  value={selectedLanguage}
                  onChange={setSelectedLanguage}
                  label="Preferred Language"
                />

                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ flex: 1, paddingRight: '16px' }}>
                      <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text)', margin: 0 }}>Auto-Translate Incoming Chats</h4>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '4px', margin: 0, lineHeight: 1.4 }}>Automatically translate incoming chat feeds to your preferred language.</p>
                    </div>
                    <Switch checked={autoTranslate} onChange={setAutoTranslate} />
                  </div>

                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: '24px' }}>
                    <TranslationToggle
                      value={translationDisplayMode}
                      onChange={setTranslationDisplayMode}
                    />
                  </div>
                </div>

                <Button variant="primary" style={{ alignSelf: 'flex-start', marginTop: '12px', padding: '12px 28px', borderRadius: '30px', fontWeight: 700 }} onClick={handleSaveLanguageSettings}>
                  Save Preferences
                </Button>
              </div>
            )}

            {activeTab === 'account' && (
              <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '28px' }} className="scale-up">
                <div>
                  <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: '0 0 6px 0', color: 'var(--text)', letterSpacing: '-0.01em' }}>Edit Profile</h2>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>Manage your personal details, email address, and profile picture avatar.</p>
                </div>

                <div style={{
                  display: 'flex',
                  gap: '24px',
                  alignItems: 'center',
                  background: 'rgba(255, 255, 255, 0.02)',
                  padding: '24px',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--border)'
                }}>
                  <div style={{
                    width: '74px',
                    height: '74px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, var(--primary), var(--accent))',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.8rem',
                    fontWeight: 800,
                    boxShadow: 'var(--shadow-lg)',
                    overflow: 'hidden',
                    flexShrink: 0
                  }}>
                    {profileAvatar && profileAvatar.startsWith('http') ? (
                      <img src={profileAvatar} alt="Avatar Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      (profileName || user?.name || 'U').charAt(0).toUpperCase()
                    )}
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text)', margin: 0 }}>{profileName || user?.name || 'User'}</h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px', margin: 0 }}>@{user?.username || 'username'}</p>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', borderTop: '1px solid var(--border)', paddingTop: '24px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Full Name *</label>
                    <input
                      type="text"
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                      required
                      placeholder="Enter your full name"
                      style={{
                        padding: '12px 16px',
                        background: 'var(--background)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-md)',
                        color: 'var(--text)',
                        fontSize: '0.95rem',
                        outline: 'none'
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Email Address</label>
                    <input
                      type="email"
                      value={profileEmail}
                      onChange={(e) => setProfileEmail(e.target.value)}
                      placeholder="e.g. user@example.com"
                      style={{
                        padding: '12px 16px',
                        background: 'var(--background)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-md)',
                        color: 'var(--text)',
                        fontSize: '0.95rem',
                        outline: 'none'
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Profile Avatar / Picture URL</label>
                    <input
                      type="text"
                      value={profileAvatar}
                      onChange={(e) => setProfileAvatar(e.target.value)}
                      placeholder="https://example.com/avatar.jpg"
                      style={{
                        padding: '12px 16px',
                        background: 'var(--background)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-md)',
                        color: 'var(--text)',
                        fontSize: '0.95rem',
                        outline: 'none'
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 0', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 500 }}>Username (Read Only)</span>
                    <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text)' }}>@{user?.username || 'N/A'}</span>
                  </div>
                </div>

                <Button variant="primary" type="submit" disabled={isSavingProfile} style={{ alignSelf: 'flex-start', padding: '12px 28px', borderRadius: '30px', fontWeight: 700 }}>
                  {isSavingProfile ? 'Saving Changes...' : 'Save Profile Changes'}
                </Button>
              </form>
            )}

            {activeTab === 'devices' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }} className="scale-up">
                <div>
                  <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: '0 0 6px 0', color: 'var(--text)', letterSpacing: '-0.01em' }}>Audio & Video</h2>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>Set default inputs/outputs for meetings. You can also switch these dynamically in-call.</p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Video size={16} style={{ color: 'var(--primary)' }} /> Video Capture Source
                    </label>
                    <select
                      value={camera}
                      onChange={(e) => setCamera(e.target.value)}
                      style={{
                        padding: '14px',
                        borderRadius: 'var(--radius-md)',
                        background: 'var(--background)',
                        border: '1px solid var(--border)',
                        color: 'var(--text)',
                        fontSize: '0.9rem',
                        outline: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      <option value="default">Default FaceTime HD Camera</option>
                      <option value="obs">OBS Virtual Camera Source</option>
                    </select>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Volume2 size={16} style={{ color: 'var(--primary)' }} /> Audio Input Capture
                    </label>
                    <select
                      value={mic}
                      onChange={(e) => setMic(e.target.value)}
                      style={{
                        padding: '14px',
                        borderRadius: 'var(--radius-md)',
                        background: 'var(--background)',
                        border: '1px solid var(--border)',
                        color: 'var(--text)',
                        fontSize: '0.9rem',
                        outline: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      <option value="default">Default Internal Microphone</option>
                      <option value="external">External Sound Card Mixer</option>
                    </select>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Volume2 size={16} style={{ color: 'var(--accent)' }} /> Audio Output Playback
                    </label>
                    <select
                      value={speaker}
                      onChange={(e) => setSpeaker(e.target.value)}
                      style={{
                        padding: '14px',
                        borderRadius: 'var(--radius-md)',
                        background: 'var(--background)',
                        border: '1px solid var(--border)',
                        color: 'var(--text)',
                        fontSize: '0.9rem',
                        outline: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      <option value="default">Default System Speakers / Headphones</option>
                    </select>
                  </div>
                </div>

                <Button variant="primary" style={{ alignSelf: 'flex-start', padding: '12px 28px', borderRadius: '30px', fontWeight: 700 }} onClick={() => addToast('Device preferences saved', 'success')}>
                  Save Hardware Configuration
                </Button>
              </div>
            )}

            {activeTab === 'theme' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }} className="scale-up">
                <div>
                  <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: '0 0 6px 0', color: 'var(--text)', letterSpacing: '-0.01em' }}>Theme Settings</h2>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>Switch visual modes between clean white workspace or premium deep slate dark mode.</p>
                </div>

                <div style={{ display: 'flex', gap: '20px' }}>
                  <button
                    onClick={() => !isDark && toggleTheme()}
                    style={{
                      flex: 1,
                      padding: '32px 24px',
                      borderRadius: 'var(--radius-lg)',
                      border: `2px solid ${isDark ? 'var(--primary)' : 'var(--border)'}`,
                      background: isDark ? 'rgba(99, 102, 241, 0.05)' : 'transparent',
                      color: 'var(--text)',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '16px',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                    }}
                  >
                    <div style={{
                      width: '56px',
                      height: '56px',
                      borderRadius: '50%',
                      background: 'rgba(99, 102, 241, 0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <Moon size={28} color="var(--primary)" />
                    </div>
                    <span style={{ fontWeight: 700, fontSize: '1rem' }}>Premium Dark Mode</span>
                  </button>

                  <button
                    onClick={() => isDark && toggleTheme()}
                    style={{
                      flex: 1,
                      padding: '32px 24px',
                      borderRadius: 'var(--radius-lg)',
                      border: `2px solid ${!isDark ? 'var(--primary)' : 'var(--border)'}`,
                      background: !isDark ? 'rgba(99, 102, 241, 0.05)' : 'transparent',
                      color: 'var(--text)',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '16px',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                    }}
                  >
                    <div style={{
                      width: '56px',
                      height: '56px',
                      borderRadius: '50%',
                      background: 'rgba(245, 158, 11, 0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <Sun size={28} color="var(--secondary)" />
                    </div>
                    <span style={{ fontWeight: 700, fontSize: '1rem' }}>Clean Light Mode</span>
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Settings;
