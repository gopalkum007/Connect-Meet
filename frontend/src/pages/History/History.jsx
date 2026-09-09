import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import Navbar from '../../components/layout/Navbar.jsx';
import Footer from '../../components/layout/Footer.jsx';
import Card from '../../components/common/Card.jsx';
import Button from '../../components/common/Button.jsx';
import { ArrowLeft, History as HistoryIcon, Calendar, Video, Search, Trash2 } from 'lucide-react';
import withAuth from '../../utils/withAuth.jsx';

const History = () => {
  const { getHistoryOfUser, deleteFromHistory } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const data = await getHistoryOfUser();
        setHistory(data || []);
      } catch (err) {
        addToast('Failed to fetch history', 'error');
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, []);

  const handleDeleteHistory = async (item) => {
    // Immediately remove from UI state
    setHistory((prev) => prev.filter((h) => {
      if (item._id && h._id) {
        return String(h._id) !== String(item._id);
      }
      return h.meetingCode !== item.meetingCode;
    }));
    addToast('Meeting history deleted successfully', 'success');

    try {
      const idOrCode = item._id || item.meetingCode;
      await deleteFromHistory(idOrCode);
    } catch (err) {
      console.log('Delete history API error:', err);
    }
  };


  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const filteredHistory = history.filter((item) =>
    item.meetingCode.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'var(--background)' }}>
      <Navbar />

      <main style={{ flex: 1, padding: '40px 24px', maxWidth: '850px', margin: '0 auto', width: '100%' }}>
        {/* Back navigation */}
        <button
          onClick={() => navigate('/home')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            fontSize: '0.85rem',
            fontWeight: 700,
            marginBottom: '28px',
            padding: '8px 16px',
            borderRadius: '20px',
            border: '1px solid var(--border)',
            width: 'fit-content',
            transition: 'all 0.2s',
            backdropFilter: 'blur(8px)'
          }}
          onMouseEnter={(e) => {
            e.target.style.background = 'rgba(255, 255, 255, 0.05)';
            e.target.style.color = 'var(--text)';
          }}
          onMouseLeave={(e) => {
            e.target.style.background = 'none';
            e.target.style.color = 'var(--text-muted)';
          }}
        >
          <ArrowLeft size={14} /> Back to Dashboard
        </button>

        {/* Page Title & Search */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
          marginBottom: '36px'
        }} className="fade-in">
          <div>
            <h1 style={{ fontSize: '2rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '12px', margin: 0, letterSpacing: '-0.02em', color: 'var(--text)' }}>
              <HistoryIcon size={30} style={{ color: 'var(--primary)', filter: 'drop-shadow(0 2px 8px rgba(99, 102, 241, 0.3))' }} /> Meeting History
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginTop: '6px' }}>
              Review, track, and manage your previous video meeting logs.
            </p>
          </div>

          <div style={{ position: 'relative', width: '100%' }}>
            <span style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
              <Search size={18} />
            </span>
            <input
              type="text"
              placeholder="Search meetings by code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '14px 16px 14px 46px',
                fontSize: '0.95rem',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '30px',
                color: 'var(--text)',
                outline: 'none',
                transition: 'all 0.2s',
                boxShadow: 'var(--shadow)'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = 'var(--primary)';
                e.target.style.boxShadow = '0 0 15px rgba(99, 102, 241, 0.15)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'var(--border)';
                e.target.style.boxShadow = 'var(--shadow)';
              }}
            />
          </div>
        </div>

        {/* Meeting Logs */}
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
            <span className="spinner" style={{ width: '40px', height: '40px', border: '3px solid rgba(99, 102, 241, 0.1)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></span>
          </div>
        ) : filteredHistory.length === 0 ? (
          <Card style={{ textAlign: 'center', padding: '80px 20px', background: 'var(--surface)', borderColor: 'var(--border)', borderRadius: 'var(--radius-lg)' }} className="fade-in">
            <div style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              background: 'rgba(99, 102, 241, 0.05)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px'
            }}>
              <Video size={36} style={{ color: 'var(--primary)', opacity: 0.6 }} />
            </div>
            <p style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text)', margin: 0 }}>No sessions matching search query</p>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '6px' }}>
              {searchTerm ? 'Verify spelling or try searching for a different code.' : "You haven't participated in any meetings yet."}
            </p>
          </Card>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }} className="fade-in">
            {filteredHistory.map((item, index) => (
              <div
                key={index}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '22px 28px',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-lg)',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: 'var(--shadow)'
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.01em', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--primary)' }}></span>
                    {item.meetingCode}
                    <span style={{
                      fontSize: '0.65rem',
                      padding: '2px 8px',
                      borderRadius: '10px',
                      fontWeight: 700,
                      background: item.status === 'Scheduled' ? 'rgba(245, 158, 11, 0.15)' : item.status === 'Live' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                      color: item.status === 'Scheduled' ? '#F59E0B' : item.status === 'Live' ? '#10B981' : '#EF4444'
                    }}>
                      {item.status || 'Ended'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                    <Calendar size={14} style={{ color: 'var(--primary)' }} />
                    {formatDate(item.date)}
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteHistory(item)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    borderRadius: '20px',
                    padding: '8px 16px',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    background: 'rgba(239, 68, 68, 0.1)',
                    color: 'var(--error)',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                  }}
                >
                  <Trash2 size={16} /> Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default withAuth(History);

