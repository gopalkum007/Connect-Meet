import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import Navbar from '../../components/layout/Navbar.jsx';
import Footer from '../../components/layout/Footer.jsx';
import Button from '../../components/common/Button.jsx';
import Card from '../../components/common/Card.jsx';
import Modal from '../../components/common/Modal.jsx';
import Input from '../../components/common/Input.jsx';
import { extractRoomCode } from '../../utils/urlHelper.js';
import { motion } from 'framer-motion';
import {
  Video, Shield, Zap, MessageSquare, HelpCircle, Users, ArrowRight,
  Globe, Lock, Mic, MicOff, Camera, Monitor, Radio, Calendar, PlusCircle,
  Link as LinkIcon, Sparkles, Send, Clock, ChevronRight, Check, Disc,
  Share2, MoreHorizontal, PhoneOff, CheckCircle2
} from 'lucide-react';

const LandingPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { token, createNewMeeting, addToUserHistory } = useAuth();
  const { addToast } = useToast();

  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [meetingCodeInput, setMeetingCodeInput] = useState('');

  useEffect(() => {
    if (location.state && location.state.scrollTo) {
      const el = document.getElementById(location.state.scrollTo);
      if (el) {
        setTimeout(() => {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      }
    }
  }, [location.state]);

  const handleStartMeeting = async (e) => {
    if (e) e.preventDefault();
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

  const handleJoinMeeting = async () => {
    const cleanCode = extractRoomCode(meetingCodeInput);
    if (!cleanCode) {
      addToast('Please enter a valid meeting code or link', 'error');
      return;
    }
    if (token) {
      try {
        await addToUserHistory(cleanCode);
      } catch (err) {}
    }
    setIsJoinModalOpen(false);
    addToast('Joining meeting room...', 'success');
    navigate(`/${cleanCode}`);
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.12 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 25 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh', width: '100%', maxWidth: '100%', overflowX: 'hidden', background: 'var(--background)', color: 'var(--text)' }}>
      <Navbar />

      <style>{`
        /* Custom Styles for Connect Meet Premium Landing Page */
        .landing-hero {
          padding: 80px 24px 100px;
          background: radial-gradient(circle at 75% 15%, rgba(14, 113, 235, 0.18), transparent 45%),
                      radial-gradient(circle at 25% 85%, rgba(99, 102, 241, 0.12), transparent 45%);
          position: relative;
          overflow: hidden;
        }

        .hero-layout {
          max-width: 1240px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: 1fr;
          gap: 56px;
          align-items: center;
        }

        @media (min-width: 992px) {
          .hero-layout {
            grid-template-columns: 1fr 1.05fr;
          }
        }

        .gradient-text {
          background: linear-gradient(135deg, #3B82F6 0%, #6366F1 50%, #8B5CF6 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .hero-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          background: rgba(14, 113, 235, 0.12);
          border: 1px solid rgba(14, 113, 235, 0.3);
          border-radius: 30px;
          color: #3B82F6;
          font-size: 0.85rem;
          font-weight: 700;
          letter-spacing: 0.02em;
          box-shadow: 0 0 20px rgba(14, 113, 235, 0.15);
        }

        /* Mockup Window Styling */
        .mockup-window {
          background: #0B1120;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 18px;
          box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.6), 0 0 30px rgba(14, 113, 235, 0.15);
          overflow: hidden;
          display: flex;
          flex-direction: column;
          font-family: inherit;
        }

        .mockup-header {
          background: #111827;
          padding: 12px 18px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .mockup-body {
          display: grid;
          grid-template-columns: 1fr;
          background: #070B14;
        }

        @media (min-width: 640px) {
          .mockup-body {
            grid-template-columns: 1fr 220px;
          }
        }

        .mockup-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          padding: 12px;
        }

        .participant-card {
          position: relative;
          background: #111827;
          border-radius: 12px;
          overflow: hidden;
          aspect-ratio: 16/10;
          border: 1px solid rgba(255, 255, 255, 0.06);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .participant-card.active-speaker {
          border-color: #3B82F6;
          box-shadow: 0 0 15px rgba(59, 130, 246, 0.3);
        }

        .participant-avatar {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 1rem;
          color: #ffffff;
        }

        .participant-name-tag {
          position: absolute;
          bottom: 8px;
          left: 8px;
          background: rgba(0, 0, 0, 0.65);
          backdrop-filter: blur(4px);
          padding: 3px 8px;
          border-radius: 6px;
          font-size: 0.72rem;
          color: #ffffff;
          display: flex;
          align-items: center;
          gap: 6px;
          font-weight: 500;
        }

        .mockup-sidebar {
          background: #0D1322;
          border-left: 1px solid rgba(255, 255, 255, 0.08);
          display: flex;
          flex-direction: column;
          padding: 12px;
        }

        .mockup-chat-msg {
          background: rgba(255, 255, 255, 0.04);
          padding: 8px 10px;
          border-radius: 8px;
          font-size: 0.75rem;
          line-height: 1.35;
        }

        .mockup-controls {
          background: #111827;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          padding: 10px 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
        }

        .ctrl-btn {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.08);
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          border: none;
          cursor: pointer;
          transition: background 0.2s;
        }

        .ctrl-btn:hover {
          background: rgba(255, 255, 255, 0.16);
        }

        .ctrl-btn.danger {
          background: #EF4444;
          width: auto;
          padding: 0 16px;
          border-radius: 20px;
          font-size: 0.8rem;
          font-weight: 700;
          gap: 6px;
        }

        /* Feature Card Grid */
        .feature-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 24px;
        }

        .feature-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          padding: 28px;
          transition: transform 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease;
        }

        .feature-card:hover {
          transform: translateY(-6px);
          border-color: rgba(14, 113, 235, 0.4);
          box-shadow: 0 15px 35px -10px rgba(14, 113, 235, 0.15);
        }

        /* Quick Action Section */
        .quick-action-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 28px;
        }

        /* Stats Grid */
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 24px;
        }

        .stat-box {
          background: var(--surface);
          border: 1px solid var(--border);
          padding: 32px 24px;
          border-radius: var(--radius-lg);
          text-align: center;
        }

        /* Footer Grid */
        .footer-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
          gap: 40px;
        }
      `}</style>

      {/* 2. HERO SECTION */}
      <section className="landing-hero">
        <div className="hero-layout">
          {/* Left Column */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}
          >
            <div>
              <motion.div variants={itemVariants} className="hero-badge">
                <Sparkles size={15} /> ✨ New — Real-time Translation Available
              </motion.div>
            </div>

            <motion.h1
              variants={itemVariants}
              style={{
                fontSize: 'clamp(2.5rem, 5vw, 3.8rem)',
                fontWeight: 800,
                lineHeight: 1.1,
                letterSpacing: '-0.03em',
                color: 'var(--text)',
                margin: 0
              }}
            >
              Connect. Collaborate.<br />
              <span className="gradient-text">Create without limits.</span>
            </motion.h1>

            <motion.p
              variants={itemVariants}
              style={{
                fontSize: 'clamp(1.05rem, 1.8vw, 1.2rem)',
                color: 'var(--text-muted)',
                lineHeight: 1.6,
                margin: 0,
                maxWidth: '540px'
              }}
            >
              Connect Meet is a secure, reliable, and intelligent video conferencing platform for teams of all sizes.
            </motion.p>

            <motion.div variants={itemVariants} style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', marginTop: '8px' }}>
              <Button
                variant="primary"
                size="large"
                onClick={handleStartMeeting}
                iconLeft={<Video size={20} />}
                style={{ borderRadius: '30px', padding: '14px 28px', fontSize: '1rem', fontWeight: 700 }}
              >
                Start a Meeting
              </Button>
              <Button
                variant="outline"
                size="large"
                onClick={() => setIsJoinModalOpen(true)}
                iconLeft={<Users size={20} />}
                style={{ borderRadius: '30px', padding: '14px 28px', fontSize: '1rem', fontWeight: 700 }}
              >
                Join a Meeting
              </Button>
            </motion.div>

            {/* Below Buttons Trust Elements */}
            <motion.div
              variants={itemVariants}
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '20px',
                paddingTop: '16px',
                borderTop: '1px solid var(--border)',
                color: 'var(--text-muted)',
                fontSize: '0.85rem',
                fontWeight: 600
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Lock size={15} color="#10B981" /> End-to-end Encrypted
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Zap size={15} color="#3B82F6" /> Low Latency
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Globe size={15} color="#8B5CF6" /> Works Everywhere
              </div>
            </motion.div>
          </motion.div>

          {/* 3. HERO PRODUCT PREVIEW (RIGHT SIDE) */}
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
          >
            <div className="mockup-window">
              {/* Meeting Header */}
              <div className="mockup-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#EF4444' }}></span>
                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#F59E0B' }}></span>
                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10B981' }}></span>
                  </div>
                  <div style={{ height: '14px', width: '1px', background: 'rgba(255,255,255,0.15)', margin: '0 4px' }}></div>
                  <strong style={{ fontSize: '0.88rem', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Lock size={13} color="#10B981" /> Team Sync Meeting
                  </strong>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: 'rgba(239, 68, 68, 0.15)',
                    color: '#EF4444',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    fontSize: '0.72rem',
                    fontWeight: 700
                  }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#EF4444', animation: 'pulse 1.5s infinite' }}></span> LIVE
                  </div>
                  <span style={{ fontSize: '0.75rem', color: '#9CA3AF', fontFamily: 'monospace' }}>00:24:15</span>
                </div>
              </div>

              {/* Mockup Body */}
              <div className="mockup-body">
                {/* 2x2 Participant Grid */}
                <div className="mockup-grid">
                  {/* Card 1: You */}
                  <div className="participant-card active-speaker">
                    <div className="participant-avatar" style={{ background: 'linear-gradient(135deg, #2563EB, #4F46E5)' }}>
                      Y
                    </div>
                    <div className="participant-name-tag">
                      <Mic size={12} color="#10B981" /> You (Host)
                    </div>
                  </div>

                  {/* Card 2: Rohan Mehta */}
                  <div className="participant-card">
                    <div className="participant-avatar" style={{ background: 'linear-gradient(135deg, #059669, #10B981)' }}>
                      RM
                    </div>
                    <div className="participant-name-tag">
                      <Mic size={12} color="#10B981" /> Rohan Mehta
                    </div>
                  </div>

                  {/* Card 3: Ananya Sharma */}
                  <div className="participant-card">
                    <div className="participant-avatar" style={{ background: 'linear-gradient(135deg, #D97706, #F59E0B)' }}>
                      AS
                    </div>
                    <div className="participant-name-tag">
                      <Mic size={12} color="#10B981" /> Ananya Sharma
                    </div>
                  </div>

                  {/* Card 4: Vikram Verma */}
                  <div className="participant-card">
                    <div className="participant-avatar" style={{ background: 'linear-gradient(135deg, #7C3AED, #9333EA)' }}>
                      VV
                    </div>
                    <div className="participant-name-tag">
                      <MicOff size={12} color="#EF4444" /> Vikram Verma
                    </div>
                  </div>
                </div>

                {/* Right Sidebar: Participants & Chat */}
                <div className="mockup-sidebar">
                  <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '8px', marginBottom: '10px', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                    <span style={{ fontWeight: 700, color: '#3B82F6', borderBottom: '2px solid #3B82F6', paddingBottom: '4px' }}>Chat</span>
                    <span style={{ color: '#9CA3AF' }}>Participants (4)</span>
                  </div>

                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', overflow: 'hidden' }}>
                    <div className="mockup-chat-msg">
                      <strong style={{ color: '#10B981', display: 'block', marginBottom: '2px' }}>Rohan Mehta</strong>
                      <span style={{ color: '#D1D5DB' }}>Hey team! Can everyone hear me clearly?</span>
                    </div>

                    <div className="mockup-chat-msg">
                      <strong style={{ color: '#F59E0B', display: 'block', marginBottom: '2px' }}>Ananya Sharma</strong>
                      <span style={{ color: '#D1D5DB' }}>Yes, crystal clear! Real-time translation is active.</span>
                    </div>

                    <div className="mockup-chat-msg" style={{ background: 'rgba(59, 130, 246, 0.12)', borderLeft: '2px solid #3B82F6' }}>
                      <strong style={{ color: '#60A5FA', display: 'block', marginBottom: '2px' }}>You</strong>
                      <span style={{ color: '#E5E7EB' }}>Great, let's start the project sync agenda.</span>
                    </div>
                  </div>

                  <div style={{ marginTop: '10px', background: 'rgba(255,255,255,0.05)', padding: '6px 10px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', color: '#6B7280' }}>
                    <span>Type a message...</span>
                    <Send size={12} style={{ marginLeft: 'auto', color: '#3B82F6' }} />
                  </div>
                </div>
              </div>

              {/* Bottom Controls Bar */}
              <div className="mockup-controls">
                <button className="ctrl-btn" title="Mic"><Mic size={16} /></button>
                <button className="ctrl-btn" title="Camera"><Camera size={16} /></button>
                <button className="ctrl-btn" title="Screen Share"><Monitor size={16} color="#3B82F6" /></button>
                <button className="ctrl-btn" title="Chat"><MessageSquare size={16} /></button>
                <button className="ctrl-btn" title="Record"><Disc size={16} color="#EF4444" /></button>
                <button className="ctrl-btn" title="Participants"><Users size={16} /></button>
                <button className="ctrl-btn" title="More"><MoreHorizontal size={16} /></button>
                <button className="ctrl-btn danger"><PhoneOff size={16} /> Leave</button>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* 4. FEATURE CARDS */}
      <section id="features" style={{ padding: '90px 24px', background: 'var(--surface)', borderTop: '1px solid var(--border)' }}>
        <div style={{ maxWidth: '1240px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '56px' }}>
            <span style={{ color: 'var(--primary)', fontWeight: 700, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Core Capabilities</span>
            <h2 style={{ fontSize: '2.4rem', fontWeight: 800, color: 'var(--text)', margin: '8px 0 12px', letterSpacing: '-0.02em' }}>
              Engineered for Effortless Collaboration
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', maxWidth: '600px', margin: '0 auto' }}>
              Everything your team needs to host, record, translate, and manage meetings smoothly.
            </p>
          </div>

          <div className="feature-grid">
            {/* Feature 1 */}
            <div className="feature-card">
              <div style={{ width: '52px', height: '52px', borderRadius: '14px', background: 'rgba(14, 113, 235, 0.12)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
                <Video size={26} />
              </div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text)', marginBottom: '10px' }}>HD Video Meetings</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', lineHeight: 1.6, margin: 0 }}>
                Crystal-clear video with high-quality audio optimized dynamically for connection speeds.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="feature-card">
              <div style={{ width: '52px', height: '52px', borderRadius: '14px', background: 'rgba(16, 185, 129, 0.12)', color: '#10B981', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
                <Monitor size={26} />
              </div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text)', marginBottom: '10px' }}>Screen Sharing</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', lineHeight: 1.6, margin: 0 }}>
                Share your entire screen or specific application windows to present effortlessly.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="feature-card">
              <div style={{ width: '52px', height: '52px', borderRadius: '14px', background: 'rgba(139, 92, 246, 0.12)', color: '#8B5CF6', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
                <Globe size={26} />
              </div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text)', marginBottom: '10px' }}>Real-time Translation</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', lineHeight: 1.6, margin: 0 }}>
                Break language barriers with AI-powered multi-language translation integrated into live chat.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="feature-card">
              <div style={{ width: '52px', height: '52px', borderRadius: '14px', background: 'rgba(245, 158, 11, 0.12)', color: '#F59E0B', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
                <Calendar size={26} />
              </div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text)', marginBottom: '10px' }}>Schedule Meetings</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', lineHeight: 1.6, margin: 0 }}>
                Plan, schedule, and manage your meetings with persistent invitation room links.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="feature-card">
              <div style={{ width: '52px', height: '52px', borderRadius: '14px', background: 'rgba(239, 68, 68, 0.12)', color: '#EF4444', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
                <Shield size={26} />
              </div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text)', marginBottom: '10px' }}>Secure & Private</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', lineHeight: 1.6, margin: 0 }}>
                Enterprise-grade WebRTC security standards ensuring your data stays private and encrypted.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. QUICK ACTIONS */}
      <section id="solutions" style={{ padding: '90px 24px', background: 'var(--background)', borderTop: '1px solid var(--border)' }}>
        <div style={{ maxWidth: '1240px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '56px' }}>
            <h2 style={{ fontSize: '2.4rem', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em', margin: 0 }}>
              Everything you need to connect
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', marginTop: '8px' }}>
              Instant call creation, guest access, and organized meeting scheduling.
            </p>
          </div>

          <div className="quick-action-grid">
            {/* Action 1: New Meeting */}
            <Card hover style={{ padding: '36px', borderRadius: 'var(--radius-lg)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(14, 113, 235, 0.12)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <PlusCircle size={24} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text)', margin: '0 0 6px' }}>New Meeting</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', lineHeight: 1.5, margin: 0 }}>Start an instant video conference room right away.</p>
              </div>
              <div style={{ marginTop: 'auto', paddingTop: '12px' }}>
                <Button variant="primary" onClick={handleStartMeeting} width="100%" iconRight={<ArrowRight size={16} />}>Start Now</Button>
              </div>
            </Card>

            {/* Action 2: Join Meeting */}
            <Card hover style={{ padding: '36px', borderRadius: 'var(--radius-lg)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.12)', color: '#10B981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <LinkIcon size={24} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text)', margin: '0 0 6px' }}>Join Meeting</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', lineHeight: 1.5, margin: 0 }}>Enter a meeting ID or link to jump directly into a call.</p>
              </div>
              <div style={{ marginTop: 'auto', paddingTop: '12px' }}>
                <Button variant="outline" onClick={() => setIsJoinModalOpen(true)} width="100%" iconRight={<ArrowRight size={16} />}>Join Meeting</Button>
              </div>
            </Card>

            {/* Action 3: Schedule Meeting */}
            <Card hover style={{ padding: '36px', borderRadius: 'var(--radius-lg)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(245, 158, 11, 0.12)', color: '#F59E0B', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Calendar size={24} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text)', margin: '0 0 6px' }}>Schedule Meeting</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', lineHeight: 1.5, margin: 0 }}>Plan your next meeting and invite your colleagues in advance.</p>
              </div>
              <div style={{ marginTop: 'auto', paddingTop: '12px' }}>
                <Button variant="outline" onClick={() => navigate(token ? '/home' : '/auth')} width="100%" iconRight={<ArrowRight size={16} />}>Schedule</Button>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* 8. STATISTICS SECTION */}
      <section style={{ padding: '80px 24px', background: 'var(--background)', borderTop: '1px solid var(--border)' }}>
        <div style={{ maxWidth: '1240px', margin: '0 auto' }}>
          <div className="stats-grid">
            <div className="stat-box">
              <div style={{ fontSize: '2.8rem', fontWeight: 800, color: 'var(--primary)', letterSpacing: '-0.03em' }}>10K+</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.95rem', fontWeight: 600, marginTop: '4px' }}>Active Users</div>
            </div>

            <div className="stat-box">
              <div style={{ fontSize: '2.8rem', fontWeight: 800, color: '#10B981', letterSpacing: '-0.03em' }}>50K+</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.95rem', fontWeight: 600, marginTop: '4px' }}>Meetings Hosted</div>
            </div>

            <div className="stat-box">
              <div style={{ fontSize: '2.8rem', fontWeight: 800, color: '#8B5CF6', letterSpacing: '-0.03em' }}>99.9%</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.95rem', fontWeight: 600, marginTop: '4px' }}>Reliability Uptime</div>
            </div>

            <div className="stat-box">
              <div style={{ fontSize: '2.8rem', fontWeight: 800, color: '#F59E0B', letterSpacing: '-0.03em' }}>150+</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.95rem', fontWeight: 600, marginTop: '4px' }}>Countries</div>
            </div>
          </div>
        </div>
      </section>

      {/* 9. FINAL CTA SECTION */}
      <section id="pricing" style={{ padding: '100px 24px', background: 'linear-gradient(135deg, #090D1A 0%, #0F172A 50%, #1E1B4B 100%)', borderTop: '1px solid var(--border)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px', position: 'relative', zIndex: 2 }}>
          <h2 style={{ fontSize: 'clamp(2.2rem, 4.5vw, 3.4rem)', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.03em', margin: 0 }}>
            Ready to get started?
          </h2>
          <p style={{ color: '#9CA3AF', fontSize: '1.2rem', maxWidth: '640px', lineHeight: 1.6, margin: 0 }}>
            Create your account and start connecting with your team in seconds with HD video and real-time translation.
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', justifyContent: 'center', marginTop: '12px' }}>
            <Button
              variant="primary"
              size="large"
              onClick={() => navigate(token ? '/home' : '/auth')}
              style={{ borderRadius: '30px', padding: '14px 32px', fontSize: '1rem', fontWeight: 700 }}
              iconRight={<ArrowRight size={18} />}
            >
              Create Free Account
            </Button>
          </div>
        </div>
      </section>

      {/* 10. PREMIUM FOOTER */}
      <footer id="about" style={{ background: '#070B14', borderTop: '1px solid rgba(255,255,255,0.08)', padding: '64px 24px 32px' }}>
        <div style={{ maxWidth: '1240px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '48px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginBottom: '20px' }}>
              <img src="/logo.png" alt="Connect Meet Logo" style={{ height: '42px', objectFit: 'contain' }} />
              <span style={{ fontWeight: 800, fontSize: '1.6rem', color: '#ffffff' }}>Connect Meet</span>
            </div>
            <p style={{ color: '#9CA3AF', fontSize: '1rem', lineHeight: 1.6, margin: '0 auto', maxWidth: '700px' }}>
              Next-generation video conferencing platform powered by WebRTC and real-time AI translation engines. Connect securely and effortlessly with your team. Everything is 100% Free!
            </p>
          </div>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '24px', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', color: '#6B7280', fontSize: '0.85rem' }}>
            <span>© 2026 Connect Meet. All rights reserved.</span>
            <span>Designed for enterprise-grade video conferencing.</span>
          </div>
        </div>
      </footer>

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
            value={meetingCodeInput}
            onChange={(e) => setMeetingCodeInput(e.target.value)}
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
    </div>
  );
};

export default LandingPage;

