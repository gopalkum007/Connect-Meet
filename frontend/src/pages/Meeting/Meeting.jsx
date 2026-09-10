import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import io from 'socket.io-client';
import { useNavigate, useParams } from 'react-router-dom';
import server from '../../environment';
import Button from '../../components/common/Button.jsx';
import Card from '../../components/common/Card.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import PrivateChatDrawer from '../../components/PrivateChat/PrivateChatDrawer.jsx';
import LanguageSelector from '../../components/LanguageSelector/LanguageSelector.jsx';
import TranslatedMessage from '../../components/TranslatedMessage/TranslatedMessage.jsx';
import { getMeetingDetails } from '../../api/meeting.api.js';
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  PhoneOff,
  Monitor,
  MonitorOff,
  MessageSquare,
  Users,
  Send,
  X,
  Settings,
  Shield,
  MoreVertical,
  Globe,
  Clock,
  Sparkles,
  Copy,
  ArrowRight,
  Volume2,
  VolumeX
} from 'lucide-react';

const getIceServers = () => {
  const iceServers = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
  ];

  const turnUrl = import.meta.env.VITE_TURN_URL;
  const turnUsername = import.meta.env.VITE_TURN_USERNAME;
  const turnCredential = import.meta.env.VITE_TURN_CREDENTIAL;

  if (turnUrl) {
    const urls = turnUrl.split(',').map((u) => u.trim()).filter(Boolean);
    const turnEntry = { urls };
    if (turnUsername) turnEntry.username = turnUsername;
    if (turnCredential) turnEntry.credential = turnCredential;
    iceServers.push(turnEntry);
  }

  return { iceServers, iceCandidatePoolSize: 10 };
};

import { extractRoomCode } from '../../utils/urlHelper.js';

const Meeting = () => {
  const { url: rawUrl } = useParams();
  const meetingCode = extractRoomCode(rawUrl);
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { user, preferredLanguage, token } = useAuth();

  const connectionsRef = useRef({});
  const socketRef = useRef();
  const socketIdRef = useRef();
  const localVideoRef = useRef();
  const videoRef = useRef([]);
  const audioContextRef = useRef(null);
  const voiceDetectionFrameRef = useRef(null);
  const isMeetingActiveRef = useRef(true);
  const isCleanedUpRef = useRef(false);
  const localStreamRef = useRef(null);
  const deviceChangeHandlerRef = useRef(null);

  const [videoAvailable, setVideoAvailable] = useState(true);
  const [audioAvailable, setAudioAvailable] = useState(true);
  const [video, setVideo] = useState(true);
  const [audio, setAudio] = useState(true);
  const [screen, setScreen] = useState(false);
  const [screenAvailable, setScreenAvailable] = useState(false);

  // UI state
  const [askForUsername, setAskForUsername] = useState(true);
  const [username, setUsername] = useState(user?.name || '');
  const [videos, setVideos] = useState([]);
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState('');
  const [showChat, setShowChat] = useState(false);
  const [newMessages, setNewMessages] = useState(0);
  const [meetingDetails, setMeetingDetails] = useState(null);
  const [isDetailsLoaded, setIsDetailsLoaded] = useState(false);
  const [isWaitingForSchedule, setIsWaitingForSchedule] = useState(false);
  const [isMeetingEnded, setIsMeetingEnded] = useState(false);
  const [chatPermission, setChatPermission] = useState('Everyone');
  const [isEndMeetingModalOpen, setIsEndMeetingModalOpen] = useState(false);
  const [countdownTime, setCountdownTime] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0, totalMs: 0 });

  // Waiting room & Host join request state
  const [isWaitingForHostApproval, setIsWaitingForHostApproval] = useState(false);
  const [isJoinRejected, setIsJoinRejected] = useState(false);
  const [joinRequests, setJoinRequests] = useState([]);
  const [isAudioAutoplayBlocked, setIsAudioAutoplayBlocked] = useState(false);

  const handleMediaError = useCallback((error, type = 'media device') => {
    console.error(`[MEDIA] ${type} error:`, error);
    let msg = `Unable to access ${type}.`;
    if (error?.name === 'NotAllowedError' || error?.name === 'PermissionDeniedError') {
      msg = `Camera/Microphone permission denied. Please allow access in your browser settings.`;
    } else if (error?.name === 'NotFoundError' || error?.name === 'DevicesNotFoundError') {
      msg = `No ${type} found on your system.`;
    } else if (error?.name === 'NotReadableError' || error?.name === 'TrackStartError') {
      msg = `Camera or microphone is currently in use by another application.`;
    } else if (error?.name === 'OverconstrainedError') {
      msg = `The requested ${type} resolution or settings are not supported.`;
    } else if (error?.name === 'SecurityError') {
      msg = `Media access requires a secure origin (HTTPS).`;
    }
    addToast(msg, 'error');
  }, [addToast]);

  useEffect(() => {
    if (user?.name && !username) {
      setUsername(user.name);
    }
  }, [user]);

  useEffect(() => {
    const fetchDetails = async () => {
      if (meetingCode) {
        try {
          const details = await getMeetingDetails(meetingCode);
          if (details) {
            setMeetingDetails(details);
            if (details.status === "Ended") {
              setIsMeetingEnded(true);
            } else if (details.status === "Scheduled" && details.scheduledStartTime) {
              const startMs = new Date(details.scheduledStartTime).getTime();
              if (startMs > Date.now()) {
                setIsWaitingForSchedule(true);
              }
            }
            if (details.chatPermission) {
              setChatPermission(details.chatPermission);
            }
          }
        } catch (e) {
          console.log("Failed to fetch meeting details:", e);
        } finally {
          setIsDetailsLoaded(true);
        }
      } else {
        setIsDetailsLoaded(true);
      }
    };
    fetchDetails();
  }, [meetingCode]);

  useEffect(() => {
    if (!isWaitingForSchedule || !meetingDetails?.scheduledStartTime) return;

    const updateTimer = () => {
      const startMs = new Date(meetingDetails.scheduledStartTime).getTime();
      const diff = startMs - Date.now();

      if (diff <= 0) {
        setIsWaitingForSchedule(false);
        setCountdownTime({ days: 0, hours: 0, minutes: 0, seconds: 0, totalMs: 0 });
        addToast("Meeting scheduled start time has arrived! You can join now.", "success");
      } else {
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
        const minutes = Math.floor((diff / 1000 / 60) % 60);
        const seconds = Math.floor((diff / 1000) % 60);
        setCountdownTime({ days, hours, minutes, seconds, totalMs: diff });
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [isWaitingForSchedule, meetingDetails]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      cleanUpMediaAndConnections();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handleBeforeUnload);
      cleanUpMediaAndConnections();
    };
  }, []);

  // Enhancements state
  const [participants, setParticipants] = useState([]);
  const [sidebarTab, setSidebarTab] = useState('chat'); // 'chat' or 'participants'
  const [privateChatRecipient, setPrivateChatRecipient] = useState(null);
  const [unreadPrivateMessages, setUnreadPrivateMessages] = useState({}); // { [peerSocketId]: count }
  const [privateMessages, setPrivateMessages] = useState({}); // { [peerSocketId]: [messageObjects] }
  const privateChatRecipientRef = useRef(null);

  // Sync ref and clear unread count whenever privateChatRecipient is opened/switched
  useEffect(() => {
    privateChatRecipientRef.current = privateChatRecipient;
    if (privateChatRecipient) {
      setUnreadPrivateMessages((prev) => {
        const next = { ...prev };
        if (privateChatRecipient.socketId) delete next[privateChatRecipient.socketId];
        if (privateChatRecipient.username) delete next[privateChatRecipient.username];
        return next;
      });
      if (socketRef.current && privateChatRecipient.socketId) {
        socketRef.current.emit("private-message-read", { toSocketId: privateChatRecipient.socketId });
      }
    }
  }, [privateChatRecipient]);

  const openPrivateChat = useCallback((recipientObj) => {
    if (!recipientObj) return;
    const target = {
      socketId: recipientObj.socketId,
      username: recipientObj.username,
      preferredLanguage: recipientObj.preferredLanguage || 'en'
    };
    setPrivateChatRecipient(target);
    setUnreadPrivateMessages((prev) => {
      const next = { ...prev };
      if (target.socketId) delete next[target.socketId];
      if (target.username) delete next[target.username];
      return next;
    });
    if (socketRef.current && target.socketId) {
      socketRef.current.emit("private-message-read", { toSocketId: target.socketId });
    }
  }, []);

  const getUnreadCount = useCallback((p) => {
    if (!p) return 0;
    if (p.socketId && unreadPrivateMessages[p.socketId]) return unreadPrivateMessages[p.socketId];
    if (p.username && unreadPrivateMessages[p.username]) return unreadPrivateMessages[p.username];
    return 0;
  }, [unreadPrivateMessages]);

  const totalUnreadPrivate = useMemo(() => {
    return Object.values(unreadPrivateMessages).reduce((sum, count) => sum + (typeof count === 'number' ? count : 0), 0);
  }, [unreadPrivateMessages]);

  const [activeActionMenu, setActiveActionMenu] = useState(null);
  const [lobbyLanguage, setLobbyLanguage] = useState(() => localStorage.getItem('preferredLanguage') || preferredLanguage || 'en');

  // Host & Controls enhancements state
  const [participantCount, setParticipantCount] = useState(1);
  const [activeSpeaker, setActiveSpeaker] = useState(null);
  const [sharingPresenter, setSharingPresenter] = useState(null); // { socketId, username }
  const [allowPrivateMessages, setAllowPrivateMessages] = useState(true);
  const [allowScreenShare, setAllowScreenShare] = useState(true);
  const [hostId, setHostId] = useState(null);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [reactionsList, setReactionsList] = useState([]);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const isCurrentUserHost = (user?.username && hostId === user.username) || hostId === username;

  // Hardware devices states
  const [videoDevices, setVideoDevices] = useState([]);
  const [audioDevices, setAudioDevices] = useState([]);
  const [selectedVideo, setSelectedVideo] = useState('');
  const [selectedAudio, setSelectedAudio] = useState('');

  // Redesign state additions
  const [meetingDuration, setMeetingDuration] = useState(0);
  const [pinnedParticipant, setPinnedParticipant] = useState(null);
  const [showMicMenu, setShowMicMenu] = useState(false);
  const [showCamMenu, setShowCamMenu] = useState(false);

  useEffect(() => {
    if (!askForUsername) {
      const interval = setInterval(() => {
        setMeetingDuration(prev => prev + 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [askForUsername]);

  const formatDuration = (sec) => {
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const secs = sec % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Recording & AI Assistant state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);

  useEffect(() => {
    let timer;
    if (isRecording) {
      timer = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } else {
      setRecordingTime(0);
    }
    return () => clearInterval(timer);
  }, [isRecording]);

  const handleToggleRecording = async () => {
    if (isRecording) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      setIsRecording(false);
    } else {
      try {
        let streamToRecord = window.localStream;
        if (!streamToRecord || streamToRecord.getTracks().length === 0) {
          addToast("Media stream not available to record", "error");
          return;
        }

        recordedChunksRef.current = [];
        let recorder;
        try {
          recorder = new MediaRecorder(streamToRecord, { mimeType: 'video/webm;codecs=vp8,opus' });
        } catch (e) {
          recorder = new MediaRecorder(streamToRecord);
        }

        recorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            recordedChunksRef.current.push(event.data);
          }
        };

        recorder.onstop = () => {
          const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
          const url = URL.createObjectURL(blob);
          const newRecording = {
            id: Date.now().toString(),
            title: `Meeting ${meetingCode || 'Session'}`,
            date: new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
            duration: formatDuration(recordingTime),
            url: url
          };

          try {
            const existing = JSON.parse(localStorage.getItem('connectmeet_recordings') || '[]');
            existing.unshift(newRecording);
            localStorage.setItem('connectmeet_recordings', JSON.stringify(existing));
          } catch (err) {}

          addToast("Recording saved! Check the Recordings section.", "success");
        };

        recorder.start(1000);
        mediaRecorderRef.current = recorder;
        setIsRecording(true);
        addToast("Recording started", "info");
      } catch (err) {
        console.error("Recording error:", err);
        addToast("Failed to start recording: " + err.message, "error");
      }
    }
  };


  useEffect(() => {
    if (isDetailsLoaded && !isWaitingForSchedule && !isMeetingEnded) {
      getPermissions();
    }
  }, [isDetailsLoaded, isWaitingForSchedule, isMeetingEnded]);

  useEffect(() => {
    const getDevices = async () => {
      if (!isMeetingActiveRef.current) return;
      try {
        if (!navigator.mediaDevices?.enumerateDevices) return;
        const devices = await navigator.mediaDevices.enumerateDevices();
        if (!isMeetingActiveRef.current) return;
        const videoList = devices.filter(d => d.kind === 'videoinput');
        const audioList = devices.filter(d => d.kind === 'audioinput');
        setVideoDevices(videoList);
        setAudioDevices(audioList);
        if (videoList.length > 0 && !selectedVideo) setSelectedVideo(videoList[0].deviceId);
        if (audioList.length > 0 && !selectedAudio) setSelectedAudio(audioList[0].deviceId);

        // Hardware device disconnection check
        if (videoList.length === 0 && video) {
          setVideoAvailable(false);
          setVideo(false);
          if (socketRef.current) {
            socketRef.current.emit("media-state-changed", {
              socketId: socketIdRef.current,
              videoEnabled: false,
              audioEnabled: audio,
              room: meetingCode
            });
          }
        }
        if (audioList.length === 0 && audio) {
          setAudioAvailable(false);
          setAudio(false);
          setActiveSpeaker((curr) => curr === socketIdRef.current ? null : curr);
          if (socketRef.current) {
            socketRef.current.emit("active-speaker", { isSpeaking: false, room: meetingCode });
            socketRef.current.emit("media-state-changed", {
              socketId: socketIdRef.current,
              videoEnabled: video,
              audioEnabled: false,
              room: meetingCode
            });
          }
        }
      } catch (err) {
        console.log("Enumerate devices error:", err);
      }
    };
    deviceChangeHandlerRef.current = getDevices;
    getDevices();

    if (navigator.mediaDevices) {
      navigator.mediaDevices.addEventListener('devicechange', getDevices);
    }
    return () => {
      if (navigator.mediaDevices) {
        navigator.mediaDevices.removeEventListener('devicechange', getDevices);
      }
    };
  }, [video, audio, meetingCode]);

  const getPermissions = async () => {
    if (!isMeetingActiveRef.current) return;
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        addToast("MediaDevices API is not supported in this browser context (HTTPS required).", "error");
        return;
      }

      let stream = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        });
        setVideoAvailable(true);
        setAudioAvailable(true);
      } catch (bothErr) {
        console.warn("[MEDIA] Dual camera/mic acquisition failed, testing individual devices:", bothErr.name);
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          setAudioAvailable(true);
          setVideoAvailable(false);
          setVideo(false);
        } catch (audioErr) {
          try {
            stream = await navigator.mediaDevices.getUserMedia({ video: true });
            setVideoAvailable(true);
            setAudioAvailable(false);
            setAudio(false);
          } catch (videoErr) {
            handleMediaError(bothErr, 'camera and microphone');
            setVideoAvailable(false);
            setAudioAvailable(false);
            setVideo(false);
            setAudio(false);
          }
        }
      }

      if (!isMeetingActiveRef.current) {
        if (stream) stream.getTracks().forEach((track) => { track.enabled = false; track.stop(); });
        return;
      }

      // If hardware devices are unavailable, initialize synthetic tracks so WebRTC handshakes never break
      if (!stream) {
        const dummyAudio = silence();
        const dummyVideo = black();
        const tracks = [dummyAudio, dummyVideo].filter(Boolean);
        stream = new MediaStream(tracks);
      }

      if (navigator.mediaDevices.getDisplayMedia) {
        setScreenAvailable(true);
      } else {
        setScreenAvailable(false);
      }

      localStreamRef.current = stream;
      window.localStream = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.play().catch(() => {});
      }
    } catch (error) {
      console.error("[MEDIA] getPermissions error:", error);
    }
  };

  // Ensure local video element receives and plays the existing local stream whenever
  // switching from lobby/waiting-room into the meeting or when toggling video
  useEffect(() => {
    if (!isMeetingActiveRef.current) return;
    const stream = localStreamRef.current || window.localStream;
    if (localVideoRef.current && stream) {
      if (localVideoRef.current.srcObject !== stream) {
        localVideoRef.current.srcObject = stream;
      }
      localVideoRef.current.play().catch((err) => {
        console.warn("[Local Video] Autoplay / play error:", err);
      });
    }
  }, [askForUsername, isWaitingForHostApproval, video]);

  useEffect(() => {
    if (!isMeetingActiveRef.current) return;
    // Only re-run in pre-join lobby. Inside active meeting, toggles are handled by handleVideo/handleAudio
    if (askForUsername && (video !== undefined && audio !== undefined)) {
      getUserMedia();
    }
  }, [video, audio, askForUsername]);

  const setupVoiceDetector = (stream) => {
    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack) return;

    try {
      if (audioContextRef.current) {
        try { audioContextRef.current.close(); } catch (e) {}
        audioContextRef.current = null;
      }
      if (voiceDetectionFrameRef.current) {
        cancelAnimationFrame(voiceDetectionFrameRef.current);
        voiceDetectionFrameRef.current = null;
      }

      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      audioContextRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(new MediaStream([audioTrack]));
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      let speakingCounter = 0;
      let silentCounter = 0;
      let lastSpeakingState = false;

      const checkVolume = () => {
        if (!socketRef.current || !audioContextRef.current) return;

        const currentTrack = stream.getAudioTracks()[0];
        if (!currentTrack || !currentTrack.enabled) {
          if (lastSpeakingState) {
            lastSpeakingState = false;
            socketRef.current.emit("active-speaker", { isSpeaking: false, room: meetingCode });
            setActiveSpeaker((curr) => curr === socketIdRef.current ? null : curr);
          }
          voiceDetectionFrameRef.current = requestAnimationFrame(checkVolume);
          return;
        }

        analyser.getByteFrequencyData(dataArray);
        
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;

        // Decibel threshold for speaking
        const isCurrentlySpeaking = average > 20;

        if (isCurrentlySpeaking) {
          speakingCounter++;
          silentCounter = 0;
        } else {
          silentCounter++;
          speakingCounter = 0;
        }

        if (speakingCounter > 10 && !lastSpeakingState) {
          lastSpeakingState = true;
          socketRef.current.emit("active-speaker", { isSpeaking: true, room: meetingCode });
          setActiveSpeaker(socketIdRef.current);
        } else if (silentCounter > 30 && lastSpeakingState) {
          lastSpeakingState = false;
          socketRef.current.emit("active-speaker", { isSpeaking: false, room: meetingCode });
          setActiveSpeaker((curr) => curr === socketIdRef.current ? null : curr);
        }

        voiceDetectionFrameRef.current = requestAnimationFrame(checkVolume);
      };

      voiceDetectionFrameRef.current = requestAnimationFrame(checkVolume);
    } catch (e) {
      console.error("Failed to initialize active speaker detection:", e);
    }
  };

  const getMedia = () => {
    setVideo(videoAvailable);
    setAudio(audioAvailable);
    connectToSocketServer();
  };

  const getUserMediaSuccess = (stream) => {
    if (!isMeetingActiveRef.current) {
      if (stream) {
        try {
          stream.getTracks().forEach((track) => {
            track.enabled = false;
            track.stop();
          });
        } catch (e) {}
      }
      return;
    }

    try {
      setupVoiceDetector(stream);
    } catch (err) {}

    localStreamRef.current = stream;
    window.localStream = stream;
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
      localVideoRef.current.play().catch(() => {});
    }

    for (let id in connectionsRef.current) {
      if (id === socketIdRef.current || !connectionsRef.current[id]) continue;
      const pc = connectionsRef.current[id];
      if (pc.signalingState === 'closed') continue;
      const senders = pc.getSenders ? pc.getSenders() : [];

      stream.getTracks().forEach((track) => {
        const sender = senders.find((s) => s.track && s.track.kind === track.kind);
        if (sender) {
          sender.replaceTrack(track).catch((e) => console.warn("[WEBRTC] replaceTrack error:", e));
        } else {
          try {
            pc.addTrack(track, stream);
          } catch (e) {
            console.warn("[WEBRTC] addTrack error:", e);
          }
        }
      });
    }
  };

  const getUserMedia = async () => {
    if (!isMeetingActiveRef.current) return;
    try {
      if (!navigator.mediaDevices?.getUserMedia) return;
      const constraints = {
        video: video && videoAvailable ? (selectedVideo ? { deviceId: { exact: selectedVideo } } : true) : false,
        audio: audio && audioAvailable ? (selectedAudio ? { deviceId: { exact: selectedAudio } } : true) : false
      };

      if (!constraints.video && !constraints.audio) return;

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (!isMeetingActiveRef.current) {
        stream.getTracks().forEach((t) => { t.enabled = false; t.stop(); });
        return;
      }
      getUserMediaSuccess(stream);
    } catch (e) {
      handleMediaError(e, 'camera/microphone');
    }
  };

  useEffect(() => {
    if (!isMeetingActiveRef.current) return;
    if (askForUsername && (selectedVideo || selectedAudio)) {
      getUserMedia();
    }
  }, [selectedVideo, selectedAudio, askForUsername]);

  const getDisplayMediaSuccess = (stream) => {
    if (!isMeetingActiveRef.current) {
      if (stream) {
        try {
          stream.getTracks().forEach((track) => {
            track.enabled = false;
            track.stop();
          });
        } catch (e) {}
      }
      return;
    }

    try {
      if (window.localStream && window.localStream !== stream) {
        window.localStream.getTracks().forEach((track) => track.stop());
      }
    } catch (e) {
      console.log(e);
    }

    localStreamRef.current = stream;
    window.localStream = stream;
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
    }

    for (let id in connectionsRef.current) {
      if (id === socketIdRef.current || !connectionsRef.current[id]) continue;
      const pc = connectionsRef.current[id];
      const senders = pc.getSenders ? pc.getSenders() : [];

      stream.getTracks().forEach((track) => {
        const sender = senders.find((s) => s.track && s.track.kind === track.kind);
        if (sender) {
          sender.replaceTrack(track).catch((e) => console.log("replaceTrack error:", e));
        } else {
          try {
            pc.addTrack(track, stream);
          } catch (e) {
            console.log("addTrack error:", e);
          }
        }
      });
    }

    stream.getTracks().forEach((track) => {
      track.onended = () => {
        if (!isMeetingActiveRef.current) return;
        if (socketRef.current) {
          socketRef.current.emit("stop-screen-share", meetingCode);
        }
        setScreen(false);
        try {
          if (localVideoRef.current && localVideoRef.current.srcObject) {
            let tracks = localVideoRef.current.srcObject.getTracks();
            tracks.forEach((t) => t.stop());
          }
        } catch (e) {
          console.log(e);
        }

        let blackSilence = (...args) => new MediaStream([black(...args), silence()]);
        window.localStream = blackSilence();
        localStreamRef.current = window.localStream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = window.localStream;
        }
        getUserMedia();
      };
    });
  };

  const getDisplayMedia = () => {
    if (!isMeetingActiveRef.current) return;
    if (screen) {
      if (navigator.mediaDevices.getDisplayMedia) {
        navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
          .then((stream) => {
            if (!isMeetingActiveRef.current) {
              if (stream) {
                stream.getTracks().forEach((track) => {
                  track.enabled = false;
                  track.stop();
                });
              }
              return;
            }
            getDisplayMediaSuccess(stream);
            if (socketRef.current) {
              socketRef.current.emit("start-screen-share", meetingCode);
            }
          })
          .catch((e) => {
            console.log(e);
            setScreen(false);
          });
      }
    }
  };

  const createPeerConnection = (socketListId) => {
    if (socketListId === socketIdRef.current) return null;
    if (connectionsRef.current[socketListId]) {
      const existing = connectionsRef.current[socketListId];
      if (existing.signalingState !== 'closed') return existing;
    }

    console.log("[WEBRTC] Creating new RTCPeerConnection for:", socketListId);
    const pc = new RTCPeerConnection(getIceServers());
    connectionsRef.current[socketListId] = pc;
    pc._iceQueue = [];
    pc._remoteStream = new MediaStream();

    pc.onicecandidate = function (event) {
      if (event.candidate != null) {
        console.log(`[WEBRTC] ICE candidate generated for ${socketListId}: type=${event.candidate.type || 'unknown'}, protocol=${event.candidate.protocol || 'unknown'}`);
        socketRef.current?.emit('signal', socketListId, JSON.stringify({ ice: event.candidate }));
      }
    };

    pc.onicecandidateerror = (event) => {
      console.error(
        "[WEBRTC] ICE candidate error",
        event.errorCode,
        event.errorText,
        event.url
      );
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`[WEBRTC] ICE connection state with ${socketListId}:`, pc.iceConnectionState);
    };

    pc.onconnectionstatechange = () => {
      console.log(`[WEBRTC] Connection state with ${socketListId}:`, pc.connectionState);
      if (pc.connectionState === 'failed') {
        console.warn(`[WEBRTC] Connection failed with ${socketListId}. Attempting ICE restart.`);
        if (pc.restartIce) pc.restartIce();
      }
    };

    pc.onsignalingstatechange = () => {
      console.log(`[WEBRTC] Signaling state with ${socketListId}:`, pc.signalingState);
    };

    pc.onicegatheringstatechange = () => {
      console.log(`[WEBRTC] ICE gathering state with ${socketListId}:`, pc.iceGatheringState);
    };

    const handleRemoteStream = (remoteStream) => {
      if (!remoteStream || socketListId === socketIdRef.current) return;
      console.log("[WEBRTC] Adding/updating remote stream for:", socketListId);

      setVideos((previous) => {
        const filtered = previous.filter(v => v.socketId !== socketIdRef.current);
        const existing = filtered.find((v) => v.socketId === socketListId);
        if (existing) {
          const updated = filtered.map((v) =>
            v.socketId === socketListId ? { ...v, stream: remoteStream } : v
          );
          videoRef.current = updated;
          return updated;
        }

        const newVideo = {
          socketId: socketListId,
          stream: remoteStream,
          autoplay: true,
          playsinline: true,
          audioEnabled: true,
          videoEnabled: true
        };
        const updated = [...filtered, newVideo];
        videoRef.current = updated;
        return updated;
      });
    };

    pc.ontrack = (event) => {
      console.log(`[WEBRTC] ontrack fired from ${socketListId} for kind: ${event.track.kind}, id: ${event.track.id}`);
      if (!pc._remoteStream) {
        pc._remoteStream = new MediaStream();
      }

      // Replace existing track of the same kind if ID is different
      const existingTrack = pc._remoteStream.getTracks().find(t => t.kind === event.track.kind);
      if (existingTrack && existingTrack.id !== event.track.id) {
        pc._remoteStream.removeTrack(existingTrack);
      }

      if (!pc._remoteStream.getTrackById(event.track.id)) {
        pc._remoteStream.addTrack(event.track);
      }

      event.track.onended = () => {
        console.log(`[WEBRTC] Remote track ${event.track.kind} ended from ${socketListId}`);
      };

      handleRemoteStream(pc._remoteStream);
    };

    pc.onaddstream = (event) => {
      console.log("[WEBRTC] onaddstream fired for:", socketListId);
      if (event.stream) {
        event.stream.getTracks().forEach((track) => {
          if (!pc._remoteStream.getTrackById(track.id)) {
            pc._remoteStream.addTrack(track);
          }
        });
        handleRemoteStream(pc._remoteStream);
      }
    };

    // Safely add local tracks
    if (window.localStream) {
      const senders = pc.getSenders ? pc.getSenders() : [];
      window.localStream.getTracks().forEach((track) => {
        const alreadyAdded = senders.some((s) => s.track === track || (s.track && s.track.kind === track.kind));
        if (!alreadyAdded) {
          try {
            pc.addTrack(track, window.localStream);
          } catch (e) {
            console.error("[WEBRTC] addTrack error:", e);
          }
        }
      });
    }

    pc.onnegotiationneeded = async () => {
      try {
        if (pc._makingOffer || pc.signalingState !== 'stable') return;
        console.log(`[WEBRTC] onnegotiationneeded triggered for ${socketListId}`);
        pc._makingOffer = true;
        const offer = await pc.createOffer();
        if (pc.signalingState !== 'stable') return;
        await pc.setLocalDescription(offer);
        socketRef.current?.emit('signal', socketListId, JSON.stringify({ sdp: pc.localDescription }));
      } catch (err) {
        console.error(`[WEBRTC] Negotiation error with ${socketListId}:`, err);
      } finally {
        pc._makingOffer = false;
      }
    };

    return pc;
  };

  const gotMessageFromServer = async (fromId, message) => {
    let signal;
    try {
      signal = JSON.parse(message);
    } catch (e) {
      return;
    }

    if (fromId === socketIdRef.current) return;

    const pc = createPeerConnection(fromId);
    if (!pc) return;

    if (signal.sdp) {
      try {
        const isOffer = signal.sdp.type === 'offer';
        const isPolite = socketIdRef.current < fromId;
        const offerCollision = isOffer && (pc.signalingState !== 'stable' || pc._makingOffer);

        if (offerCollision) {
          if (!isPolite) {
            console.log(`[WEBRTC] Glare detected with ${fromId}. Impolite peer ignoring offer.`);
            return;
          }
          console.log(`[WEBRTC] Glare detected with ${fromId}. Polite peer rolling back.`);
          await Promise.all([
            pc.setLocalDescription({ type: 'rollback' }),
            pc.setRemoteDescription(new RTCSessionDescription(signal.sdp))
          ]);
        } else {
          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        }

        // Drain queued ICE candidates now that remote description is set
        if (pc._iceQueue && pc._iceQueue.length > 0) {
          for (const cand of pc._iceQueue) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(cand));
            } catch (iceErr) {
              console.warn("[WEBRTC] addIceCandidate from queue error:", iceErr);
            }
          }
          pc._iceQueue = [];
        }

        if (isOffer) {
          // Ensure local tracks are attached before generating answer
          if (window.localStream) {
            const senders = pc.getSenders ? pc.getSenders() : [];
            window.localStream.getTracks().forEach((track) => {
              const alreadyAdded = senders.some((s) => s.track === track || (s.track && s.track.kind === track.kind));
              if (!alreadyAdded) {
                try {
                  pc.addTrack(track, window.localStream);
                } catch (e) {
                  console.error("[WEBRTC] addTrack before answer error:", e);
                }
              }
            });
          }

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socketRef.current?.emit('signal', fromId, JSON.stringify({ sdp: pc.localDescription }));
        }
      } catch (err) {
        console.error("[WEBRTC] SDP signaling error from", fromId, err);
      }
    }

    if (signal.ice) {
      try {
        if (!pc.remoteDescription || !pc.remoteDescription.type) {
          pc._iceQueue = pc._iceQueue || [];
          pc._iceQueue.push(signal.ice);
        } else {
          await pc.addIceCandidate(new RTCIceCandidate(signal.ice));
        }
      } catch (err) {
        console.warn("[WEBRTC] addIceCandidate error:", err);
      }
    }
  };

  const handleApproveJoinRequest = (candidateSocketId) => {
    if (socketRef.current) {
      socketRef.current.emit("approve-join-request", { candidateSocketId, room: meetingCode });
    }
    setJoinRequests((prev) => prev.filter(r => r.socketId !== candidateSocketId));
  };

  const handleRejectJoinRequest = (candidateSocketId) => {
    if (socketRef.current) {
      socketRef.current.emit("reject-join-request", { candidateSocketId, room: meetingCode });
    }
    setJoinRequests((prev) => prev.filter(r => r.socketId !== candidateSocketId));
  };

  const handleCancelMyJoinRequest = () => {
    if (socketRef.current) {
      socketRef.current.emit("cancel-join-request", { room: meetingCode });
    }
    setIsWaitingForHostApproval(false);
    setAskForUsername(true);
  };

  const connectToSocketServer = () => {
    if (socketRef.current && socketRef.current.connected) return;
    const authToken = token || localStorage.getItem('token');
    const isSecure = server ? server.startsWith('https') : false;
    socketRef.current = io.connect(server, {
      ...(isSecure ? { secure: true } : {}),
      auth: authToken ? { token: authToken } : undefined
    });

    socketRef.current.on('signal', gotMessageFromServer);

    socketRef.current.on('connect', () => {
      console.log("[SOCKET] Connected to signaling server with ID:", socketRef.current.id);
      socketIdRef.current = socketRef.current.id;

      // Emit join request for host approval
      socketRef.current.emit('join-request', {
        username: username || user?.name || "Guest",
        token: token || localStorage.getItem('token'),
        preferredLanguage: lobbyLanguage || preferredLanguage || "en",
        room: meetingCode,
        audioEnabled: audio,
        videoEnabled: video
      });
    });

    socketRef.current.on('disconnect', (reason) => {
      console.warn("[SOCKET] Disconnected from signaling server:", reason);
    });

    socketRef.current.on('connect_error', (error) => {
      console.error("[SOCKET] Signaling connection error:", error.message);
    });

    socketRef.current.io?.on('reconnect_attempt', (attempt) => {
      console.log(`[SOCKET] Reconnection attempt #${attempt}`);
    });

    socketRef.current.io?.on('reconnect', (attempt) => {
      console.log(`[SOCKET] Reconnected successfully after ${attempt} attempts`);
    });

    socketRef.current.on('waiting-for-host-approval', () => {
      setIsWaitingForHostApproval(true);
      setIsJoinRejected(false);
    });

    socketRef.current.on('join-request-approved', () => {
      setIsWaitingForHostApproval(false);
      setIsJoinRejected(false);
      setAskForUsername(false);

      socketRef.current.emit('join-call', meetingCode);

      socketRef.current.emit('user-info-register', {
        username: username || user?.name || "Guest",
        preferredLanguage: lobbyLanguage || preferredLanguage || "en",
        room: meetingCode,
        audioEnabled: audio,
        videoEnabled: video
      });

      socketRef.current.emit('media-state-changed', {
        socketId: socketIdRef.current,
        audioEnabled: audio,
        videoEnabled: video,
        room: meetingCode
      });
    });

    socketRef.current.on('join-request-rejected', () => {
      setIsWaitingForHostApproval(false);
      setIsJoinRejected(true);
      addToast('The meeting host declined your request to join', 'error');
    });

    socketRef.current.on('join-request', (data) => {
      setJoinRequests((prev) => [...prev.filter(r => r.socketId !== data.socketId), data]);
      addToast(`${data.username} requested to join the meeting`, 'info');
    });

    socketRef.current.on('pending-join-requests-list', (list) => {
      setJoinRequests(list || []);
    });

    socketRef.current.on('cancel-join-request', (data) => {
      setJoinRequests((prev) => prev.filter(r => r.socketId !== data.candidateSocketId));
    });

    socketRef.current.on('media-state-changed', (data) => {
      const { socketId, audioEnabled, videoEnabled } = data;

      setParticipants((prev) => 
        prev.map(p => p.socketId === socketId ? { ...p, audioEnabled, videoEnabled } : p)
      );

      setVideos((prev) => 
        prev.map(v => v.socketId === socketId ? { ...v, audioEnabled, videoEnabled } : v)
      );

      if (audioEnabled === false) {
        setActiveSpeaker((curr) => curr === socketId ? null : curr);
      }
    });

    socketRef.current.on('chat-message', (data, sender, socketIdSender, translation) => {
      addMessage(data, sender, socketIdSender, translation);
    });

    socketRef.current.on('participant-count-updated', (data) => {
      setParticipantCount(data.count);
    });

    socketRef.current.on('active-speaker', (data) => {
      const { socketId, isSpeaking } = data;
      setParticipants((prev) => 
        prev.map(p => p.socketId === socketId ? { ...p, isSpeaking } : p)
      );
      if (isSpeaking) {
        setActiveSpeaker(socketId);
      } else {
        setActiveSpeaker((curr) => curr === socketId ? null : curr);
      }
    });

    socketRef.current.on('start-screen-share', (data) => {
      setSharingPresenter(data);
      addToast(`${data.username} started screen sharing`, 'info');
    });

    socketRef.current.on('stop-screen-share', (data) => {
      setSharingPresenter(null);
      addToast('Screen sharing stopped', 'info');
    });

    socketRef.current.on('screen-share-rejected', (msg) => {
      addToast(msg, 'error');
      setScreen(false);
    });

    socketRef.current.on('meeting-settings-updated', (settings) => {
      setHostId(settings.hostId);
      if (settings.chatPermission) setChatPermission(settings.chatPermission);
      setAllowPrivateMessages(settings.allowPrivateMessages || settings.chatPermission === 'Private');
      setAllowScreenShare(settings.allowScreenShare);
    });

    socketRef.current.on('chat-permission-updated', (data) => {
      if (data.chatPermission) setChatPermission(data.chatPermission);
      setAllowPrivateMessages(data.allowPrivateMessages || data.chatPermission === 'Private');
      addToast(`Chat permission updated to ${data.chatPermission || 'new setting'} by host`, 'info');
    });

    socketRef.current.on('meeting-ended', (data) => {
      addToast(data.message || "The host has ended this meeting.", "warning");
      setIsMeetingEnded(true);
      cleanUpMediaAndConnections();
      setTimeout(() => {
        navigate('/home');
      }, 1500);
    });

    socketRef.current.on('chat-error', (msg) => {
      addToast(msg, 'error');
    });

    socketRef.current.on('host-action-rejected', (msg) => {
      addToast(msg, 'error');
    });

    socketRef.current.on('private-chat-permission-updated', (data) => {
      setAllowPrivateMessages(data.allowPrivateMessages);
      addToast(`Private messaging ${data.allowPrivateMessages ? 'enabled' : 'disabled'} by host`, 'info');
    });

    // Private chat messaging events & unread notifications
    socketRef.current.on('private-message', (data) => {
      if (!data) return;

      // Rule 6: Do not show an unread notification to the sender for their own message
      if (data.senderSocketId === socketIdRef.current) return;

      const senderSocketId = data.senderSocketId;
      const senderUsername = data.senderUsername || 'Unknown';

      const newMsg = {
        id: Math.random().toString(),
        sender: senderUsername,
        socketId: senderSocketId,
        text: data.message,
        translated: data.translatedMessage,
        fromLang: data.fromLang,
        toLang: data.toLang,
        timestamp: new Date(data.timestamp || Date.now()),
        status: 'read'
      };

      setPrivateMessages((prev) => {
        const currentList = prev[senderSocketId] || [];
        return {
          ...prev,
          [senderSocketId]: [...currentList, newMsg]
        };
      });

      // Rule 7: If the private chat is already open and active with this sender, don't show duplicate notification
      const activeRecipient = privateChatRecipientRef.current;
      const isChatOpenWithSender = !!activeRecipient && (
        activeRecipient.socketId === senderSocketId ||
        (senderUsername && activeRecipient.username === senderUsername)
      );

      if (isChatOpenWithSender) {
        socketRef.current.emit('private-message-read', { toSocketId: senderSocketId });
      } else {
        // Rules 1, 2, 4: Increment unread count for this sender
        setUnreadPrivateMessages((prev) => {
          const currentCount = prev[senderSocketId] || 0;
          return {
            ...prev,
            [senderSocketId]: currentCount + 1
          };
        });

        // Rule 3: Small toast notification
        addToast(`New private message from ${senderUsername}`, 'info');
      }
    });

    socketRef.current.on('private-message-sent', (data) => {
      if (!data) return;
      const sentMsg = {
        id: Math.random().toString(),
        sender: username || user?.name || 'You',
        socketId: socketIdRef.current,
        text: data.message,
        timestamp: new Date(data.timestamp || Date.now()),
        status: 'sent'
      };
      setPrivateMessages((prev) => {
        const key = data.recipientSocketId;
        const currentList = prev[key] || [];
        return {
          ...prev,
          [key]: [...currentList, sentMsg]
        };
      });
    });

    socketRef.current.on('private-message-read', (data) => {
      if (!data || !data.senderSocketId) return;
      setPrivateMessages((prev) => {
        const peerId = data.senderSocketId;
        if (!prev[peerId]) return prev;
        return {
          ...prev,
          [peerId]: prev[peerId].map((msg) =>
            msg.socketId === socketIdRef.current ? { ...msg, status: 'read' } : msg
          )
        };
      });
    });

    socketRef.current.on('private-message-delivered', (data) => {
      if (!data || !data.recipientSocketId) return;
      setPrivateMessages((prev) => {
        const peerId = data.recipientSocketId;
        if (!prev[peerId]) return prev;
        return {
          ...prev,
          [peerId]: prev[peerId].map((msg) =>
            msg.socketId === socketIdRef.current && msg.status === 'sent'
              ? { ...msg, status: 'delivered' }
              : msg
          )
        };
      });
    });

    socketRef.current.on('screen-share-permission-updated', (data) => {
      setAllowScreenShare(data.allowScreenShare);
      addToast(`Screen sharing ${data.allowScreenShare ? 'enabled' : 'disabled'} by host`, 'info');
    });

    socketRef.current.on('mute-participant-request', () => {
      const audioTrack = window.localStream?.getAudioTracks()[0];
      if (audioTrack) audioTrack.enabled = false;
      setAudio(false);
      setActiveSpeaker((curr) => curr === socketIdRef.current ? null : curr);
      if (socketRef.current) {
        socketRef.current.emit("active-speaker", { isSpeaking: false, room: meetingCode });
        socketRef.current.emit("media-state-changed", {
          socketId: socketIdRef.current,
          videoEnabled: video,
          audioEnabled: false,
          room: meetingCode
        });
      }
      addToast('You have been muted by the host', 'warning');
    });

    socketRef.current.on('remove-participant-request', () => {
      addToast('You have been removed from the meeting by the host', 'error');
      cleanUpMediaAndConnections();
      setTimeout(() => {
        navigate('/home');
      }, 1500);
    });

    socketRef.current.on('raise-hand', (data) => {
      const { socketId, isHandRaised } = data;
      setParticipants((prev) => 
        prev.map(p => p.socketId === socketId ? { ...p, isHandRaised } : p)
      );
      if (isHandRaised) {
        const targetSid = socketId === socketIdRef.current ? 'local' : socketId;
        triggerReactionFloater('✋', 'Hand Raised', targetSid);
      }
    });

    socketRef.current.on('chat-message-reaction', (data) => {
      const { emoji, sender, socketId } = data;
      const targetSid = socketId === socketIdRef.current ? 'local' : socketId;
      triggerReactionFloater(emoji, sender, targetSid || 'local');
    });

    socketRef.current.on('user-info-update', (infoList) => {
      const uniqueInfoList = (infoList || []).filter((item, index, self) =>
        index === self.findIndex((t) => t.socketId === item.socketId)
      );
      setParticipants(uniqueInfoList);
      setVideos((prevVideos) =>
        prevVideos.map(vid => {
          const info = uniqueInfoList.find(p => p.socketId === vid.socketId);
          if (info) {
            return {
              ...vid,
              audioEnabled: info.audioEnabled !== undefined ? info.audioEnabled : vid.audioEnabled,
              videoEnabled: info.videoEnabled !== undefined ? info.videoEnabled : vid.videoEnabled
            };
          }
          return vid;
        })
      );
    });

    socketRef.current.on('user-left', (id) => {
      if (connectionsRef.current[id]) {
        try {
          connectionsRef.current[id].ontrack = null;
          connectionsRef.current[id].onicecandidate = null;
          connectionsRef.current[id].onaddstream = null;
          connectionsRef.current[id].close();
        } catch (e) {}
        delete connectionsRef.current[id];
      }
      setVideos((previous) => {
        const updatedVideos = previous.filter((video) => video.socketId !== id);
        videoRef.current = updatedVideos;
        return updatedVideos;
      });
      setParticipants((prev) => prev.filter((p) => p.socketId !== id));
      setActiveSpeaker((curr) => curr === id ? null : curr);
      addToast('A participant left the meeting', 'info');
    });

    socketRef.current.on('user-joined', (id, clients) => {
      addToast('A participant joined the meeting', 'success');

      // Re-broadcast register & current media state to sync with new participant
      socketRef.current.emit('user-info-register', {
        username: username || user?.name || "Guest",
        preferredLanguage: lobbyLanguage || preferredLanguage || "en",
        room: meetingCode,
        audioEnabled: audio,
        videoEnabled: video
      });

      socketRef.current.emit('media-state-changed', {
        socketId: socketIdRef.current,
        audioEnabled: audio,
        videoEnabled: video,
        room: meetingCode
      });

      clients.forEach((socketListId) => {
        if (socketListId === socketIdRef.current) return;
        const pc = createPeerConnection(socketListId);
        if (pc && window.localStream) {
          const senders = pc.getSenders ? pc.getSenders() : [];
          window.localStream.getTracks().forEach((track) => {
            const alreadyAdded = senders.some((s) => s.track === track || (s.track && s.track.kind === track.kind));
            if (!alreadyAdded) {
              try {
                pc.addTrack(track, window.localStream);
              } catch (e) {
                console.error("[WEBRTC] user-joined addTrack error:", e);
              }
            }
          });
        }
      });

      // Joining peer initiates offer to all established peers
      if (id === socketIdRef.current) {
        for (let id2 in connectionsRef.current) {
          if (id2 === socketIdRef.current) continue;
          const pc = connectionsRef.current[id2];
          if (!pc || pc.signalingState !== 'stable') continue;

          pc._makingOffer = true;
          pc.createOffer()
            .then((description) => pc.setLocalDescription(description))
            .then(() => {
              socketRef.current?.emit('signal', id2, JSON.stringify({ sdp: pc.localDescription }));
            })
            .catch((e) => console.error("[WEBRTC] createOffer error:", e))
            .finally(() => {
              pc._makingOffer = false;
            });
        }
      }
    });
  };

  const silence = () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      const ctx = new AudioCtx();
      const oscillator = ctx.createOscillator();
      const dst = ctx.createMediaStreamDestination();
      oscillator.connect(dst);
      oscillator.start();
      const track = dst.stream.getAudioTracks()[0];
      if (track) {
        track.enabled = false;
        setTimeout(() => {
          try { ctx.close(); } catch (e) {}
        }, 500);
        return track;
      }
    } catch (e) {
      console.warn("silence helper error:", e);
    }
    return null;
  };

  const black = ({ width = 640, height = 480 } = {}) => {
    try {
      const canvas = Object.assign(document.createElement('canvas'), { width, height });
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.fillRect(0, 0, width, height);
      const stream = canvas.captureStream ? canvas.captureStream(10) : null;
      if (stream && stream.getVideoTracks()[0]) {
        const track = stream.getVideoTracks()[0];
        track.enabled = false;
        return track;
      }
    } catch (e) {
      console.warn("black helper error:", e);
    }
    return null;
  };

  const handleVideo = async () => {
    const newVideoState = !video;
    setVideo(newVideoState);
    if (window.localStream) {
      const videoTrack = window.localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = newVideoState;
      } else if (newVideoState && navigator.mediaDevices?.getUserMedia) {
        try {
          const fresh = await navigator.mediaDevices.getUserMedia({
            video: selectedVideo ? { deviceId: { exact: selectedVideo } } : true
          });
          const newTrack = fresh.getVideoTracks()[0];
          if (newTrack) {
            window.localStream.addTrack(newTrack);
            for (let id in connectionsRef.current) {
              const pc = connectionsRef.current[id];
              if (pc && pc.signalingState !== 'closed') {
                const senders = pc.getSenders ? pc.getSenders() : [];
                const vSender = senders.find(s => s.track && s.track.kind === 'video');
                if (vSender) {
                  await vSender.replaceTrack(newTrack);
                } else {
                  pc.addTrack(newTrack, window.localStream);
                }
              }
            }
          }
        } catch (e) {
          handleMediaError(e, 'camera');
        }
      }
    }
    if (socketRef.current) {
      socketRef.current.emit("media-state-changed", {
        socketId: socketIdRef.current,
        videoEnabled: newVideoState,
        audioEnabled: audio,
        room: meetingCode
      });
    }
  };

  const handleAudio = async () => {
    const newAudioState = !audio;
    setAudio(newAudioState);
    if (window.localStream) {
      const audioTrack = window.localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = newAudioState;
      } else if (newAudioState && navigator.mediaDevices?.getUserMedia) {
        try {
          const fresh = await navigator.mediaDevices.getUserMedia({
            audio: selectedAudio ? { deviceId: { exact: selectedAudio } } : true
          });
          const newTrack = fresh.getAudioTracks()[0];
          if (newTrack) {
            window.localStream.addTrack(newTrack);
            for (let id in connectionsRef.current) {
              const pc = connectionsRef.current[id];
              if (pc && pc.signalingState !== 'closed') {
                const senders = pc.getSenders ? pc.getSenders() : [];
                const aSender = senders.find(s => s.track && s.track.kind === 'audio');
                if (aSender) {
                  await aSender.replaceTrack(newTrack);
                } else {
                  pc.addTrack(newTrack, window.localStream);
                }
              }
            }
          }
        } catch (e) {
          handleMediaError(e, 'microphone');
        }
      }
    }
    if (!newAudioState) {
      setActiveSpeaker((curr) => curr === socketIdRef.current ? null : curr);
      if (socketRef.current) {
        socketRef.current.emit("active-speaker", { isSpeaking: false, room: meetingCode });
      }
    }
    if (socketRef.current) {
      socketRef.current.emit("media-state-changed", {
        socketId: socketIdRef.current,
        videoEnabled: video,
        audioEnabled: newAudioState,
        room: meetingCode
      });
    }
  };

  useEffect(() => {
    if (screen !== undefined) {
      getDisplayMedia();
    }
  }, [screen]);

  const handleScreen = () => {
    if (!screen) {

      if (!allowScreenShare && !isCurrentUserHost) {
        addToast("Screen sharing has been disabled by the host.", "error");
        return;
      }
      if (sharingPresenter) {
        addToast("Another participant is currently sharing their screen.", "error");
        return;
      }
      setScreen(true);
    } else {
      setScreen(false);
    }
  };

  const handleRaiseHand = () => {
    const nextHandState = !isHandRaised;
    setIsHandRaised(nextHandState);
    if (socketRef.current) {
      socketRef.current.emit("raise-hand", { isHandRaised: nextHandState, room: meetingCode });
    }
    setParticipants((prev) => 
      prev.map(p => p.socketId === socketIdRef.current ? { ...p, isHandRaised: nextHandState } : p)
    );
    if (nextHandState) {
      triggerReactionFloater('✋', username || "Me", 'local');
    }
    addToast(nextHandState ? "Hand raised" : "Hand lowered", "info");
  };

  const triggerReactionFloater = (emoji, sender, targetSocketId = 'local') => {
    const count = Math.floor(Math.random() * 6) + 5; // Spawns 5 to 10 popping emojis
    const burst = [];
    const now = Date.now();
    for (let i = 0; i < count; i++) {
      burst.push({
        id: `${now}-${i}-${Math.random()}`,
        emoji,
        sender,
        targetSocketId,
        left: 10 + Math.random() * 75,
        size: (1.6 + Math.random() * 1.2).toFixed(2) + 'rem',
        delay: (i * 70 + Math.random() * 80).toFixed(0) + 'ms',
        duration: (1.8 + Math.random() * 0.7).toFixed(2) + 's'
      });
    }
    setReactionsList((prev) => [...prev, ...burst]);
    setTimeout(() => {
      const burstIds = new Set(burst.map((b) => b.id));
      setReactionsList((prev) => prev.filter((r) => !burstIds.has(r.id)));
    }, 3200);
  };

  const sendReaction = (emoji) => {
    if (socketRef.current) {
      socketRef.current.emit("chat-message-reaction", { emoji, room: meetingCode });
      triggerReactionFloater(emoji, username || "Me", 'local');
    }
  };

  const handleHostMuteParticipant = (targetSocketId) => {
    if (socketRef.current) {
      socketRef.current.emit("mute-participant", { toSocketId: targetSocketId, room: meetingCode });
      addToast("Requested participant muting", "success");
    }
  };

  const handleHostRemoveParticipant = (targetSocketId) => {
    if (socketRef.current) {
      socketRef.current.emit("remove-participant", { toSocketId: targetSocketId, room: meetingCode });
      addToast("Requested participant removal", "success");
    }
  };

  const handleEndCallForEveryone = () => {
    if (socketRef.current) {
      socketRef.current.emit("end-meeting-everyone", { room: meetingCode });
    }
    handleEndCall();
  };

  const cleanUpMediaAndConnections = () => {
    isMeetingActiveRef.current = false;
    if (isCleanedUpRef.current) return;
    isCleanedUpRef.current = true;

    // Remove hardware devicechange listener immediately to avoid re-triggering device enumeration
    if (navigator.mediaDevices && deviceChangeHandlerRef.current) {
      try {
        navigator.mediaDevices.removeEventListener('devicechange', deviceChangeHandlerRef.current);
      } catch (e) {}
      deviceChangeHandlerRef.current = null;
    }

    // Stop active recording if in progress
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {}
    }

    const stopTrackSafely = (track) => {
      if (!track) return;
      try {
        track.enabled = false;
        track.stop();
      } catch (e) {}
    };

    // 1. Stop all tracks in localStreamRef
    if (localStreamRef.current) {
      try {
        localStreamRef.current.getTracks().forEach(stopTrackSafely);
      } catch (e) {
        console.log("Error stopping localStreamRef tracks:", e);
      }
      localStreamRef.current = null;
    }

    // 2. Stop all tracks in window.localStream
    if (window.localStream) {
      try {
        window.localStream.getTracks().forEach(stopTrackSafely);
      } catch (e) {
        console.log("Error stopping window.localStream tracks:", e);
      }
      window.localStream = null;
    }

    // 3. Clear local video ref srcObject and stop its tracks
    if (localVideoRef.current && localVideoRef.current.srcObject) {
      try {
        const stream = localVideoRef.current.srcObject;
        if (stream && typeof stream.getTracks === 'function') {
          stream.getTracks().forEach(stopTrackSafely);
        }
      } catch (e) {}
      localVideoRef.current.srcObject = null;
    }

    // 4. Clear remote video and audio elements srcObject and stop tracks
    try {
      const mediaElements = document.querySelectorAll('video, audio');
      mediaElements.forEach((v) => {
        if (v.srcObject) {
          try {
            if (typeof v.srcObject.getTracks === 'function') {
              v.srcObject.getTracks().forEach(stopTrackSafely);
            }
          } catch (e) {}
          v.srcObject = null;
        }
      });
    } catch (e) {}

    // 5. Stop any tracks remaining in videoRef.current
    if (Array.isArray(videoRef.current)) {
      videoRef.current.forEach((v) => {
        if (v && v.stream && typeof v.stream.getTracks === 'function') {
          v.stream.getTracks().forEach(stopTrackSafely);
        }
      });
      videoRef.current = [];
    }

    // 6. Stop all senders and close all RTCPeerConnection instances
    for (let id in connectionsRef.current) {
      const pc = connectionsRef.current[id];
      if (pc) {
        try {
          if (pc.getSenders) {
            pc.getSenders().forEach((sender) => {
              if (sender && sender.track) {
                stopTrackSafely(sender.track);
              }
            });
          }
          pc.ontrack = null;
          pc.onicecandidate = null;
          pc.onaddstream = null;
          pc.oniceconnectionstatechange = null;
          pc.onsignalingstatechange = null;
          pc.close();
        } catch (e) {
          console.log("Error closing peer connection:", e);
        }
      }
    }
    connectionsRef.current = {};

    // 7. Disconnect Socket.IO instance and remove listeners
    if (socketRef.current) {
      try {
        socketRef.current.off("user-joined");
        socketRef.current.off("user-left");
        socketRef.current.off("signal");
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
      } catch (e) {
        console.log("Error disconnecting socket:", e);
      }
      socketRef.current = null;
    }

    // 8. Clean up audio context and voice detection frames
    if (voiceDetectionFrameRef.current) {
      cancelAnimationFrame(voiceDetectionFrameRef.current);
      voiceDetectionFrameRef.current = null;
    }
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch (e) {}
      audioContextRef.current = null;
    }

    // 9. Reset state variables
    setVideo(false);
    setAudio(false);
    setScreen(false);
    setVideos([]);
    setParticipants([]);
    setJoinRequests([]);
    setIsWaitingForHostApproval(false);
    setIsJoinRejected(false);
  };

  const handleEndCall = () => {
    cleanUpMediaAndConnections();
    addToast('Meeting ended', 'info');
    navigate('/home');
  };

  const addMessage = (data, sender, socketIdSender, translation) => {
    setMessages((prevMessages) => [...prevMessages, { sender, data, socketIdSender, translation }]);
    if (socketIdSender !== socketIdRef.current) {
      setNewMessages((prev) => prev + 1);
    }
  };

  const sendMessage = () => {
    if (!message.trim()) return;
    socketRef.current.emit('chat-message', message, username);
    setMessage('');
  };

  const connect = () => {
    if (!username.trim()) {
      addToast('Please enter a username to join', 'error');
      return;
    }
    setAskForUsername(false);
    getMedia();
  };

  return (
    <div style={{ background: '#090D1A', minHeight: '100vh', display: 'flex', flexDirection: 'column', color: '#F8FAFC' }}>
      <style>{`
        .speaking {
            border: 3px solid #22c55e !important;
            box-shadow: 0 0 15px rgba(34, 197, 94, 0.7) !important;
            transition: border 0.2s ease, box-shadow 0.2s ease;
        }
        @keyframes emojiPopTile {
          0% {
            transform: translateY(20px) scale(0.3) rotate(0deg);
            opacity: 0;
          }
          25% {
            transform: translateY(-20px) scale(1.35) rotate(-12deg);
            opacity: 1;
          }
          65% {
            transform: translateY(-90px) scale(1.15) rotate(12deg);
            opacity: 0.9;
          }
          100% {
            transform: translateY(-220px) scale(0.7) rotate(-15deg);
            opacity: 0;
          }
        }
        @keyframes floatUp {
          0% {
            transform: translateY(0) scale(0.5);
            opacity: 0;
          }
          10% {
            opacity: 1;
            transform: translateY(-20px) scale(1.1);
          }
          90% {
            opacity: 0.8;
          }
          100% {
            transform: translateY(-280px) scale(0.85);
            opacity: 0;
          }
        }
        @keyframes pulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.03); }
          100% { transform: scale(1); }
        }
      `}</style>
      {isMeetingEnded ? (
        /* Meeting Ended Screen */
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', background: 'radial-gradient(circle at center, rgba(239, 68, 68, 0.08), transparent 70%)' }}>
          <Card style={{ background: '#111827', borderColor: '#1F2937', width: '100%', maxWidth: '580px', padding: '40px 32px', textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }} className="scale-up">
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.15)', color: '#EF4444', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px auto' }}>
              <PhoneOff size={32} />
            </div>
            <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#F9FAFB', margin: '0 0 8px 0' }}>Meeting Ended</h2>
            <p style={{ color: '#9CA3AF', fontSize: '0.95rem', lineHeight: 1.5, marginBottom: '28px' }}>
              The host has ended this meeting. You can no longer join this session.
            </p>
            <Button variant="primary" onClick={() => navigate('/home')} iconRight={<ArrowRight size={16} />}>
              Back to Dashboard
            </Button>
          </Card>
        </div>
      ) : isWaitingForSchedule ? (
        /* Scheduled Meeting Waiting & Countdown Screen */
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', background: 'radial-gradient(circle at center, rgba(14, 113, 235, 0.08), transparent 70%)' }}>
          <Card style={{ background: '#111827', borderColor: '#1F2937', width: '100%', maxWidth: '680px', padding: '36px', textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }} className="scale-up">
            
            {/* Top Header Badge */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 16px', background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '30px', color: '#F59E0B', fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.02em', marginBottom: '20px' }}>
              <Clock size={16} /> Scheduled Meeting
            </div>

            <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#F9FAFB', letterSpacing: '-0.02em', margin: '0 0 8px 0' }}>
              {meetingDetails?.title || "Upcoming Scheduled Meeting"}
            </h2>

            <p style={{ color: '#9CA3AF', fontSize: '0.92rem', marginBottom: '28px' }}>
              Meeting ID: <strong style={{ color: 'var(--primary)' }}>{meetingCode}</strong>
            </p>

            {/* Countdown Box */}
            <div style={{ background: '#090D1A', border: '1px solid #374151', borderRadius: 'var(--radius-lg)', padding: '28px 20px', marginBottom: '28px' }}>
              <div style={{ fontSize: '0.8rem', color: '#9CA3AF', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '18px' }}>
                Meeting starts in
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: '#111827', border: '1px solid #1F2937', padding: '14px 20px', borderRadius: '12px', minWidth: '80px' }}>
                  <span style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--primary)', fontFamily: 'monospace' }}>
                    {String(countdownTime.days).padStart(2, '0')}
                  </span>
                  <span style={{ fontSize: '0.7rem', color: '#9CA3AF', textTransform: 'uppercase', marginTop: '4px', fontWeight: 600 }}>Days</span>
                </div>

                <span style={{ fontSize: '1.8rem', fontWeight: 700, color: '#374151' }}>:</span>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: '#111827', border: '1px solid #1F2937', padding: '14px 20px', borderRadius: '12px', minWidth: '80px' }}>
                  <span style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--primary)', fontFamily: 'monospace' }}>
                    {String(countdownTime.hours).padStart(2, '0')}
                  </span>
                  <span style={{ fontSize: '0.7rem', color: '#9CA3AF', textTransform: 'uppercase', marginTop: '4px', fontWeight: 600 }}>Hours</span>
                </div>

                <span style={{ fontSize: '1.8rem', fontWeight: 700, color: '#374151' }}>:</span>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: '#111827', border: '1px solid #1F2937', padding: '14px 20px', borderRadius: '12px', minWidth: '80px' }}>
                  <span style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--primary)', fontFamily: 'monospace' }}>
                    {String(countdownTime.minutes).padStart(2, '0')}
                  </span>
                  <span style={{ fontSize: '0.7rem', color: '#9CA3AF', textTransform: 'uppercase', marginTop: '4px', fontWeight: 600 }}>Minutes</span>
                </div>

                <span style={{ fontSize: '1.8rem', fontWeight: 700, color: '#374151' }}>:</span>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: '#111827', border: '1px solid #1F2937', padding: '14px 20px', borderRadius: '12px', minWidth: '80px' }}>
                  <span style={{ fontSize: '2rem', fontWeight: 800, color: '#10B981', fontFamily: 'monospace' }}>
                    {String(countdownTime.seconds).padStart(2, '0')}
                  </span>
                  <span style={{ fontSize: '0.7rem', color: '#9CA3AF', textTransform: 'uppercase', marginTop: '4px', fontWeight: 600 }}>Seconds</span>
                </div>
              </div>

              {meetingDetails?.scheduledStartTime && (
                <div style={{ marginTop: '24px', paddingTop: '18px', borderTop: '1px solid #1F2937', fontSize: '0.9rem', color: '#E5E7EB' }}>
                  <strong>Scheduled for:</strong> {new Date(meetingDetails.scheduledStartTime).toLocaleDateString(undefined, { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })}, {new Date(meetingDetails.scheduledStartTime).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '14px', flexWrap: 'wrap' }}>
              <Button
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(window.location.href);
                  addToast("Meeting link copied to clipboard", "success");
                }}
                iconLeft={<Copy size={16} />}
              >
                Copy Meeting Link
              </Button>
              <Button variant="outline" onClick={() => navigate('/home')}>
                Back to Dashboard
              </Button>
            </div>
          </Card>
        </div>
      ) : isWaitingForHostApproval ? (
        /* Waiting Room UI */
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', background: 'radial-gradient(circle at center, rgba(14, 113, 235, 0.08), transparent 70%)' }}>
          <Card style={{ background: '#111827', borderColor: '#1F2937', width: '100%', maxWidth: '520px', padding: '40px 32px', textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }} className="scale-up">
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(14, 113, 235, 0.15)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px auto' }}>
              <Clock size={32} />
            </div>
            <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#F9FAFB', margin: '0 0 8px 0' }}>Waiting for host to let you in</h2>
            <p style={{ color: '#9CA3AF', fontSize: '0.92rem', lineHeight: 1.5, marginBottom: '28px' }}>
              You've requested to join <strong>{meetingCode}</strong>. The host has been notified.
            </p>
            <Button variant="outline" onClick={handleCancelMyJoinRequest}>
              Cancel Request
            </Button>
          </Card>
        </div>
      ) : isJoinRejected ? (
        /* Request Declined UI */
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', background: 'radial-gradient(circle at center, rgba(239, 68, 68, 0.08), transparent 70%)' }}>
          <Card style={{ background: '#111827', borderColor: '#1F2937', width: '100%', maxWidth: '520px', padding: '40px 32px', textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }} className="scale-up">
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.15)', color: '#EF4444', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px auto' }}>
              <X size={32} />
            </div>
            <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#F9FAFB', margin: '0 0 8px 0' }}>Request Declined</h2>
            <p style={{ color: '#9CA3AF', fontSize: '0.92rem', lineHeight: 1.5, marginBottom: '28px' }}>
              The meeting host declined your request to join this session.
            </p>
            <Button variant="primary" onClick={() => { setIsJoinRejected(false); setAskForUsername(true); }}>
              Back to Lobby
            </Button>
          </Card>
        </div>
      ) : askForUsername ? (
        /* Pre-join Lobby UI */
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', background: 'radial-gradient(circle at center, rgba(14, 113, 235, 0.05), transparent 70%)' }}>
          <Card style={{ background: '#111827', borderColor: '#1F2937', width: '100%', maxWidth: '850px', padding: '36px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }} className="scale-up">
            
            <style>{`
              .lobby-grid {
                display: grid;
                grid-template-columns: 1fr;
                gap: 32px;
                text-align: left;
              }
              @media (min-width: 700px) {
                .lobby-grid {
                  grid-template-columns: 1.1fr 0.9fr;
                }
              }
            `}</style>

            <div className="lobby-grid">
              {/* Left Column: Video Preview and Hardware Configuration */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ position: 'relative', width: '100%', height: '240px', background: '#090D1A', borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: '1px solid #374151' }}>
                  <video
                    ref={(el) => {
                      localVideoRef.current = el;
                      const stream = localStreamRef.current || window.localStream;
                      if (el && stream && el.srcObject !== stream) {
                        el.srcObject = stream;
                        el.play().catch((err) => {
                          console.warn("[Lobby Video] play error:", err);
                        });
                      }
                    }}
                    autoPlay
                    muted
                    playsInline
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  <div style={{ position: 'absolute', bottom: '12px', left: '12px', background: 'rgba(9, 13, 26, 0.85)', padding: '6px 12px', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', color: '#F3F4F6', border: '1px solid #1F2937' }}>
                    📹 Video Preview
                  </div>
                </div>

                {/* Device Selector Selection Cards */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: '#9CA3AF', fontWeight: 700, letterSpacing: '0.02em', textTransform: 'uppercase' }}>Select Camera</label>
                    <select
                      value={selectedVideo}
                      onChange={(e) => setSelectedVideo(e.target.value)}
                      style={{ width: '100%', padding: '10px 14px', background: '#090D1A', border: '1px solid #374151', borderRadius: 'var(--radius-md)', color: '#F9FAFB', outline: 'none', fontSize: '0.85rem', marginTop: '6px', cursor: 'pointer' }}
                    >
                      {videoDevices.length > 0 ? videoDevices.map((d) => (
                        <option key={d.deviceId} value={d.deviceId}>{d.label || `Camera (${d.deviceId.slice(0, 5)})`}</option>
                      )) : <option value="">No cameras found</option>}
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.75rem', color: '#9CA3AF', fontWeight: 700, letterSpacing: '0.02em', textTransform: 'uppercase' }}>Select Microphone</label>
                    <select
                      value={selectedAudio}
                      onChange={(e) => setSelectedAudio(e.target.value)}
                      style={{ width: '100%', padding: '10px 14px', background: '#090D1A', border: '1px solid #374151', borderRadius: 'var(--radius-md)', color: '#F9FAFB', outline: 'none', fontSize: '0.85rem', marginTop: '6px', cursor: 'pointer' }}
                    >
                      {audioDevices.length > 0 ? audioDevices.map((d) => (
                        <option key={d.deviceId} value={d.deviceId}>{d.label || `Microphone (${d.deviceId.slice(0, 5)})`}</option>
                      )) : <option value="">No microphones found</option>}
                    </select>
                  </div>
                </div>
              </div>

              {/* Right Column: Connection settings and name inputs */}
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '24px' }}>
                <div>
                  <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#F9FAFB', letterSpacing: '-0.02em' }}>Ready to join?</h2>
                  <p style={{ color: '#9CA3AF', fontSize: '0.9rem', marginTop: '6px' }}>
                    Meeting Room Code: <strong style={{ color: 'var(--primary)' }}>{meetingCode}</strong>
                  </p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: '#9CA3AF', fontWeight: 700, letterSpacing: '0.02em', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Display Name</label>
                    <input
                      type="text"
                      placeholder="Enter your name to join"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        background: '#090D1A',
                        border: '1px solid #374151',
                        borderRadius: 'var(--radius-md)',
                        color: '#F9FAFB',
                        fontSize: '0.95rem',
                        outline: 'none',
                        transition: 'border-color 0.2s'
                      }}
                      onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
                      onBlur={(e) => e.target.style.borderColor = '#374151'}
                    />
                  </div>

                  <LanguageSelector
                    value={lobbyLanguage}
                    onChange={(lang) => {
                      setLobbyLanguage(lang);
                      localStorage.setItem('preferredLanguage', lang);
                    }}
                    label="Auto Translation Language"
                  />

                  <Button onClick={connect} variant="primary" width="100%" style={{ padding: '12px 20px', borderRadius: '30px', fontWeight: 700, marginTop: '8px' }}>
                    Join Meeting
                  </Button>
                </div>
              </div>
            </div>

          </Card>
        </div>
      ) : (
        /* Video Meet Workspace */
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#090D1A', position: 'relative' }}>
          
          {/* Host Floating Join Requests Banner */}
          {isCurrentUserHost && joinRequests.length > 0 && (
            <div style={{
              position: 'fixed',
              top: '20px',
              right: '20px',
              zIndex: 2500,
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              maxWidth: '360px',
              width: '90%'
            }} className="slide-in">
              {joinRequests.map((req) => (
                <div key={req.socketId} style={{
                  background: '#111827',
                  border: '1px solid var(--primary)',
                  borderRadius: '16px',
                  padding: '16px',
                  boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, var(--primary), var(--accent))',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      fontSize: '1rem',
                      flexShrink: 0
                    }}>
                      {req.username.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                      <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#F9FAFB', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{req.username}</div>
                      <div style={{ fontSize: '0.75rem', color: '#9CA3AF' }}>Wants to join this meeting</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <Button
                      variant="primary"
                      onClick={() => handleApproveJoinRequest(req.socketId)}
                      style={{ flex: 1, padding: '6px 12px', fontSize: '0.8rem', fontWeight: 700, borderRadius: '8px' }}
                    >
                      Admit
                    </Button>
                    <Button
                      variant="danger"
                      onClick={() => handleRejectJoinRequest(req.socketId)}
                      style={{ flex: 1, padding: '6px 12px', fontSize: '0.8rem', fontWeight: 700, borderRadius: '8px' }}
                    >
                      Decline
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {/* Top Bar Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 24px',
            background: 'rgba(17, 24, 39, 0.85)',
            backdropFilter: 'blur(16px)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
            zIndex: 10
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#F9FAFB', letterSpacing: '-0.01em' }}>Meeting: {meetingCode}</span>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '0.7rem',
                fontWeight: 700,
                background: 'rgba(16, 185, 129, 0.12)',
                color: 'var(--secondary)',
                padding: '2px 8px',
                borderRadius: '12px',
                border: '1px solid rgba(16, 185, 129, 0.2)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                🔒 Encrypted
              </span>
              {hostId && (
                <span style={{ fontSize: '0.8rem', color: '#9CA3AF', marginLeft: '8px' }}>
                  Host: <strong style={{ color: '#F3F4F6' }}>{hostId}</strong>
                </span>
              )}
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: '#9CA3AF', fontWeight: 600 }}>
                <Clock size={14} style={{ color: 'var(--primary)' }} />
                <span>{formatDuration(meetingDuration)}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: '#9CA3AF', fontWeight: 600 }}>
                <Users size={14} style={{ color: 'var(--accent)' }} />
                <span>{participants.length} Participants</span>
              </div>
            </div>
          </div>

          {/* Autoplay blocked banner */}
          {isAudioAutoplayBlocked && (
            <div
              onClick={() => {
                document.querySelectorAll('audio, video').forEach((el) => {
                  el.play().catch(() => {});
                });
                setIsAudioAutoplayBlocked(false);
              }}
              style={{
                background: 'linear-gradient(90deg, #EF4444, #F59E0B)',
                color: '#FFFFFF',
                padding: '10px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.9rem',
                zIndex: 40,
                boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)'
              }}
            >
              <span>🔇 Remote audio may be muted by browser autoplay policy. <strong>Click anywhere here to enable audio</strong></span>
            </div>
          )}

          {/* Main workspace (video and side panel) */}
          <div style={{ flex: 1, display: 'flex', position: 'relative', overflow: 'hidden' }}>
            
            {/* Left panel: videos */}
            <div style={{ flex: 1, padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', justifyContent: 'center', overflowY: 'auto', position: 'relative' }}>
              
              {/* Adaptive Grid Layout */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: (videos.length + 1) === 1 ? '1fr' : (videos.length + 1) === 2 ? '1fr 1fr' : 'repeat(auto-fit, minmax(320px, 1fr))',
                gap: '20px',
                maxWidth: (videos.length + 1) <= 2 ? '900px' : (videos.length + 1) <= 4 ? '1000px' : '1200px',
                width: '100%',
                margin: '0 auto',
                alignItems: 'center',
                justifyContent: 'center',
                flex: 1
              }}>
                
                {/* Local Participant Tile */}
                <div 
                  onClick={() => setPinnedParticipant(pinnedParticipant === 'local' ? null : 'local')}
                  style={{
                    position: 'relative',
                    borderRadius: 'var(--radius-lg)',
                    overflow: 'hidden',
                    background: '#111827',
                    border: '1px solid #1F2937',
                    boxShadow: 'var(--shadow)',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    aspectRatio: '16/9',
                    cursor: 'pointer'
                  }}
                  className={`videoTile ${audio && activeSpeaker === socketIdRef.current ? 'speaking' : ''}`}
                >
                  <video
                    ref={(el) => {
                      localVideoRef.current = el;
                      const stream = localStreamRef.current || window.localStream;
                      if (el && stream && el.srcObject !== stream) {
                        el.srcObject = stream;
                        el.play().catch((err) => {
                          console.warn("[Local Video] play error:", err);
                        });
                      }
                    }}
                    autoPlay
                    muted
                    playsInline
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      display: video ? 'block' : 'none'
                    }}
                  />
                  {!video && (
                    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0F172A', gap: '16px' }}>
                      <div style={{
                        width: '70px',
                        height: '70px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, var(--primary), var(--accent))',
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.8rem',
                        fontWeight: 700,
                        boxShadow: 'var(--shadow-lg)'
                      }}>
                        {username.charAt(0).toUpperCase()}
                      </div>
                      <span style={{ fontSize: '0.85rem', color: '#9CA3AF', fontWeight: 600 }}>Camera Disabled</span>
                    </div>
                  )}
                  
                  {/* Badges Overlays */}
                  <div style={{ position: 'absolute', top: '12px', left: '12px', display: 'flex', gap: '8px', zIndex: 5 }}>
                    {screen && (
                      <span style={{ background: 'var(--primary)', color: '#ffffff', padding: '4px 8px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                        <Monitor size={12} /> Presenting
                      </span>
                    )}
                    {isHandRaised && (
                      <span style={{ background: '#F59E0B', color: '#090D1A', padding: '4px 8px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 750, display: 'flex', alignItems: 'center', gap: '4px', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                        ✋ Raised Hand
                      </span>
                    )}
                  </div>

                  <div style={{ position: 'absolute', bottom: '12px', left: '12px', background: 'rgba(9, 13, 26, 0.8)', padding: '6px 12px', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', fontWeight: 600, border: '1px solid rgba(255,255,255,0.06)' }}>
                    {username} (You)
                  </div>

                  {/* Popping Emoji Burst Overlay for Local Participant Tile */}
                  <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 30, overflow: 'hidden' }}>
                    {reactionsList.filter(r => r.targetSocketId === 'local' || r.targetSocketId === socketIdRef.current).map((react) => (
                      <div
                        key={react.id}
                        style={{
                          position: 'absolute',
                          left: `${react.left}%`,
                          bottom: '10px',
                          fontSize: react.size,
                          animation: `emojiPopTile ${react.duration} ease-out forwards`,
                          animationDelay: react.delay,
                          zIndex: 35,
                          filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.5))'
                        }}
                      >
                        {react.emoji}
                      </div>
                    ))}
                  </div>

                  <div style={{ position: 'absolute', bottom: '12px', right: '12px', zIndex: 5 }}>
                    {!audio && (
                      <span style={{ background: '#EF4444', color: '#ffffff', width: '26px', height: '26px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <MicOff size={13} />
                      </span>
                    )}
                  </div>
                </div>

                {/* Remote Participant Tiles */}
                {videos.map((vid) => {
                  const participantInfo = participants.find(p => p.socketId === vid.socketId);
                  const peerName = participantInfo?.username || `Peer (${vid.socketId.slice(0, 5)})`;
                  const peerVideoActive = participantInfo?.videoEnabled !== undefined
                    ? participantInfo.videoEnabled
                    : (vid.videoEnabled !== undefined ? vid.videoEnabled : true);
                  const peerAudioActive = participantInfo?.audioEnabled !== undefined
                    ? participantInfo.audioEnabled
                    : (vid.audioEnabled !== undefined ? vid.audioEnabled : true);
                  const isSpeaking = peerAudioActive && (activeSpeaker === vid.socketId || participantInfo?.isSpeaking);
                  const isPresenter = sharingPresenter?.socketId === vid.socketId;
                  const handRaised = participantInfo?.isHandRaised;

                  return (
                    <div 
                      key={vid.socketId} 
                      onClick={() => setPinnedParticipant(pinnedParticipant === vid.socketId ? null : vid.socketId)}
                      style={{
                        position: 'relative',
                        borderRadius: 'var(--radius-lg)',
                        overflow: 'hidden',
                        background: '#111827',
                        border: '1px solid #1F2937',
                        boxShadow: 'var(--shadow)',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        aspectRatio: '16/9',
                        cursor: 'pointer'
                      }}
                      className={`videoTile ${isSpeaking ? 'speaking' : ''}`}
                    >
                      {/* Dedicated Audio Element for Remote Stream - Always mounted */}
                      <audio
                        data-socket={vid.socketId}
                        ref={(ref) => {
                          if (ref && vid.stream) {
                            if (ref.srcObject !== vid.stream) {
                              ref.srcObject = vid.stream;
                            }
                            ref.play().catch((err) => {
                              console.warn(`[Audio] Remote audio autoplay blocked for peer ${vid.socketId}:`, err);
                              setIsAudioAutoplayBlocked(true);
                            });
                          }
                        }}
                        autoPlay
                        playsInline
                      />

                      {/* Remote Video Element - Muted so video stream is never blocked by browser audio autoplay policy */}
                      <video
                        data-socket={vid.socketId}
                        ref={(ref) => {
                          if (ref && vid.stream) {
                            if (ref.srcObject !== vid.stream) {
                              ref.srcObject = vid.stream;
                            }
                            ref.play().catch((err) => {
                              console.warn(`[Video] Remote video play error for peer ${vid.socketId}:`, err);
                            });
                          }
                        }}
                        autoPlay
                        playsInline
                        muted
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          display: peerVideoActive ? 'block' : 'none'
                        }}
                      />

                      {!peerVideoActive && (
                        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0F172A', gap: '16px' }}>
                          <div style={{
                            width: '70px',
                            height: '70px',
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, var(--accent), var(--primary))',
                            color: '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '1.8rem',
                            fontWeight: 700,
                            boxShadow: 'var(--shadow-lg)'
                          }}>
                            {peerName.charAt(0).toUpperCase()}
                          </div>
                          <span style={{ fontSize: '0.85rem', color: '#9CA3AF', fontWeight: 600 }}>Camera Disabled</span>
                        </div>
                      )}

                      {/* Remote Badges Overlays */}
                      <div style={{ position: 'absolute', top: '12px', left: '12px', display: 'flex', gap: '8px', zIndex: 5 }}>
                        {isPresenter && (
                          <span style={{ background: 'var(--primary)', color: '#ffffff', padding: '4px 8px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                            <Monitor size={12} /> Presenting
                          </span>
                        )}
                        {handRaised && (
                          <span style={{ background: '#F59E0B', color: '#090D1A', padding: '4px 8px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 750, display: 'flex', alignItems: 'center', gap: '4px', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                            ✋ Raised Hand
                          </span>
                        )}
                      </div>

                      {/* Unread Private Messages Indicator on Video Tile */}
                      {(() => {
                        const unreadCount = getUnreadCount(participantInfo || { socketId: vid.socketId, username: peerName });
                        if (unreadCount <= 0) return null;
                        return (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openPrivateChat(participantInfo || { socketId: vid.socketId, username: peerName });
                            }}
                            style={{
                              position: 'absolute',
                              top: '12px',
                              right: '12px',
                              background: '#EF4444',
                              color: '#ffffff',
                              border: 'none',
                              borderRadius: '20px',
                              padding: '4px 10px',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              cursor: 'pointer',
                              zIndex: 25,
                              boxShadow: '0 2px 10px rgba(239, 68, 68, 0.5)'
                            }}
                            title={`New private message from ${peerName} (${unreadCount} unread)`}
                          >
                            <MessageSquare size={12} />
                            <span>{unreadCount} unread</span>
                          </button>
                        );
                      })()}

                      <div style={{ position: 'absolute', bottom: '12px', left: '12px', background: 'rgba(9, 13, 26, 0.8)', padding: '6px 12px', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', fontWeight: 600, border: '1px solid rgba(255,255,255,0.06)' }}>
                        {peerName}
                      </div>

                      {/* Popping Emoji Burst Overlay for Remote Participant Tile */}
                      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 30, overflow: 'hidden' }}>
                        {reactionsList.filter(r => r.targetSocketId === vid.socketId).map((react) => (
                          <div
                            key={react.id}
                            style={{
                              position: 'absolute',
                              left: `${react.left}%`,
                              bottom: '10px',
                              fontSize: react.size,
                              animation: `emojiPopTile ${react.duration} ease-out forwards`,
                              animationDelay: react.delay,
                              zIndex: 35,
                              filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.5))'
                            }}
                          >
                            {react.emoji}
                          </div>
                        ))}
                      </div>

                      <div style={{ position: 'absolute', bottom: '12px', right: '12px', zIndex: 5 }}>
                        {!peerAudioActive && (
                          <span style={{ background: '#EF4444', color: '#ffffff', width: '26px', height: '26px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <MicOff size={13} />
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Controls Docking Bar */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                alignItems: 'center',
                justifyContent: 'center',
                width: '100%',
                margin: '20px auto 0',
                maxWidth: '750px',
                position: 'relative',
                zIndex: 20
              }}>
                
                {/* Microphones Selector Arrow Menu */}
                {showMicMenu && (
                  <div style={{
                    position: 'absolute',
                    bottom: '70px',
                    left: '50px',
                    background: '#111827',
                    border: '1px solid #374151',
                    borderRadius: 'var(--radius-md)',
                    padding: '8px 0',
                    width: '240px',
                    boxShadow: 'var(--shadow-lg)',
                    zIndex: 100,
                    textAlign: 'left'
                  }}>
                    <div style={{ padding: '6px 16px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)', borderBottom: '1px solid #1F2937', textTransform: 'uppercase' }}>Select Microphone</div>
                    <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
                      {audioDevices.map((d) => (
                        <button
                          key={d.deviceId}
                          onClick={() => {
                            setSelectedAudio(d.deviceId);
                            setShowMicMenu(false);
                          }}
                          style={{
                            width: '100%',
                            padding: '10px 16px',
                            background: selectedAudio === d.deviceId ? 'var(--primary)' : 'transparent',
                            color: '#F9FAFB',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '0.8rem',
                            textAlign: 'left',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                          }}
                          onMouseEnter={(e) => selectedAudio !== d.deviceId && (e.target.style.background = '#1F2937')}
                          onMouseLeave={(e) => selectedAudio !== d.deviceId && (e.target.style.background = 'transparent')}
                        >
                          <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', width: '90%' }}>
                            {d.label || `Microphone (${d.deviceId.slice(0, 5)})`}
                          </span>
                          {selectedAudio === d.deviceId && <span>✓</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Cameras Selector Arrow Menu */}
                {showCamMenu && (
                  <div style={{
                    position: 'absolute',
                    bottom: '70px',
                    left: '10px',
                    background: '#111827',
                    border: '1px solid #374151',
                    borderRadius: 'var(--radius-md)',
                    padding: '8px 0',
                    width: '240px',
                    boxShadow: 'var(--shadow-lg)',
                    zIndex: 100,
                    textAlign: 'left'
                  }}>
                    <div style={{ padding: '6px 16px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)', borderBottom: '1px solid #1F2937', textTransform: 'uppercase' }}>Select Camera</div>
                    <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
                      {videoDevices.map((d) => (
                        <button
                          key={d.deviceId}
                          onClick={() => {
                            setSelectedVideo(d.deviceId);
                            setShowCamMenu(false);
                          }}
                          style={{
                            width: '100%',
                            padding: '10px 16px',
                            background: selectedVideo === d.deviceId ? 'var(--primary)' : 'transparent',
                            color: '#F9FAFB',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '0.8rem',
                            textAlign: 'left',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                          }}
                          onMouseEnter={(e) => selectedVideo !== d.deviceId && (e.target.style.background = '#1F2937')}
                          onMouseLeave={(e) => selectedVideo !== d.deviceId && (e.target.style.background = 'transparent')}
                        >
                          <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', width: '90%' }}>
                            {d.label || `Camera (${d.deviceId.slice(0, 5)})`}
                          </span>
                          {selectedVideo === d.deviceId && <span>✓</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Reactions Floating picker */}
                {showReactions && (
                  <div style={{
                    display: 'flex',
                    gap: '12px',
                    background: '#1F2937',
                    border: '1px solid #374151',
                    padding: '10px 20px',
                    borderRadius: '30px',
                    boxShadow: 'var(--shadow-lg)',
                    position: 'absolute',
                    bottom: '66px',
                    zIndex: 20
                  }} className="scale-up">
                    {['😊', '😂', '👍', '🔥', '🎉', '❤️'].map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => {
                          sendReaction(emoji);
                          setShowReactions(false);
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          fontSize: '1.5rem',
                          cursor: 'pointer',
                          transition: 'transform 0.15s',
                          outline: 'none'
                        }}
                        onMouseEnter={(e) => e.target.style.transform = 'scale(1.25)'}
                        onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}

                {/* Toolbar buttons deck */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                  background: 'rgba(17, 24, 39, 0.8)',
                  backdropFilter: 'blur(16px)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  padding: '12px 24px',
                  borderRadius: '40px',
                  width: '100%',
                  flexWrap: 'wrap',
                  boxShadow: 'var(--shadow-lg)'
                }}>
                  {/* Video Toggle and Arrow */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                    <Button
                      variant={video ? 'outline' : 'danger'}
                      onClick={handleVideo}
                      iconLeft={video ? <Video size={18} /> : <VideoOff size={18} />}
                      style={{ borderRadius: '50%', padding: '10px', width: '42px', height: '42px', border: 'none' }}
                      title="Toggle Video"
                    />
                    <button
                      onClick={() => { setShowCamMenu(!showCamMenu); setShowMicMenu(false); }}
                      style={{ background: 'none', border: 'none', color: '#9CA3AF', cursor: 'pointer', height: '42px', display: 'flex', alignItems: 'center' }}
                    >
                      ▾
                    </button>
                  </div>

                  {/* Audio Toggle and Arrow */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                    <Button
                      variant={audio ? 'outline' : 'danger'}
                      onClick={handleAudio}
                      iconLeft={audio ? <Mic size={18} /> : <MicOff size={18} />}
                      style={{ borderRadius: '50%', padding: '10px', width: '42px', height: '42px', border: 'none' }}
                      title="Toggle Microphone"
                    />
                    <button
                      onClick={() => { setShowMicMenu(!showMicMenu); setShowCamMenu(false); }}
                      style={{ background: 'none', border: 'none', color: '#9CA3AF', cursor: 'pointer', height: '42px', display: 'flex', alignItems: 'center' }}
                    >
                      ▾
                    </button>
                  </div>

                  {/* Screen Share */}
                  {screenAvailable && (
                    <Button
                      variant={screen ? 'primary' : 'outline'}
                      onClick={handleScreen}
                      iconLeft={screen ? <MonitorOff size={18} /> : <Monitor size={18} />}
                      style={{ borderRadius: '50%', padding: '10px', width: '42px', height: '42px', border: 'none' }}
                      title="Share Screen"
                    />
                  )}

                  {/* Hand Raise */}
                  <Button
                    variant={isHandRaised ? 'primary' : 'outline'}
                    onClick={handleRaiseHand}
                    iconLeft={<span style={{ fontSize: '1.1rem' }}>✋</span>}
                    style={{ borderRadius: '50%', padding: '10px', width: '42px', height: '42px', border: 'none' }}
                    title="Raise Hand"
                  />

                  {/* Reactions Triggers */}
                  <Button
                    variant={showReactions ? 'primary' : 'outline'}
                    onClick={() => setShowReactions(!showReactions)}
                    iconLeft={<span style={{ fontSize: '1.1rem' }}>😊</span>}
                    style={{ borderRadius: '50%', padding: '10px', width: '42px', height: '42px', border: 'none' }}
                    title="Reactions"
                  />

                  {/* Record Meeting */}
                  <Button
                    variant={isRecording ? 'danger' : 'outline'}
                    onClick={handleToggleRecording}
                    iconLeft={<span style={{ display: 'inline-block', width: '10px', height: '10px', background: isRecording ? '#ffffff' : 'red', borderRadius: '50%' }}></span>}
                    style={{ borderRadius: isRecording ? '20px' : '50%', padding: '10px', minWidth: '42px', height: '42px', border: 'none', color: isRecording ? '#ffffff' : undefined, fontWeight: 700 }}
                    title={isRecording ? "Stop Recording" : "Record Meeting"}
                  >
                    {isRecording && <span style={{ marginLeft: '4px', fontSize: '0.8rem' }}>REC {formatDuration(recordingTime)}</span>}
                  </Button>



                  <div style={{ width: '1px', height: '24px', background: '#374151', margin: '0 8px' }}></div>

                  {/* Participants Toggle */}
                  <Button
                    variant={showChat && sidebarTab === 'participants' ? 'primary' : 'outline'}
                    onClick={() => {
                      if (showChat && sidebarTab === 'participants') {
                        setShowChat(false);
                      } else {
                        setShowChat(true);
                        setSidebarTab('participants');
                      }
                      setNewMessages(0);
                    }}
                    iconLeft={
                      <div style={{ position: 'relative' }}>
                        <Users size={18} />
                        {totalUnreadPrivate > 0 && (
                          <span style={{
                            position: 'absolute',
                            top: '-8px',
                            right: '-10px',
                            background: '#EF4444',
                            color: '#FFFFFF',
                            fontSize: '0.65rem',
                            fontWeight: 750,
                            minWidth: '16px',
                            height: '16px',
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '0 4px',
                            boxShadow: '0 0 0 2px #090D1A'
                          }}>
                            {totalUnreadPrivate > 9 ? '9+' : totalUnreadPrivate}
                          </span>
                        )}
                      </div>
                    }
                    style={{ borderRadius: '50%', padding: '10px', width: '42px', height: '42px', border: 'none' }}
                    title={totalUnreadPrivate > 0 ? `${totalUnreadPrivate} unread private message${totalUnreadPrivate > 1 ? 's' : ''}` : "Show Participants"}
                  />

                  {/* Chat Toggle */}
                  <Button
                    variant={showChat && sidebarTab === 'chat' ? 'primary' : 'outline'}
                    onClick={() => {
                      if (showChat && sidebarTab === 'chat') {
                        setShowChat(false);
                      } else {
                        setShowChat(true);
                        setSidebarTab('chat');
                      }
                      setNewMessages(0);
                    }}
                    iconLeft={
                      <div style={{ position: 'relative' }}>
                        <MessageSquare size={18} />
                        {newMessages > 0 && (
                          <span style={{ position: 'absolute', top: '-6px', right: '-6px', background: 'var(--error)', width: '6px', height: '6px', borderRadius: '50%' }}></span>
                        )}
                      </div>
                    }
                    style={{ borderRadius: '50%', padding: '10px', width: '42px', height: '42px', border: 'none' }}
                    title="Show Chat"
                  />

                  {/* Host Permission Settings */}
                  <Button
                    variant={showSettingsModal ? 'primary' : 'outline'}
                    onClick={() => setShowSettingsModal(!showSettingsModal)}
                    iconLeft={<Settings size={18} />}
                    style={{ borderRadius: '50%', padding: '10px', width: '42px', height: '42px', border: 'none' }}
                    title="Permissions & Settings"
                  />

                  {/* Leave or End Button */}
                  {isCurrentUserHost ? (
                    <Button
                      variant="danger"
                      onClick={() => setIsEndMeetingModalOpen(true)}
                      iconLeft={<PhoneOff size={18} />}
                      style={{ borderRadius: '30px', padding: '10px 20px', fontSize: '0.85rem', fontWeight: 800, border: 'none' }}
                    >
                      End Meeting
                    </Button>
                  ) : (
                    <Button
                      variant="danger"
                      onClick={handleEndCall}
                      iconLeft={<PhoneOff size={18} />}
                      style={{ borderRadius: '30px', padding: '10px 20px', fontSize: '0.85rem', fontWeight: 800, border: 'none' }}
                    >
                      Leave Room
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Right sidebar: Unified Chat & Participant Drawer */}
            {showChat && (
              <div style={{
                width: '360px',
                background: '#111827',
                borderLeft: '1px solid #1F2937',
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                position: 'relative'
              }} className="slide-in">
                {/* Tab Selector Headers */}
                <div style={{
                  display: 'flex',
                  borderBottom: '1px solid #1F2937',
                  background: '#090D1A'
                }}>
                  <button
                    onClick={() => setSidebarTab('chat')}
                    style={{
                      flex: 1,
                      padding: '16px',
                      background: 'none',
                      border: 'none',
                      borderBottom: sidebarTab === 'chat' ? '2px solid var(--primary)' : 'none',
                      color: sidebarTab === 'chat' ? '#F8FAFC' : '#9CA3AF',
                      fontWeight: 700,
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      transition: 'all 0.2s'
                    }}
                  >
                    Chat
                  </button>
                  <button
                    onClick={() => setSidebarTab('participants')}
                    style={{
                      flex: 1,
                      padding: '16px',
                      background: 'none',
                      border: 'none',
                      borderBottom: sidebarTab === 'participants' ? '2px solid var(--primary)' : 'none',
                      color: sidebarTab === 'participants' ? '#F8FAFC' : '#9CA3AF',
                      fontWeight: 700,
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      transition: 'all 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                  >
                    <span>Participants ({participants.length})</span>
                    {totalUnreadPrivate > 0 && (
                      <span style={{
                        background: '#EF4444',
                        color: '#FFFFFF',
                        fontSize: '0.68rem',
                        borderRadius: '10px',
                        padding: '1px 6px',
                        fontWeight: 750
                      }}>
                        {totalUnreadPrivate}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => setShowChat(false)}
                    style={{
                      padding: '16px',
                      background: 'none',
                      border: 'none',
                      color: '#9CA3AF',
                      cursor: 'pointer'
                    }}
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* On-the-fly Language Settings for Translation */}
                <div style={{
                  padding: '12px 16px',
                  borderBottom: '1px solid #1F2937',
                  background: '#090D1A',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '10px'
                }}>
                  <span style={{ fontSize: '0.75rem', color: '#9CA3AF', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}>
                    <Globe size={14} color="var(--primary)" /> Preferred Language
                  </span>
                  <LanguageSelector
                    value={lobbyLanguage}
                    onChange={(lang) => {
                      setLobbyLanguage(lang);
                      localStorage.setItem('preferredLanguage', lang);
                      if (socketRef.current) {
                        socketRef.current.emit('user-info-update-language', lang);
                      }
                      addToast(`Preferred language set to ${lang.toUpperCase()}`, 'success');
                    }}
                    style={{ width: 'auto' }}
                    selectStyle={{ padding: '6px 12px', fontSize: '0.75rem', borderRadius: '6px', background: '#111827', border: '1px solid #374151', color: '#F9FAFB' }}
                    label={null}
                  />
                </div>

                {/* Message flow Tab */}
                {sidebarTab === 'chat' && (
                  <>
                    <div style={{ flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {messages.length === 0 ? (
                        <div style={{ textAlign: 'center', color: '#9CA3AF', marginTop: '60px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                          <MessageSquare size={32} style={{ opacity: 0.3 }} />
                          <p style={{ fontSize: '0.85rem' }}>No messages yet. Send a message to start.</p>
                        </div>
                      ) : (
                        messages.map((item, index) => {
                          const isMe = item.sender === username;
                          return (
                            <div key={index} style={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: isMe ? 'flex-end' : 'flex-start',
                              gap: '4px',
                              width: '100%'
                            }} className="fade-in">
                              <span style={{ fontSize: '0.75rem', color: '#9CA3AF', padding: '0 4px' }}>{item.sender}</span>
                              <div style={{
                                padding: '12px 16px',
                                background: isMe ? 'var(--primary)' : '#1F2937',
                                color: '#ffffff',
                                borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                                fontSize: '0.9rem',
                                maxWidth: '85%',
                                boxShadow: 'var(--shadow)',
                                display: 'flex'
                              }}>
                                <TranslatedMessage text={item.data} translation={item.translation} isMe={isMe} />
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* Chat Input */}
                    <div style={{ padding: '20px', borderTop: '1px solid #1F2937', display: 'flex', gap: '10px', background: '#090D1A' }}>
                      <input
                        type="text"
                        placeholder="Type a message..."
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                        style={{
                          flex: 1,
                          padding: '12px 16px',
                          background: '#111827',
                          border: '1px solid #374151',
                          borderRadius: '30px',
                          color: '#F8FAFC',
                          fontSize: '0.9rem',
                          outline: 'none',
                          transition: 'border-color 0.2s'
                        }}
                        onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
                        onBlur={(e) => e.target.style.borderColor = '#374151'}
                      />
                      <Button onClick={sendMessage} variant="primary" style={{ padding: '12px', borderRadius: '50%', width: '42px', height: '42px' }}><Send size={16} /></Button>
                    </div>
                  </>
                )}

                {/* Participants Tab */}
                {sidebarTab === 'participants' && (
                  <div style={{ flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {participants.map((p) => {
                      const isTargetMe = p.socketId === socketIdRef.current;
                      const isTargetHost = p.username === hostId;
                      const isSpeaking = activeSpeaker === p.socketId || p.isSpeaking;
                      const unreadCount = getUnreadCount(p);

                      return (
                        <div
                          key={p.socketId}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '12px 16px',
                            background: unreadCount > 0 ? 'rgba(239, 68, 68, 0.08)' : '#1F2937',
                            borderRadius: 'var(--radius-md)',
                            position: 'relative',
                            border: unreadCount > 0 ? '1px solid rgba(239, 68, 68, 0.5)' : (isSpeaking ? '1px solid #10B981' : '1px solid #374151'),
                            boxShadow: unreadCount > 0 ? '0 0 12px rgba(239, 68, 68, 0.2)' : (isSpeaking ? '0 0 10px rgba(16, 185, 129, 0.15)' : 'none'),
                            transition: 'all 0.2s ease'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, overflow: 'hidden' }}>
                            <div style={{
                              width: '34px',
                              height: '34px',
                              borderRadius: '50%',
                              background: isTargetHost ? 'linear-gradient(135deg, #F59E0B, #D97706)' : 'linear-gradient(135deg, var(--primary), var(--accent))',
                              color: isTargetHost ? '#090D1A' : '#ffffff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '0.85rem',
                              fontWeight: 800,
                              flexShrink: 0
                            }}>
                              {p.username.charAt(0).toUpperCase()}
                            </div>
                            
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden', width: '80%' }}>
                              <div style={{ fontSize: '0.85rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px', color: '#F9FAFB' }}>
                                <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{p.username}</span>
                                {isTargetMe && <span style={{ color: '#9CA3AF', fontSize: '0.75rem', fontWeight: 500 }}>(You)</span>}
                              </div>
                              
                              {/* Badges and state indicators row */}
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }}>
                                {isTargetHost && (
                                  <span style={{ fontSize: '0.62rem', padding: '2px 6px', background: 'rgba(245, 158, 11, 0.15)', color: '#F59E0B', borderRadius: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                                    👑 Host
                                  </span>
                                )}
                                {p.isHandRaised && (
                                  <span style={{ fontSize: '0.62rem', padding: '2px 6px', background: 'rgba(245, 158, 11, 0.15)', color: '#F59E0B', borderRadius: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                                    ✋ Hand Raised
                                  </span>
                                )}
                                {unreadCount > 0 && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openPrivateChat(p);
                                    }}
                                    style={{
                                      fontSize: '0.62rem',
                                      padding: '2px 8px',
                                      background: '#EF4444',
                                      color: '#FFFFFF',
                                      borderRadius: '10px',
                                      fontWeight: 750,
                                      letterSpacing: '0.02em',
                                      border: 'none',
                                      cursor: 'pointer',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '3px',
                                      boxShadow: '0 0 8px rgba(239, 68, 68, 0.4)'
                                    }}
                                    title={`Click to open private chat (${unreadCount} unread message${unreadCount > 1 ? 's' : ''})`}
                                  >
                                    💬 {unreadCount} new
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {/* Direct Private Chat Button if unread */}
                            {unreadCount > 0 && !isTargetMe && (
                              <button
                                onClick={() => openPrivateChat(p)}
                                style={{
                                  background: 'rgba(239, 68, 68, 0.2)',
                                  border: '1px solid #EF4444',
                                  color: '#F87171',
                                  borderRadius: '12px',
                                  padding: '3px 8px',
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}
                                title={`Open private chat with ${p.username}`}
                              >
                                <MessageSquare size={12} />
                                <span>{unreadCount}</span>
                              </button>
                            )}

                            {/* Mic status indicator */}
                            {(p.audioEnabled === false || (isTargetMe && !audio)) ? (
                              <span style={{ color: '#EF4444', display: 'flex', alignItems: 'center' }} title="Muted"><MicOff size={14} /></span>
                            ) : (
                              <span style={{ color: '#10B981', display: 'flex', alignItems: 'center' }} title="Microphone Active"><Mic size={14} /></span>
                            )}

                            {/* Camera status indicator */}
                            {(p.videoEnabled === false || (isTargetMe && !video)) ? (
                              <span style={{ color: '#EF4444', display: 'flex', alignItems: 'center' }} title="Camera Off"><VideoOff size={14} /></span>
                            ) : (
                              <span style={{ color: '#3B82F6', display: 'flex', alignItems: 'center' }} title="Camera On"><Video size={14} /></span>
                            )}

                            {/* Speaking wave highlights */}
                            {isSpeaking && (
                              <span style={{ color: '#10B981', display: 'flex', alignItems: 'center' }} title="Speaking">
                                🎙️
                              </span>
                            )}
                            
                            {/* Actions menu trigger */}
                            {!isTargetMe && (
                              <button
                                onClick={() => setActiveActionMenu(activeActionMenu === p.socketId ? null : p.socketId)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: '6px', borderRadius: '50%', display: 'flex', alignItems: 'center' }}
                              >
                                <MoreVertical size={16} />
                              </button>
                            )}
                          </div>

                          {/* Participant Context Action Menu */}
                          {activeActionMenu === p.socketId && (
                            <div style={{
                              position: 'absolute',
                              right: '12px',
                              top: '42px',
                              background: '#111827',
                              border: '1px solid #374151',
                              borderRadius: 'var(--radius-md)',
                              boxShadow: 'var(--shadow-lg)',
                              zIndex: 990,
                              width: '180px',
                              display: 'flex',
                              flexDirection: 'column',
                              overflow: 'hidden'
                            }}>
                              {/* Send Private Message option */}
                              {(allowPrivateMessages || isCurrentUserHost) && (
                                <button
                                  onClick={() => {
                                    openPrivateChat(p);
                                    setActiveActionMenu(null);
                                  }}
                                  style={{
                                    padding: '10px 14px',
                                    border: 'none',
                                    background: 'none',
                                    color: '#F8FAFC',
                                    fontSize: '0.8rem',
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    width: '100%',
                                    transition: 'background 0.2s',
                                    borderBottom: '1px solid #374151',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between'
                                  }}
                                  onMouseEnter={(e) => e.target.style.background = '#1F2937'}
                                  onMouseLeave={(e) => e.target.style.background = 'none'}
                                >
                                  <span>💬 Send Private Msg</span>
                                  {unreadCount > 0 && (
                                    <span style={{
                                      background: '#EF4444',
                                      color: '#FFFFFF',
                                      fontSize: '0.68rem',
                                      fontWeight: 750,
                                      padding: '1px 6px',
                                      borderRadius: '8px'
                                    }}>
                                      {unreadCount}
                                    </span>
                                  )}
                                </button>
                              )}

                              {/* View Profile */}
                              <button
                                onClick={() => {
                                  alert(`Participant Profile:\nUsername: ${p.username}\nLanguage preference: ${p.preferredLanguage?.toUpperCase() || 'EN'}\nConnection Code: ${p.socketId}`);
                                  setActiveActionMenu(null);
                                }}
                                style={{
                                  padding: '10px 14px',
                                  border: 'none',
                                  background: 'none',
                                  color: '#F8FAFC',
                                  fontSize: '0.8rem',
                                  cursor: 'pointer',
                                  textAlign: 'left',
                                  width: '100%',
                                  transition: 'background 0.2s',
                                  borderBottom: '1px solid #374151'
                                }}
                                onMouseEnter={(e) => e.target.style.background = '#1F2937'}
                                  onMouseLeave={(e) => e.target.style.background = 'none'}
                                >
                                  👤 View Profile
                                </button>

                                {/* Copy User ID */}
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(p.socketId);
                                    addToast('Copied Connection ID', 'success');
                                    setActiveActionMenu(null);
                                  }}
                                  style={{
                                    padding: '10px 14px',
                                    border: 'none',
                                    background: 'none',
                                    color: '#F8FAFC',
                                    fontSize: '0.8rem',
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    width: '100%',
                                    transition: 'background 0.2s',
                                    borderBottom: (isCurrentUserHost && !isTargetHost) ? '1px solid #374151' : 'none'
                                  }}
                                  onMouseEnter={(e) => e.target.style.background = '#1F2937'}
                                  onMouseLeave={(e) => e.target.style.background = 'none'}
                                >
                                  📋 Copy Connection ID
                                </button>

                                {/* Host commands (Mute & Kick) */}
                                {isCurrentUserHost && !isTargetHost && (
                                  <>
                                    <button
                                      onClick={() => {
                                        handleHostMuteParticipant(p.socketId);
                                        setActiveActionMenu(null);
                                      }}
                                      style={{
                                        padding: '10px 14px',
                                        border: 'none',
                                        background: 'none',
                                        color: '#F59E0B',
                                        fontSize: '0.8rem',
                                        cursor: 'pointer',
                                        textAlign: 'left',
                                        width: '100%',
                                        transition: 'background 0.2s',
                                        borderBottom: '1px solid #374151'
                                      }}
                                      onMouseEnter={(e) => e.target.style.background = '#1F2937'}
                                      onMouseLeave={(e) => e.target.style.background = 'none'}
                                    >
                                      Mute Participant
                                    </button>
                                    <button
                                      onClick={() => {
                                        handleHostRemoveParticipant(p.socketId);
                                        setActiveActionMenu(null);
                                      }}
                                      style={{
                                        padding: '10px 14px',
                                        border: 'none',
                                        background: 'none',
                                        color: '#EF4444',
                                        fontSize: '0.8rem',
                                        cursor: 'pointer',
                                        textAlign: 'left',
                                        width: '100%',
                                        fontWeight: 700,
                                        transition: 'background 0.2s'
                                      }}
                                      onMouseEnter={(e) => e.target.style.background = '#1F2937'}
                                      onMouseLeave={(e) => e.target.style.background = 'none'}
                                    >
                                      Remove Participant
                                    </button>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

          </div>
        )}

        {/* Private Chat Drawer (can open independently of sidebar) */}
        <PrivateChatDrawer
          isOpen={!!privateChatRecipient}
          onClose={() => setPrivateChatRecipient(null)}
          socket={socketRef.current}
          currentUser={user}
          recipient={privateChatRecipient}
          chatHistory={privateChatRecipient ? (privateMessages[privateChatRecipient.socketId] || privateMessages[privateChatRecipient.username] || []) : []}
          allowPrivateMessages={allowPrivateMessages}
          isCurrentUserHost={isCurrentUserHost}
        />



        {/* Settings Modal (Host Controls) */}
        {showSettingsModal && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
            backdropFilter: 'blur(4px)'
          }}>
            <Card style={{
              background: '#111827',
              borderColor: '#374151',
              width: '95%',
              maxWidth: '420px',
              padding: '28px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: '#F8FAFC' }}>Meeting Settings</h3>
                <button
                  onClick={() => setShowSettingsModal(false)}
                  style={{ background: 'none', border: 'none', color: '#9CA3AF', cursor: 'pointer', outline: 'none' }}
                >
                  <X size={20} />
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div>
                  <h4 style={{ fontSize: '0.8rem', color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '14px', fontWeight: 700 }}>
                    Host Permissions & Controls
                  </h4>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                    {/* Chat Permission Select */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ flex: 1, paddingRight: '12px' }}>
                        <h5 style={{ fontSize: '0.9rem', fontWeight: 600, margin: 0, color: '#F1F5F9' }}>Chat Permission</h5>
                        <p style={{ fontSize: '0.75rem', color: '#94A3B8', margin: '2px 0 0', lineHeight: 1.3 }}>Select who can send chat messages in this call.</p>
                      </div>
                      <select
                        value={chatPermission}
                        disabled={!isCurrentUserHost}
                        onChange={(e) => {
                          const val = e.target.value;
                          setChatPermission(val);
                          setAllowPrivateMessages(val === 'Private');
                          if (socketRef.current) {
                            socketRef.current.emit("chat-permission-updated", { room: meetingCode, chatPermission: val });
                          }
                        }}
                        style={{
                          padding: '6px 10px',
                          background: '#090D1A',
                          border: '1px solid #374151',
                          borderRadius: '6px',
                          color: '#F8FAFC',
                          fontSize: '0.8rem',
                          outline: 'none',
                          cursor: isCurrentUserHost ? 'pointer' : 'not-allowed'
                        }}
                      >
                        <option value="Everyone">Everyone</option>
                        <option value="Private">Private / Personal</option>
                        <option value="Disabled">Disabled</option>
                      </select>
                    </div>

                    {/* Allow Screen Share Toggle */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #374151', paddingTop: '16px' }}>
                      <div style={{ flex: 1, paddingRight: '12px' }}>
                        <h5 style={{ fontSize: '0.9rem', fontWeight: 600, margin: 0, color: '#F1F5F9' }}>Allow Screen Sharing</h5>
                        <p style={{ fontSize: '0.75rem', color: '#94A3B8', margin: '2px 0 0', lineHeight: 1.3 }}>Allow participants to present their screen to the room.</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={allowScreenShare}
                        disabled={!isCurrentUserHost}
                        onChange={(e) => {
                          const val = e.target.checked;
                          setAllowScreenShare(val);
                          if (socketRef.current) {
                            socketRef.current.emit("screen-share-permission-updated", { room: meetingCode, allowScreenShare: val });
                          }
                        }}
                        style={{ width: '18px', height: '18px', cursor: isCurrentUserHost ? 'pointer' : 'not-allowed' }}
                      />
                    </div>
                  </div>
                </div>
                
                {!isCurrentUserHost && (
                  <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '10px 14px', borderRadius: '6px', marginTop: '10px' }}>
                    <p style={{ fontSize: '0.75rem', color: '#F87171', margin: 0, lineHeight: 1.4, textAlign: 'center', fontWeight: 500 }}>
                      ⚠️ Only the host <strong>{hostId}</strong> can manage these permissions.
                    </p>
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}

        {/* End Meeting Confirmation Modal */}
        {isEndMeetingModalOpen && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2100,
            backdropFilter: 'blur(4px)'
          }}>
            <Card style={{
              background: '#111827',
              borderColor: '#374151',
              width: '95%',
              maxWidth: '440px',
              padding: '28px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              textAlign: 'center'
            }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.15)', color: '#EF4444', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px auto' }}>
                <PhoneOff size={28} />
              </div>
              <h3 style={{ fontSize: '1.3rem', fontWeight: 800, margin: '0 0 8px 0', color: '#F8FAFC' }}>
                End meeting for everyone?
              </h3>
              <p style={{ fontSize: '0.88rem', color: '#9CA3AF', lineHeight: 1.4, margin: '0 0 24px 0' }}>
                Ending this meeting will disconnect all participants and mark the session as ended. No one will be able to rejoin.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <Button
                  variant="danger"
                  onClick={() => {
                    setIsEndMeetingModalOpen(false);
                    handleEndCallForEveryone();
                  }}
                  style={{ width: '100%', padding: '12px', borderRadius: 'var(--radius-md)', fontWeight: 700 }}
                >
                  End Meeting for Everyone
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsEndMeetingModalOpen(false);
                    handleEndCall();
                  }}
                  style={{ width: '100%', padding: '10px', borderRadius: 'var(--radius-md)' }}
                >
                  Leave Meeting Only
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setIsEndMeetingModalOpen(false)}
                  style={{ width: '100%', padding: '10px', borderRadius: 'var(--radius-md)', borderColor: 'transparent', color: '#9CA3AF' }}
                >
                  Cancel
                </Button>
              </div>
            </Card>
          </div>
        )}

      </div>
    );
  };

export default Meeting;

