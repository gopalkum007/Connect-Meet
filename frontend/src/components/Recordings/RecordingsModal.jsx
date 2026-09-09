import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal.jsx';
import Button from '../common/Button.jsx';
import { HardDrive, Play, Download, Trash2, Video, Clock, Film } from 'lucide-react';

const RecordingsModal = ({ isOpen, onClose }) => {
  const [recordings, setRecordings] = useState([]);
  const [selectedVideo, setSelectedVideo] = useState(null);

  const loadRecordings = () => {
    try {
      const saved = JSON.parse(localStorage.getItem('connectmeet_recordings') || '[]');
      setRecordings(saved);
    } catch (e) {
      setRecordings([]);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadRecordings();
    }
  }, [isOpen]);

  const handleDelete = (id) => {
    const updated = recordings.filter(r => r.id !== id);
    setRecordings(updated);
    localStorage.setItem('connectmeet_recordings', JSON.stringify(updated));
    if (selectedVideo?.id === id) {
      setSelectedVideo(null);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Cloud & Local Meeting Recordings">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', minHeight: '380px' }}>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', margin: 0 }}>
          Manage your saved video meeting recordings, preview clips, or download them locally.
        </p>

        {selectedVideo ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text)' }}>
                Playing: {selectedVideo.title}
              </span>
              <Button variant="outline" size="small" onClick={() => setSelectedVideo(null)}>
                Back to List
              </Button>
            </div>
            <video
              src={selectedVideo.url}
              controls
              autoPlay
              style={{
                width: '100%',
                maxHeight: '320px',
                borderRadius: 'var(--radius-md)',
                background: '#000000'
              }}
            />
          </div>
        ) : recordings.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '48px 20px',
            background: 'var(--background)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center'
          }}>
            <Film size={44} style={{ color: 'var(--primary)', opacity: 0.5, marginBottom: '12px' }} />
            <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text)' }}>No Recordings Found</h4>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '6px', maxWidth: '400px', lineHeight: 1.5 }}>
              You haven't recorded any meeting sessions yet. Start a meeting and click the <strong>Record</strong> button in the bottom control toolbar to capture live sessions!
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '340px', overflowY: 'auto' }}>
            {recordings.map((rec) => (
              <div
                key={rec.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 18px',
                  background: 'var(--background)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    background: 'rgba(99, 102, 241, 0.1)',
                    color: 'var(--primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Video size={20} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text)' }}>
                      {rec.title || 'Meeting Recording'}
                    </div>
                    <div style={{ display: 'flex', gap: '12px', fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                      <span><Clock size={12} style={{ display: 'inline', marginRight: '4px' }} />{rec.date}</span>
                      {rec.duration && <span>Duration: {rec.duration}</span>}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <Button
                    variant="primary"
                    size="small"
                    onClick={() => setSelectedVideo(rec)}
                  >
                    <Play size={14} /> Play
                  </Button>
                  <a
                    href={rec.url}
                    download={`${rec.title || 'Meeting-Recording'}.webm`}
                    style={{ textDecoration: 'none' }}
                  >
                    <Button variant="outline" size="small">
                      <Download size={14} />
                    </Button>
                  </a>
                  <Button
                    variant="danger"
                    size="small"
                    onClick={() => handleDelete(rec.id)}
                    style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--error)', border: '1px solid rgba(239, 68, 68, 0.2)' }}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
};

export default RecordingsModal;
