import { Server } from "socket.io";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { translateText } from "../services/translationService.js";
import { PrivateMessage } from "../models/privateMessage.model.js";
import { MeetingSettings } from "../models/meetingSettings.model.js";
import { Meeting } from "../models/meeting.model.js";

// Global in-memory state
let connections = {};        // { roomCode: [socketId, ...] }
let messages = {};           // { roomCode: [ { sender, data, socket-id-sender }, ... ] }
let timeOnline = {};         // { socketId: Date }
let socketUserInfo = {};     // { socketId: { username, preferredLanguage, room, isHandRaised, isSpeaking, audioEnabled, videoEnabled, isHost, isAuthenticated } }
let activePresenters = {};   // { roomCode: socketId }
let pendingRequests = {};    // { roomCode: [ { socketId, username, room, preferredLanguage, audioEnabled, videoEnabled, requestTime } ] }
let approvedSockets = {};    // { roomCode: Set<socketId> }
let inMemorySettings = {};   // { roomCode: { hostId, chatPermission, allowPrivateMessages, allowScreenShare } }

const isDbConnected = () => mongoose.connection.readyState === 1;

const cleanRoom = (room) => {
    if (!room) return "";
    const str = String(room).trim();
    return str.split("/").filter(Boolean).pop() || str;
};

const getMeetingDoc = async (roomCode) => {
    if (!isDbConnected()) return null;
    try {
        return await Meeting.findOne({ meetingCode: roomCode });
    } catch (e) {
        return null;
    }
};

const getRoomSettings = async (roomCode) => {
    if (isDbConnected()) {
        try {
            const settings = await MeetingSettings.findOne({ meetingId: roomCode });
            if (settings) {
                inMemorySettings[roomCode] = settings;
                return settings;
            }
        } catch (e) {}
    }
    return inMemorySettings[roomCode] || null;
};

const saveRoomSettings = async (roomCode, data) => {
    inMemorySettings[roomCode] = { ...(inMemorySettings[roomCode] || {}), ...data };
    if (isDbConnected()) {
        try {
            let settings = await MeetingSettings.findOne({ meetingId: roomCode });
            if (settings) {
                Object.assign(settings, data);
                await settings.save();
                return settings;
            } else {
                settings = new MeetingSettings({ meetingId: roomCode, ...data });
                await settings.save();
                return settings;
            }
        } catch (e) {}
    }
    return inMemorySettings[roomCode];
};

export const connectToSocket = (server) => {
    const defaultOrigins = [
        "https://connect-meet-wk21.onrender.com",
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000"
    ];

    const envOrigins = (process.env.CORS_ORIGIN || "")
        .split(",")
        .map(s => s.trim())
        .filter(Boolean);

    const allowedOrigins = Array.from(new Set([...defaultOrigins, ...envOrigins]));

    const io = new Server(server, {
        cors: {
            origin: (origin, callback) => {
                if (!origin) return callback(null, true);
                if (
                    allowedOrigins.includes("*") ||
                    allowedOrigins.includes(origin) ||
                    origin.startsWith("http://localhost:") ||
                    origin.startsWith("http://127.0.0.1:")
                ) {
                    return callback(null, true);
                }
                return callback(new Error("Socket CORS blocked: Origin not allowed"), false);
            },
            methods: ["GET", "POST"],
            allowedHeaders: ["*"],
            credentials: true
        }
    });

    // -------------------------------------------------------------
    // JWT HANDSHAKE AUTHENTICATION MIDDLEWARE
    // -------------------------------------------------------------
    io.use((socket, next) => {
        const token = socket.handshake.auth?.token || 
                      (socket.handshake.headers?.authorization?.startsWith("Bearer ") 
                          ? socket.handshake.headers.authorization.split(" ")[1] 
                          : null);

        if (token && typeof token === "string") {
            const secret = process.env.JWT_SECRET;
            if (secret) {
                try {
                    const decoded = jwt.verify(token, secret);
                    if (decoded && decoded.id && decoded.username) {
                        socket.user = {
                            id: decoded.id,
                            username: decoded.username,
                            name: decoded.name || decoded.username,
                            isAuthenticated: true
                        };
                        console.log(`[SOCKET AUTH] Verified user ${decoded.username} for socket ${socket.id}`);
                    }
                } catch (err) {
                    console.warn(`[SOCKET AUTH] Token verification failed for socket ${socket.id}:`, err.message);
                    socket.user = { isAuthenticated: false, error: err.message };
                }
            } else {
                socket.user = { isAuthenticated: false };
            }
        } else {
            socket.user = { isAuthenticated: false };
        }
        next();
    });

    io.on("connection", (socket) => {
        console.log("[SOCKET] Client connected:", socket.id, socket.user?.isAuthenticated ? `(Authenticated: ${socket.user.username})` : "(Guest)");

        // -------------------------------------------------------------
        // JOIN REQUEST & HOST APPROVAL
        // -------------------------------------------------------------
        socket.on("join-request", async (info) => {
            const { room, username, preferredLanguage, audioEnabled, videoEnabled } = info || {};
            const roomCode = cleanRoom(room);
            if (!roomCode) return;

            const meetingDoc = await getMeetingDoc(roomCode);
            const designatedHost = meetingDoc?.user_id;
            let settings = await getRoomSettings(roomCode);

            // Verified username if authenticated, else fallback to provided/Guest
            const effectiveUsername = socket.user?.isAuthenticated 
                ? socket.user.username 
                : (username ? String(username).trim() : "Guest");

            // Host determination using strictly verified JWT identity
            let isHost = false;
            if (designatedHost) {
                isHost = socket.user?.isAuthenticated === true && socket.user.username === designatedHost;
            } else if (settings?.hostId) {
                isHost = socket.user?.isAuthenticated === true && socket.user.username === settings.hostId;
            } else {
                // If neither meetingDoc nor settings exist, the first authenticated user becomes the host
                isHost = socket.user?.isAuthenticated === true;
            }

            // Ensure settings document exists
            if (!settings) {
                settings = await saveRoomSettings(roomCode, {
                    hostId: isHost ? effectiveUsername : (designatedHost || "Host"),
                    chatPermission: meetingDoc?.chatPermission || "Everyone",
                    allowPrivateMessages: (meetingDoc?.chatPermission === "Private"),
                    allowScreenShare: true
                });
            }

            if (!approvedSockets[roomCode]) {
                approvedSockets[roomCode] = new Set();
            }

            if (isHost) {
                // Host is auto-approved and granted host authority
                approvedSockets[roomCode].add(socket.id);
                socketUserInfo[socket.id] = {
                    username: effectiveUsername,
                    preferredLanguage: preferredLanguage || "en",
                    room: roomCode,
                    isHandRaised: false,
                    isSpeaking: false,
                    audioEnabled: audioEnabled !== undefined ? audioEnabled : true,
                    videoEnabled: videoEnabled !== undefined ? videoEnabled : true,
                    isHost: true,
                    isAuthenticated: true
                };

                socket.emit("join-request-approved", { room: roomCode, isHost: true });

                // Send any pending join requests to host immediately
                if (pendingRequests[roomCode] && pendingRequests[roomCode].length > 0) {
                    socket.emit("pending-join-requests-list", pendingRequests[roomCode]);
                }
                return;
            }

            // NON-HOST USER (or unapproved attendee / guest):
            // Must wait in the waiting room until the host approves!
            if (!pendingRequests[roomCode]) {
                pendingRequests[roomCode] = [];
            }
            pendingRequests[roomCode] = pendingRequests[roomCode].filter(r => r.socketId !== socket.id);
            const reqData = {
                socketId: socket.id,
                username: effectiveUsername,
                room: roomCode,
                preferredLanguage: preferredLanguage || "en",
                audioEnabled: audioEnabled !== undefined ? audioEnabled : true,
                videoEnabled: videoEnabled !== undefined ? videoEnabled : true,
                isAuthenticated: socket.user?.isAuthenticated === true,
                requestTime: new Date()
            };
            pendingRequests[roomCode].push(reqData);

            // Notify all host sockets currently in this room
            const hostSockets = Object.keys(socketUserInfo).filter(sid => 
                socketUserInfo[sid].room === roomCode && 
                socketUserInfo[sid].isHost
            );

            if (hostSockets.length > 0) {
                hostSockets.forEach(hsid => io.to(hsid).emit("join-request", reqData));
            }

            socket.emit("waiting-for-host-approval", { room: roomCode });
        });

        // Host approves candidate
        socket.on("approve-join-request", async (info) => {
            const { candidateSocketId, room } = info || {};
            const roomCode = cleanRoom(room);
            if (!roomCode || !candidateSocketId) return;

            // Security verification: ONLY authorized host can approve
            const isAuthorizedHost = socketUserInfo[socket.id]?.isHost === true;
            if (!isAuthorizedHost) {
                socket.emit("host-action-rejected", "Only the authenticated host can approve join requests.");
                return;
            }

            if (pendingRequests[roomCode]) {
                pendingRequests[roomCode] = pendingRequests[roomCode].filter(r => r.socketId !== candidateSocketId);
            }

            if (!approvedSockets[roomCode]) {
                approvedSockets[roomCode] = new Set();
            }
            approvedSockets[roomCode].add(candidateSocketId);

            io.to(candidateSocketId).emit("join-request-approved", { room: roomCode, isHost: false });
        });

        // Host rejects candidate
        socket.on("reject-join-request", async (info) => {
            const { candidateSocketId, room } = info || {};
            const roomCode = cleanRoom(room);
            if (!roomCode || !candidateSocketId) return;

            // Security verification: ONLY authorized host can reject
            const isAuthorizedHost = socketUserInfo[socket.id]?.isHost === true;
            if (!isAuthorizedHost) {
                socket.emit("host-action-rejected", "Only the authenticated host can reject join requests.");
                return;
            }

            if (pendingRequests[roomCode]) {
                pendingRequests[roomCode] = pendingRequests[roomCode].filter(r => r.socketId !== candidateSocketId);
            }

            if (approvedSockets[roomCode]) {
                approvedSockets[roomCode].delete(candidateSocketId);
            }

            io.to(candidateSocketId).emit("join-request-rejected", { room: roomCode });
        });

        // Candidate cancels request while waiting
        socket.on("cancel-join-request", (info) => {
            const { room } = info || {};
            const roomCode = cleanRoom(room);
            if (!roomCode) return;

            if (pendingRequests[roomCode]) {
                pendingRequests[roomCode] = pendingRequests[roomCode].filter(r => r.socketId !== socket.id);
            }

            io.to(roomCode).emit("cancel-join-request", { candidateSocketId: socket.id });
        });

        // -------------------------------------------------------------
        // MEETING CALL PARTICIPATION
        // -------------------------------------------------------------
        socket.on("join-call", (path) => {
            const roomCode = cleanRoom(path);
            if (!roomCode) return;

            // Security Gate: Socket MUST be approved or host
            const isApproved = approvedSockets[roomCode]?.has(socket.id);
            const isHost = socketUserInfo[socket.id]?.isHost;

            if (!isApproved && !isHost) {
                console.warn(`[SECURITY] Unapproved socket ${socket.id} attempted to join-call for room ${roomCode}`);
                socket.emit("join-request-rejected", { room: roomCode, reason: "Not approved by host" });
                return;
            }

            socket.join(roomCode);

            if (!connections[roomCode]) {
                connections[roomCode] = [];
            }
            if (!connections[roomCode].includes(socket.id)) {
                connections[roomCode].push(socket.id);
            }
            timeOnline[socket.id] = new Date();

            console.log(`[SOCKET] Socket ${socket.id} entered room: ${roomCode}. Total: ${connections[roomCode].length}`);

            // Broadcast user-joined to all connected sockets in this room
            const currentClients = [...connections[roomCode]];
            currentClients.forEach(cid => {
                io.to(cid).emit("user-joined", socket.id, currentClients);
            });

            io.to(roomCode).emit("participant-count-updated", { count: currentClients.length });
        });

        // Register User Info, Preferred Language, and Initialize Host Settings
        socket.on("user-info-register", async (info) => {
            const { username, preferredLanguage, room, audioEnabled, videoEnabled } = info || {};
            const roomCode = cleanRoom(room);
            if (!roomCode) return;

            // Ensure socket is approved or host
            const isApproved = approvedSockets[roomCode]?.has(socket.id);
            const isHostSocket = socketUserInfo[socket.id]?.isHost === true;
            if (!isApproved && !isHostSocket) return;

            socket.join(roomCode);

            const settings = await getRoomSettings(roomCode);
            const verifiedName = socket.user?.isAuthenticated ? socket.user.username : (username || "Guest");

            socketUserInfo[socket.id] = {
                username: verifiedName,
                preferredLanguage: preferredLanguage || "en",
                room: roomCode,
                isHandRaised: socketUserInfo[socket.id]?.isHandRaised || false,
                isSpeaking: socketUserInfo[socket.id]?.isSpeaking || false,
                audioEnabled: audioEnabled !== undefined ? audioEnabled : true,
                videoEnabled: videoEnabled !== undefined ? videoEnabled : true,
                isHost: isHostSocket,
                isAuthenticated: socket.user?.isAuthenticated === true
            };

            // Broadcast active participant info to all users in the room
            const roomParticipants = (connections[roomCode] || [])
                .filter(sid => socketUserInfo[sid] && socketUserInfo[sid].room === roomCode)
                .map(sid => ({
                    socketId: sid,
                    username: socketUserInfo[sid]?.username || "Guest",
                    preferredLanguage: socketUserInfo[sid]?.preferredLanguage || "en",
                    isHandRaised: socketUserInfo[sid]?.isHandRaised || false,
                    isSpeaking: socketUserInfo[sid]?.isSpeaking || false,
                    audioEnabled: socketUserInfo[sid]?.audioEnabled !== undefined ? socketUserInfo[sid].audioEnabled : true,
                    videoEnabled: socketUserInfo[sid]?.videoEnabled !== undefined ? socketUserInfo[sid].videoEnabled : true,
                    isHost: socketUserInfo[sid]?.isHost || false,
                    isAuthenticated: socketUserInfo[sid]?.isAuthenticated || false
                }));

            // Sync settings and updated participants list
            io.to(roomCode).emit("meeting-settings-updated", {
                hostId: settings?.hostId,
                chatPermission: settings?.chatPermission || "Everyone",
                allowPrivateMessages: (settings?.chatPermission === "Private" || settings?.allowPrivateMessages),
                allowScreenShare: settings?.allowScreenShare
            });

            io.to(roomCode).emit("user-info-update", roomParticipants);
            io.to(roomCode).emit("participant-count-updated", { count: (connections[roomCode] || []).length });

            if (isHostSocket && pendingRequests[roomCode] && pendingRequests[roomCode].length > 0) {
                io.to(socket.id).emit("pending-join-requests-list", pendingRequests[roomCode]);
            }

            // Handle chat history translation for this user
            if (messages[roomCode] && messages[roomCode].length > 0) {
                for (let a = 0; a < messages[roomCode].length; ++a) {
                    const msgData = messages[roomCode][a];
                    const senderLang = socketUserInfo[msgData['socket-id-sender']]?.preferredLanguage || "en";
                    const recipientLang = preferredLanguage || "en";
                    let translatedMsg = msgData['data'];
                    let detectedLang = senderLang;
                    let success = true;

                    if (senderLang !== recipientLang) {
                        try {
                            const result = await translateText(msgData['data'], senderLang, recipientLang);
                            translatedMsg = result.translatedText;
                            detectedLang = result.detectedSourceLang || senderLang;
                        } catch(err) {
                            success = false;
                            translatedMsg = "Translation unavailable";
                        }
                    }

                    io.to(socket.id).emit("chat-message", msgData['data'],
                        msgData['sender'], msgData['socket-id-sender'], {
                            translatedMessage: translatedMsg,
                            fromLang: detectedLang,
                            toLang: recipientLang,
                            translationFailed: !success
                        });
                }
            }
        });

        // Update User Language Preference
        socket.on("user-info-update-language", (language) => {
            if (socketUserInfo[socket.id]) {
                socketUserInfo[socket.id].preferredLanguage = language;
                const roomCode = socketUserInfo[socket.id].room;
                if (!roomCode) return;

                const roomParticipants = (connections[roomCode] || [])
                    .filter(sid => socketUserInfo[sid] && socketUserInfo[sid].room === roomCode)
                    .map(sid => ({
                        socketId: sid,
                        username: socketUserInfo[sid]?.username || "Guest",
                        preferredLanguage: socketUserInfo[sid]?.preferredLanguage || "en",
                        isHandRaised: socketUserInfo[sid]?.isHandRaised || false,
                        isSpeaking: socketUserInfo[sid]?.isSpeaking || false,
                        audioEnabled: socketUserInfo[sid]?.audioEnabled !== undefined ? socketUserInfo[sid].audioEnabled : true,
                        videoEnabled: socketUserInfo[sid]?.videoEnabled !== undefined ? socketUserInfo[sid].videoEnabled : true,
                        isHost: socketUserInfo[sid]?.isHost || false
                    }));

                io.to(roomCode).emit("user-info-update", roomParticipants);
            }
        });

        // WebRTC Signaling Forwarder
        socket.on("signal", (toId, message) => {
            io.to(toId).emit("signal", socket.id, message);
        });

        // Chat messages with real-time translation broadcast
        socket.on("chat-message", async (data, sender) => {
            const roomCode = socketUserInfo[socket.id]?.room;
            if (!roomCode || !connections[roomCode]?.includes(socket.id)) return;

            const settings = await getRoomSettings(roomCode);
            if (settings && settings.chatPermission === "Disabled") {
                socket.emit("chat-error", "Chat is currently disabled by the host.");
                return;
            }

            if (!messages[roomCode]) {
                messages[roomCode] = [];
            }

            messages[roomCode].push({ 'sender': sender, "data": data, "socket-id-sender": socket.id });

            const senderLang = socketUserInfo[socket.id]?.preferredLanguage || "en";

            // Deliver to each socket in the room with dynamic translation
            for (const elem of (connections[roomCode] || [])) {
                const recipientLang = socketUserInfo[elem]?.preferredLanguage || "en";
                let translatedMessage = data;
                let success = true;
                let detectedLang = senderLang;

                if (senderLang !== recipientLang) {
                    try {
                        const result = await translateText(data, senderLang, recipientLang);
                        translatedMessage = result.translatedText;
                        detectedLang = result.detectedSourceLang || senderLang;
                    } catch (err) {
                        success = false;
                        translatedMessage = "Translation unavailable";
                    }
                }

                io.to(elem).emit("chat-message", data, sender, socket.id, {
                    translatedMessage,
                    fromLang: detectedLang,
                    toLang: recipientLang,
                    translationFailed: !success
                });
            }
        });

        // Direct Messaging (Private Messaging) Events
        socket.on("private-message", async (info) => {
            const { toSocketId, message } = info || {};
            const senderInfo = socketUserInfo[socket.id];
            const recipientInfo = socketUserInfo[toSocketId];

            if (!senderInfo || !recipientInfo) return;

            const room = senderInfo.room;
            if (senderInfo.room !== recipientInfo.room) {
                socket.emit("private-message-error", "Recipient is not in the same meeting.");
                return;
            }

            // Verify if private messages are currently enabled by the host
            const settings = await getRoomSettings(room);
            if (settings && settings.chatPermission !== "Private" && !settings.allowPrivateMessages) {
                socket.emit("private-message-error", "Private messaging is not enabled for this meeting.");
                return;
            }

            const senderLang = senderInfo.preferredLanguage || "en";
            const recipientLang = recipientInfo.preferredLanguage || "en";

            let translatedForRecipient = message;
            let detectedLang = senderLang;
            try {
                const result = await translateText(message, senderLang, recipientLang);
                translatedForRecipient = result.translatedText;
                detectedLang = result.detectedSourceLang || senderLang;
            } catch (err) {
                translatedForRecipient = "Translation unavailable";
            }

            // Save private message log to database if connected
            if (isDbConnected()) {
                try {
                    const privateMsg = new PrivateMessage({
                        senderId: senderInfo.username,
                        receiverId: recipientInfo.username,
                        meetingId: room,
                        message: message,
                        translatedMessage: translatedForRecipient,
                        language: detectedLang,
                        isRead: false
                    });
                    await privateMsg.save();
                } catch (dbErr) {
                    console.error("DB error saving private message:", dbErr);
                }
            }

            // Deliver to recipient
            io.to(toSocketId).emit("private-message", {
                senderSocketId: socket.id,
                senderUsername: senderInfo.username,
                message,
                translatedMessage: translatedForRecipient,
                fromLang: detectedLang,
                toLang: recipientLang,
                timestamp: new Date()
            });

            // Confirm delivery back to sender
            io.to(socket.id).emit("private-message-sent", {
                recipientSocketId: toSocketId,
                recipientUsername: recipientInfo.username,
                message,
                timestamp: new Date()
            });

            io.to(socket.id).emit("private-message-delivered", { recipientSocketId: toSocketId });
        });

        // Typing indicator channels
        socket.on("private-message-typing", (info) => {
            const { toSocketId, isTyping } = info || {};
            io.to(toSocketId).emit("private-message-typing", {
                senderSocketId: socket.id,
                isTyping
            });
        });

        // Read receipts
        socket.on("private-message-read", (info) => {
            const { toSocketId } = info || {};
            io.to(toSocketId).emit("private-message-read", {
                senderSocketId: socket.id
            });
        });

        // Media State Sync (Camera / Microphone ON/OFF)
        socket.on("media-state-changed", (info) => {
            const { audioEnabled, videoEnabled, room } = info || {};
            const roomCode = cleanRoom(room) || socketUserInfo[socket.id]?.room;

            if (socketUserInfo[socket.id]) {
                socketUserInfo[socket.id].audioEnabled = audioEnabled;
                socketUserInfo[socket.id].videoEnabled = videoEnabled;
                if (audioEnabled === false) {
                    socketUserInfo[socket.id].isSpeaking = false;
                }
            }

            if (roomCode) {
                io.to(roomCode).emit("media-state-changed", {
                    socketId: socket.id,
                    audioEnabled,
                    videoEnabled
                });
            }
        });

        // Active Speaker detection
        socket.on("active-speaker", (info) => {
            const { isSpeaking, room } = info || {};
            const roomCode = cleanRoom(room) || socketUserInfo[socket.id]?.room;
            const userMedia = socketUserInfo[socket.id];
            const effectiveSpeaking = (userMedia && userMedia.audioEnabled === false) ? false : !!isSpeaking;
            if (userMedia) {
                userMedia.isSpeaking = effectiveSpeaking;
            }
            if (roomCode) {
                socket.to(roomCode).emit("active-speaker", {
                    socketId: socket.id,
                    isSpeaking: effectiveSpeaking
                });
            }
        });

        // Screen Share locking controls
        socket.on("start-screen-share", (room) => {
            const roomCode = cleanRoom(room) || socketUserInfo[socket.id]?.room;
            if (!roomCode) return;

            if (activePresenters[roomCode] && activePresenters[roomCode] !== socket.id) {
                socket.emit("screen-share-rejected", "Another participant is already sharing their screen.");
                return;
            }
            activePresenters[roomCode] = socket.id;
            io.to(roomCode).emit("start-screen-share", {
                socketId: socket.id,
                username: socketUserInfo[socket.id]?.username || "Guest"
            });
        });

        socket.on("stop-screen-share", (room) => {
            const roomCode = cleanRoom(room) || socketUserInfo[socket.id]?.room;
            if (!roomCode) return;

            if (activePresenters[roomCode] === socket.id) {
                delete activePresenters[roomCode];
                io.to(roomCode).emit("stop-screen-share", {
                    socketId: socket.id
                });
            }
        });

        // Raise Hand controls
        socket.on("raise-hand", (info) => {
            const { isHandRaised, room } = info || {};
            const roomCode = cleanRoom(room) || socketUserInfo[socket.id]?.room;
            if (socketUserInfo[socket.id]) {
                socketUserInfo[socket.id].isHandRaised = isHandRaised;
            }
            if (roomCode) {
                io.to(roomCode).emit("raise-hand", {
                    socketId: socket.id,
                    isHandRaised
                });
            }
        });

        // Chat message reaction controls
        socket.on("chat-message-reaction", (info) => {
            const { emoji, room } = info || {};
            const roomCode = cleanRoom(room) || socketUserInfo[socket.id]?.room;
            if (roomCode) {
                socket.to(roomCode).emit("chat-message-reaction", {
                    emoji,
                    socketId: socket.id,
                    sender: socketUserInfo[socket.id]?.username || "Guest"
                });
            }
        });

        // Host permission updates
        socket.on("chat-permission-updated", async (info) => {
            const { room, chatPermission } = info || {};
            const roomCode = cleanRoom(room) || socketUserInfo[socket.id]?.room;
            if (!roomCode) return;

            // Security check: ONLY verified host can update
            const isAuthorizedHost = socketUserInfo[socket.id]?.isHost === true;
            if (!isAuthorizedHost) {
                socket.emit("host-action-rejected", "Only the host can update chat permissions.");
                return;
            }

            const isPrivateAllowed = (chatPermission === "Private");

            await saveRoomSettings(roomCode, {
                chatPermission,
                allowPrivateMessages: isPrivateAllowed
            });

            const meetingDoc = await getMeetingDoc(roomCode);
            if (meetingDoc && isDbConnected()) {
                try {
                    meetingDoc.chatPermission = chatPermission;
                    await meetingDoc.save();
                } catch (e) {}
            }

            io.to(roomCode).emit("chat-permission-updated", {
                chatPermission,
                allowPrivateMessages: isPrivateAllowed
            });
        });

        socket.on("end-meeting-everyone", async (info) => {
            const { room } = info || {};
            const roomCode = cleanRoom(room) || socketUserInfo[socket.id]?.room;
            if (!roomCode) return;

            // Security check: ONLY verified host can end meeting
            const isAuthorizedHost = socketUserInfo[socket.id]?.isHost === true;
            if (!isAuthorizedHost) {
                socket.emit("host-action-rejected", "Only the host can end the meeting for everyone.");
                return;
            }

            const meetingDoc = await getMeetingDoc(roomCode);
            if (meetingDoc && isDbConnected()) {
                try {
                    meetingDoc.status = "Ended";
                    await meetingDoc.save();
                } catch (e) {}
            }

            io.to(roomCode).emit("meeting-ended", {
                message: "The host has ended this meeting.",
                meetingCode: roomCode
            });

            console.log(`[SOCKET] Meeting ${roomCode} ended for everyone by host ${socketUserInfo[socket.id]?.username}`);
        });

        socket.on("private-chat-permission-updated", async (info) => {
            const { room, allowPrivateMessages } = info || {};
            const roomCode = cleanRoom(room) || socketUserInfo[socket.id]?.room;
            if (!roomCode) return;

            const isAuthorizedHost = socketUserInfo[socket.id]?.isHost === true;
            if (!isAuthorizedHost) return;

            await saveRoomSettings(roomCode, { allowPrivateMessages });
            io.to(roomCode).emit("private-chat-permission-updated", { allowPrivateMessages });
        });

        socket.on("screen-share-permission-updated", async (info) => {
            const { room, allowScreenShare } = info || {};
            const roomCode = cleanRoom(room) || socketUserInfo[socket.id]?.room;
            if (!roomCode) return;

            const isAuthorizedHost = socketUserInfo[socket.id]?.isHost === true;
            if (!isAuthorizedHost) return;

            await saveRoomSettings(roomCode, { allowScreenShare });
            io.to(roomCode).emit("screen-share-permission-updated", { allowScreenShare });
        });

        // Host commands
        socket.on("mute-participant", (info) => {
            const { toSocketId } = info || {};
            const isAuthorizedHost = socketUserInfo[socket.id]?.isHost === true;
            if (isAuthorizedHost && toSocketId) {
                io.to(toSocketId).emit("mute-participant-request");
            }
        });

        socket.on("remove-participant", (info) => {
            const { toSocketId } = info || {};
            const isAuthorizedHost = socketUserInfo[socket.id]?.isHost === true;
            if (isAuthorizedHost && toSocketId) {
                io.to(toSocketId).emit("remove-participant-request");
            }
        });

        // -------------------------------------------------------------
        // DISCONNECT & CLEANUP
        // -------------------------------------------------------------
        socket.on("disconnect", () => {
            console.log("[SOCKET] Client disconnected:", socket.id);

            // 1. Remove from pending join requests across all rooms
            for (let rCode in pendingRequests) {
                if (pendingRequests[rCode].some(r => r.socketId === socket.id)) {
                    pendingRequests[rCode] = pendingRequests[rCode].filter(r => r.socketId !== socket.id);
                    io.to(rCode).emit("cancel-join-request", { candidateSocketId: socket.id });
                }
            }

            const roomCode = socketUserInfo[socket.id]?.room;

            // 2. Release screen sharing presenter lock
            if (roomCode && activePresenters[roomCode] === socket.id) {
                delete activePresenters[roomCode];
                io.to(roomCode).emit("stop-screen-share", { socketId: socket.id });
            }

            // 3. Remove from approvedSockets
            if (roomCode && approvedSockets[roomCode]) {
                approvedSockets[roomCode].delete(socket.id);
            }

            // 4. Remove socket user info
            delete socketUserInfo[socket.id];
            delete timeOnline[socket.id];

            // 5. Remove from room connections and notify room
            for (const [rCode, clientList] of Object.entries(connections)) {
                const idx = clientList.indexOf(socket.id);
                if (idx !== -1) {
                    clientList.splice(idx, 1);

                    io.to(rCode).emit("user-left", socket.id);
                    io.to(rCode).emit("participant-count-updated", { count: clientList.length });

                    // Broadcast immediately updated participant list
                    const updatedParticipants = clientList
                        .filter(sid => socketUserInfo[sid] && socketUserInfo[sid].room === rCode)
                        .map(sid => ({
                            socketId: sid,
                            username: socketUserInfo[sid]?.username || "Guest",
                            preferredLanguage: socketUserInfo[sid]?.preferredLanguage || "en",
                            isHandRaised: socketUserInfo[sid]?.isHandRaised || false,
                            isSpeaking: socketUserInfo[sid]?.isSpeaking || false,
                            audioEnabled: socketUserInfo[sid]?.audioEnabled !== undefined ? socketUserInfo[sid].audioEnabled : true,
                            videoEnabled: socketUserInfo[sid]?.videoEnabled !== undefined ? socketUserInfo[sid].videoEnabled : true,
                            isHost: socketUserInfo[sid]?.isHost || false
                        }));

                    io.to(rCode).emit("user-info-update", updatedParticipants);

                    if (clientList.length === 0) {
                        delete connections[rCode];
                    }
                }
            }
        });
    });

    return io;
};
