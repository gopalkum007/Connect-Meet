// Determines API/Socket.IO server URL based on environment configuration or current origin in production
let server = import.meta.env.VITE_API_URL;

if (!server) {
  if (typeof window !== "undefined" && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
    server = window.location.origin;
  } else {
    server = "http://localhost:8000";
  }
}

// Strip trailing slash if present
server = server.replace(/\/$/, "");

export default server;