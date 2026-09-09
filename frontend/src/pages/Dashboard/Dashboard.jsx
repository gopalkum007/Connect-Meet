import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import Navbar from '../../components/layout/Navbar.jsx';
import Footer from '../../components/layout/Footer.jsx';
import Card from '../../components/common/Card.jsx';
import Button from '../../components/common/Button.jsx';
import Modal from '../../components/common/Modal.jsx';
import Input from '../../components/common/Input.jsx';
import withAuth from '../../utils/withAuth.jsx';
import RecordingsModal from '../../components/Recordings/RecordingsModal.jsx';
import { extractRoomCode } from '../../utils/urlHelper.js';
import {
  Video, Plus, Link as LinkIcon, History as HistoryIcon, Clock, Users, ArrowRight,
  Home, Calendar as CalendarIcon, Shield, Settings, Menu, ChevronLeft, ChevronRight,
  TrendingUp, Monitor, HardDrive, Sparkles, Copy, Play, CalendarCheck, FileText, CheckCircle
} from 'lucide-react';

const Dashboard = () => {
  const { user, addToUserHistory, getHistoryOfUser, createNewMeeting } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [meetingCode, setMeetingCode] = useState('');
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // New Meeting & Scheduling Modals state
  const [isNewMeetingModalOpen, setIsNewMeetingModalOpen] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState(false);
  const [isRecordingsModalOpen, setIsRecordingsModalOpen] = useState(false);
  const [selectedMeetingDetails, setSelectedMeetingDetails] = useState(null);

  // Schedule form state
  const [scheduleTitle, setScheduleTitle] = useState('');
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [scheduleDuration, setScheduleDuration] = useState('30');
  const [scheduleDescription, setScheduleDescription] = useState('');
  const [scheduleChatPermission, setScheduleChatPermission] = useState('Everyone');
  const [isSubmittingSchedule, setIsSubmittingSchedule] = useState(false);

  const fetchHistory = async () => {
    try {
      const data = await getHistoryOfUser();
      if (Array.isArray(data)) {
        setHistory(data);
      } else {
        setHistory([]);
      }
    } catch (err) {
      console.log('Fetch history error:', err);
      setHistory([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleJoinCall = async () => {
    const cleanCode = extractRoomCode(meetingCode);
    if (!cleanCode) {
      addToast('Please enter a valid meeting code or link', 'error');
      return;
    }
    try {
      await addToUserHistory(cleanCode);
      addToast('Joining meeting...', 'success');
      navigate(`/${cleanCode}`);
    } catch (err) {
      addToast('Failed to join meeting', 'error');
    }
  };

  const generateMeetingCode = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyz';
    const randPart = (len) => Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    return `${randPart(3)}-${randPart(4)}-${randPart(3)}`;
  };

  const handleStartNow = async (e) => {
    if (e) e.preventDefault();
    setIsNewMeetingModalOpen(false);
    const code = generateMeetingCode();
    try {
      await createNewMeeting({
        meetingCode: code,
        title: "Instant Meeting",
        status: "Live",
        chatPermission: scheduleChatPermission
      });
    } catch (err) {
      console.warn("Could not record meeting in database, starting room anyway:", err);
    }
    addToast('Creating meeting room...', 'success');
    navigate(`/${code}`);
  };

  const handleCreateScheduleMeeting = async (e) => {
    e?.preventDefault();
    if (!scheduleTitle.trim()) {
      addToast('Please enter a meeting title', 'error');
      return;
    }
    if (!scheduleDate || !scheduleTime) {
      addToast('Please select a date and start time', 'error');
      return;
    }

    setIsSubmittingSchedule(true);
    const code = generateMeetingCode();
    const startDateTime = new Date(`${scheduleDate}T${scheduleTime}`);
    const endDateTime = new Date(startDateTime.getTime() + (parseInt(scheduleDuration, 10) || 30) * 60000);

    try {
      await createNewMeeting({
        meetingCode: code,
        title: scheduleTitle,
        description: scheduleDescription,
        scheduledStartTime: startDateTime,
        scheduledEndTime: endDateTime,
        status: "Scheduled",
        chatPermission: scheduleChatPermission
      });
      addToast('Meeting scheduled successfully!', 'success');
      setIsScheduleModalOpen(false);
      setScheduleTitle('');
      setScheduleDate('');
      setScheduleTime('');
      setScheduleDescription('');
      fetchHistory();
    } catch (err) {
      addToast('Failed to schedule meeting', 'error');
    } finally {
      setIsSubmittingSchedule(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const formatLongDate = (date) => {
    return date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  };

  const getGreeting = () => {
    const hrs = currentTime.getHours();
    if (hrs < 12) return 'Good morning';
    if (hrs < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const computeMeetingStatus = (item) => {
    if (item.status === 'Ended') return 'Ended';
    if (item.status === 'Scheduled') {
      if (item.scheduledEndTime && new Date(item.scheduledEndTime) < new Date()) {
        return 'Ended';
      }
      if (item.scheduledStartTime && new Date(item.scheduledStartTime) > new Date()) {
        return 'Scheduled';
      }
      if (item.scheduledStartTime && item.scheduledEndTime && new Date(item.scheduledStartTime) <= new Date() && new Date(item.scheduledEndTime) >= new Date()) {
        return 'Live';
      }
      return 'Scheduled';
    }
    const meetingTime = new Date(item.date || item.createdAt || item.updatedAt).getTime();
    if (Date.now() - meetingTime > 2 * 60 * 60 * 1000) {
      return 'Ended';
    }
    return 'Live';
  };

  const getStatusStyle = (status) => {
    switch (status) {
      case 'Scheduled':
        return {
          background: 'rgba(245, 158, 11, 0.15)',
          color: '#F59E0B',
          label: 'Scheduled'
        };
      case 'Live':
        return {
          background: 'rgba(16, 185, 129, 0.15)',
          color: '#10B981',
          label: 'Live'
        };
      case 'Ended':
      default:
        return {
          background: 'rgba(239, 68, 68, 0.15)',
          color: '#EF4444',
          label: 'Ended'
        };
    }
  };


  const menuItems = [
    { name: 'Home', icon: <Home size={20} />, active: true, path: '/home' },
    { name: 'Meetings', icon: <Video size={20} />, active: false, action: () => setIsNewMeetingModalOpen(true) },
    { name: 'History Logs', icon: <HistoryIcon size={20} />, active: false, path: '/history' },

    { name: 'Recordings', icon: <HardDrive size={20} />, active: false, action: () => setIsRecordingsModalOpen(true) },
    { name: 'Settings', icon: <Settings size={20} />, active: false, path: '/settings' },
  ];


  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--background)', color: 'var(--text)' }}>
      {/* Sidebar CSS and Layout */}
      <style>{`
        .dashboard-layout {
          display: flex;
          flex: 1;
          width: 100%;
          overflow: hidden;
        }
        .sidebar {
          display: none;
          flex-direction: column;
          background: var(--surface);
          border-right: 1px solid var(--border);
          transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          padding: 24px 16px;
          z-index: 100;
          flex-shrink: 0;
        }
        .sidebar-btn {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          color: var(--text-muted);
          background: transparent;
          border: none;
          border-radius: var(--radius-md);
          cursor: pointer;
          font-weight: 600;
          font-size: 0.95rem;
          transition: all 0.2s;
          text-align: left;
          width: 100%;
          text-decoration: none;
        }
        .sidebar-btn:hover {
          color: var(--text);
          background: var(--surface-hover);
        }
        .sidebar-btn.active {
          color: #ffffff;
          background: var(--primary);
        }
        .main-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow-y: auto;
          position: relative;
        }
        .mobile-nav {
          display: flex;
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          background: var(--surface);
          border-top: 1px solid var(--border);
          padding: 8px 16px;
          justify-content: space-around;
          align-items: center;
          z-index: 900;
        }
        .mobile-nav-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          color: var(--text-muted);
          background: none;
          border: none;
          font-size: 0.75rem;
          font-weight: 500;
          cursor: pointer;
        }
        .mobile-nav-btn.active {
          color: var(--primary);
        }
        @media (min-width: 768px) {
          .sidebar {
            display: flex;
          }
          .mobile-nav {
            display: none;
          }
        }
        .dashboard-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 24px;
        }
        @media (min-width: 1024px) {
          .dashboard-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div className="dashboard-layout">
        {/* Collapsible Sidebar */}
        <aside className="sidebar" style={{ width: sidebarCollapsed ? '78px' : '260px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: sidebarCollapsed ? 'center' : 'space-between', marginBottom: '32px', padding: '0 8px' }}>
            {!sidebarCollapsed ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <img src="/logo.png" alt="Connect Meet Logo" style={{ height: '32px', objectFit: 'contain' }} />
                <span style={{ fontWeight: 800, fontSize: '1.2rem', color: 'var(--text)' }}>Connect Meet</span>
              </div>
            ) : (
              <img src="/logo.png" alt="Connect Meet Logo" style={{ height: '28px', objectFit: 'contain' }} />
            )}

            <button type="button"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '6px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              onMouseEnter={(e) => e.target.style.background = 'var(--surface-hover)'}
              onMouseLeave={(e) => e.target.style.background = 'none'}
            >
              {sidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            </button>
          </div>

          <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
            {menuItems.map((item, index) => {
              const handleAction = () => {
                if (item.action) item.action();
                else if (item.callback) item.callback();
                else if (item.path) navigate(item.path);
              };

              return (
                <button type="button"
                  key={index}
                  onClick={handleAction}
                  className={`sidebar-btn ${item.active ? 'active' : ''}`}
                  title={sidebarCollapsed ? item.name : undefined}
                  style={{ justifyContent: sidebarCollapsed ? 'center' : 'flex-start' }}
                >
                  {item.icon}
                  {!sidebarCollapsed && <span>{item.name}</span>}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Main Content Workspace */}
        <div className="main-content">
          <Navbar onOpenNewMeeting={() => setIsNewMeetingModalOpen(true)} />

          <main style={{ flex: 1, padding: '36px 24px', maxWidth: '1200px', margin: '0 auto', width: '100%', paddingBottom: '80px' }}>
            {/* Header Greeting section */}
            <div style={{
              display: 'flex',
              flexDirection: 'row',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '20px',
              marginBottom: '36px',
              paddingBottom: '24px',
              borderBottom: '1px solid var(--border)'
            }} className="fade-in">
              <div>
                <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em' }}>
                  {getGreeting()}, {user?.name || 'User'} 👋
                </h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginTop: '4px' }}>
                  Select an option below to start collaborating instantly or schedule a meeting.
                </p>
              </div>
              
              <div style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                padding: '14px 24px',
                borderRadius: 'var(--radius-lg)',
                textAlign: 'right',
                boxShadow: 'var(--shadow)',
                display: 'flex',
                alignItems: 'center',
                gap: '16px'
              }}>
                <div>
                  <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--primary)', letterSpacing: '0.02em' }}>
                    {formatTime(currentTime)}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px', fontWeight: 600 }}>
                    {formatLongDate(currentTime)}
                  </div>
                </div>
              </div>
            </div>

            {/* Dashboard Workspace Grid */}
            <div className="dashboard-grid fade-in">
              {/* Left Column: Quick Action Cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
                  
                  {/* Action 1: New Meeting */}
                  <Card hover onClick={() => setIsNewMeetingModalOpen(true)} style={{
                    cursor: 'pointer',
                    padding: '24px',
                    border: '1px solid rgba(14, 113, 235, 0.25)',
                    background: 'linear-gradient(135deg, rgba(14, 113, 235, 0.04) 0%, rgba(99, 102, 241, 0.04) 100%)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    minHeight: '170px'
                  }}>
                    <div style={{
                      background: 'linear-gradient(135deg, var(--primary), var(--accent))',
                      color: '#ffffff',
                      width: '48px',
                      height: '48px',
                      borderRadius: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 4px 14px rgba(14, 113, 235, 0.3)'
                    }}>
                      <Video size={22} />
                    </div>
                    <div style={{ marginTop: '16px' }}>
                      <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        New Meeting <Plus size={16} />
                      </h3>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '4px', lineHeight: 1.4 }}>
                        Start now or schedule a meeting for later.
                      </p>
                    </div>
                  </Card>

                  {/* Action 2: Join Meeting */}
                  <Card style={{ padding: '24px', minHeight: '170px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                      <div style={{
                        background: 'rgba(16, 185, 129, 0.1)',
                        color: 'var(--secondary)',
                        width: '44px',
                        height: '44px',
                        borderRadius: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <LinkIcon size={20} />
                      </div>
                      <div>
                        <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text)' }}>Join Meeting</h3>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '2px' }}>Enter room code below.</p>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                      <input
                        type="text"
                        placeholder="abc-defg-hij"
                        value={meetingCode}
                        onChange={(e) => setMeetingCode(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleJoinCall()}
                        style={{
                          flex: 1,
                          padding: '10px 14px',
                          fontSize: '0.85rem',
                          background: 'var(--background)',
                          border: '1px solid var(--border)',
                          borderRadius: 'var(--radius-md)',
                          color: 'var(--text)',
                          outline: 'none',
                          transition: 'border-color 0.2s'
                        }}
                      />
                      <Button onClick={handleJoinCall} variant="secondary" style={{ padding: '10px 16px', fontSize: '0.85rem' }}>Join</Button>
                    </div>
                  </Card>
                </div>

                {/* Metrics Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                  <Card style={{ padding: '18px', textAlign: 'center' }}>
                    <div style={{ color: 'var(--primary)', display: 'inline-flex', marginBottom: '6px' }}><Clock size={18} /></div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text)' }}>{history.length}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>Meetings</div>
                  </Card>
                  
                  <Card style={{ padding: '18px', textAlign: 'center' }}>
                    <div style={{ color: 'var(--secondary)', display: 'inline-flex', marginBottom: '6px' }}><TrendingUp size={18} /></div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text)' }}>99.9%</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>Uptime</div>
                  </Card>

                  <Card style={{ padding: '18px', textAlign: 'center' }}>
                    <div style={{ color: 'var(--accent)', display: 'inline-flex', marginBottom: '6px' }}><Users size={18} /></div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text)' }}>Free</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>Account Tiers</div>
                  </Card>
                </div>
              </div>

              
            </div>
          </main>

          <Footer />
        </div>
      </div>

      {/* Mobile Navigation bar */}
      <div className="mobile-nav">
        <button type="button" className="mobile-nav-btn active" onClick={() => navigate('/home')}>
          <Home size={18} />
          <span>Home</span>
        </button>
        <button type="button" className="mobile-nav-btn" onClick={() => setIsNewMeetingModalOpen(true)}>
          <Video size={18} />
          <span>Meetings</span>
        </button>
        <button type="button" className="mobile-nav-btn" onClick={() => navigate('/history')}>
          <HistoryIcon size={18} />
          <span>History</span>
        </button>
        <button type="button" className="mobile-nav-btn" onClick={() => navigate('/settings')}>
          <Settings size={18} />
          <span>Settings</span>
        </button>
      </div>

      {/* Modal 1: New Meeting Options (Start Now vs Schedule) */}
      <Modal
        isOpen={isNewMeetingModalOpen}
        onClose={() => setIsNewMeetingModalOpen(false)}
        title="Create New Meeting"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', margin: 0 }}>
            Choose how you would like to create your meeting:
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '8px' }}>
            <button type="button"
              onClick={handleStartNow}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                padding: '24px 16px',
                background: 'linear-gradient(135deg, rgba(14, 113, 235, 0.1), rgba(99, 102, 241, 0.1))',
                border: '1px solid var(--primary)',
                borderRadius: 'var(--radius-lg)',
                cursor: 'pointer',
                color: 'var(--text)',
                textAlign: 'center',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'none'}
            >
              <div style={{
                background: 'var(--primary)',
                color: '#ffffff',
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Play size={22} />
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text)' }}>Start Meeting Now</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Create room & join immediately as host
                </div>
              </div>
            </button>

            <button type="button"
              onClick={() => {
                setIsNewMeetingModalOpen(false);
                setIsScheduleModalOpen(true);
              }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                padding: '24px 16px',
                background: 'var(--background)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                cursor: 'pointer',
                color: 'var(--text)',
                textAlign: 'center',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'none'}
            >
              <div style={{
                background: 'rgba(245, 158, 11, 0.15)',
                color: '#F59E0B',
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <CalendarIcon size={22} />
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text)' }}>Schedule Meeting</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Set date, time & persistent link for later
                </div>
              </div>
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal 2: Schedule Meeting Form */}
      <Modal
        isOpen={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
        title="Schedule a Meeting"
      >
        <form onSubmit={handleCreateScheduleMeeting} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>
              Meeting Title *
            </label>
            <Input
              placeholder="e.g. Weekly Product Sync"
              value={scheduleTitle}
              onChange={(e) => setScheduleTitle(e.target.value)}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>
                Date *
              </label>
              <input
                type="date"
                value={scheduleDate}
                onChange={(e) => setScheduleDate(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  background: 'var(--background)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text)',
                  outline: 'none',
                  fontSize: '0.9rem'
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>
                Start Time *
              </label>
              <input
                type="time"
                value={scheduleTime}
                onChange={(e) => setScheduleTime(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  background: 'var(--background)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text)',
                  outline: 'none',
                  fontSize: '0.9rem'
                }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>
                Duration
              </label>
              <select
                value={scheduleDuration}
                onChange={(e) => setScheduleDuration(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  background: 'var(--background)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text)',
                  outline: 'none',
                  fontSize: '0.9rem'
                }}
              >
                <option value="15">15 minutes</option>
                <option value="30">30 minutes</option>
                <option value="45">45 minutes</option>
                <option value="60">60 minutes (1 hour)</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>
                Time Zone
              </label>
              <div style={{ padding: '12px 14px', background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Local Time ({Intl.DateTimeFormat().resolvedOptions().timeZone})
              </div>
            </div>
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>
              Chat Permission
            </label>
            <select
              value={scheduleChatPermission}
              onChange={(e) => setScheduleChatPermission(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 14px',
                background: 'var(--background)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text)',
                outline: 'none',
                fontSize: '0.9rem'
              }}
            >
              <option value="Everyone">Everyone (Public Meeting Chat)</option>
              <option value="Private">Private / Personal (Allow Private Messages)</option>
              <option value="Disabled">Disabled (Host & Guests Cannot Chat)</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>
              Description (Optional)
            </label>
            <textarea
              placeholder="Add agenda or notes..."
              value={scheduleDescription}
              onChange={(e) => setScheduleDescription(e.target.value)}
              rows={3}
              style={{
                width: '100%',
                padding: '12px 14px',
                background: 'var(--background)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text)',
                outline: 'none',
                fontSize: '0.9rem',
                resize: 'none'
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
            <Button variant="outline" type="button" onClick={() => setIsScheduleModalOpen(false)}>Cancel</Button>
            <Button variant="primary" type="submit" disabled={isSubmittingSchedule}>
              {isSubmittingSchedule ? 'Scheduling...' : 'Save & Create Link'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal 3: Calendar View */}
      <Modal
        isOpen={isCalendarModalOpen}
        onClose={() => setIsCalendarModalOpen(false)}
        title="Meeting Calendar"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
              Scheduled & Recent Meetings
            </span>
            <Button variant="primary" size="small" onClick={() => { setIsCalendarModalOpen(false); setIsScheduleModalOpen(true); }}>
              <Plus size={16} /> Schedule New
            </Button>
          </div>

          {history.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
              <CalendarIcon size={40} opacity={0.3} style={{ marginBottom: '12px' }} />
              <p style={{ fontSize: '0.9rem' }}>No scheduled or past meetings found in calendar.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '350px', overflowY: 'auto' }}>
              {history.map((m, idx) => {
                const computedStatus = computeMeetingStatus(m);
                const statusStyle = getStatusStyle(computedStatus);
                return (
                  <div
                    key={idx}
                    onClick={() => {
                      setIsCalendarModalOpen(false);
                      setSelectedMeetingDetails(m);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '14px 18px',
                      background: 'var(--background)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    className="card-hover"
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        background: statusStyle.background,
                        color: statusStyle.color,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <CalendarIcon size={18} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span>{m.title || m.meetingCode}</span>
                          <span style={{
                            fontSize: '0.65rem',
                            padding: '2px 8px',
                            borderRadius: '10px',
                            fontWeight: 700,
                            background: statusStyle.background,
                            color: statusStyle.color
                          }}>
                            {statusStyle.label}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {m.scheduledStartTime ? new Date(m.scheduledStartTime).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : formatDate(m.date)}
                        </div>
                      </div>
                    </div>

                    <Button variant="outline" size="small">Details</Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Modal>

      {/* Modal 4: Meeting Details View */}
      {selectedMeetingDetails && (
        <Modal
          isOpen={!!selectedMeetingDetails}
          onClose={() => setSelectedMeetingDetails(null)}
          title="Meeting Details"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              {(() => {
                const computedStatus = computeMeetingStatus(selectedMeetingDetails);
                const statusStyle = getStatusStyle(computedStatus);
                return (
                  <span style={{
                    fontSize: '0.7rem',
                    padding: '3px 10px',
                    borderRadius: '12px',
                    fontWeight: 700,
                    background: statusStyle.background,
                    color: statusStyle.color,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}>
                    {statusStyle.label}
                  </span>
                );
              })()}
              <h3 style={{ fontSize: '1.4rem', fontWeight: 800, margin: '8px 0 4px 0', color: 'var(--text)' }}>
                {selectedMeetingDetails.title || "ConnectMeet Meeting"}
              </h3>
              {selectedMeetingDetails.description && (

                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>
                  {selectedMeetingDetails.description}
                </p>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', background: 'var(--background)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Meeting Code:</span>
                <strong style={{ color: 'var(--primary)' }}>{selectedMeetingDetails.meetingCode}</strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Scheduled Start:</span>
                <strong style={{ color: 'var(--text)' }}>
                  {selectedMeetingDetails.scheduledStartTime ? new Date(selectedMeetingDetails.scheduledStartTime).toLocaleString() : formatDate(selectedMeetingDetails.date)}
                </strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', borderTop: '1px solid var(--border)', paddingTop: '10px', marginTop: '4px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Persistent Link:</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <code style={{ fontSize: '0.75rem', background: 'var(--surface)', padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border)' }}>
                    {`${window.location.origin}/${selectedMeetingDetails.meetingCode}`}
                  </code>
                  <Button
                    variant="outline"
                    size="small"
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/${selectedMeetingDetails.meetingCode}`);
                      addToast('Meeting link copied!', 'success');
                    }}
                  >
                    <Copy size={14} /> Copy
                  </Button>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <Button variant="outline" onClick={() => setSelectedMeetingDetails(null)}>Close</Button>
              <Button
                variant="primary"
                onClick={() => {
                  const code = selectedMeetingDetails.meetingCode;
                  setSelectedMeetingDetails(null);
                  navigate(`/${code}`);
                }}
                iconRight={<ArrowRight size={16} />}
              >
                {selectedMeetingDetails.status === 'Scheduled' ? 'Start / Join Meeting' : 'Join Room'}
              </Button>
            </div>
          </div>
        </Modal>
      )}


      {/* Recordings Modal */}
      <RecordingsModal
        isOpen={isRecordingsModalOpen}
        onClose={() => setIsRecordingsModalOpen(false)}
      />
    </div>
  );
};

export default withAuth(Dashboard);

