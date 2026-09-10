const isLocalhost = typeof window !== "undefined" && (
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1" ||
  window.location.hostname === "[::1]"
);

let server = import.meta.env.VITE_API_URL;

// If running in local browser, default to local backend on port 8000
if (isLocalhost) {
  if (!server || (!server.includes("localhost") && !server.includes("127.0.0.1"))) {
    server = "http://localhost:8000";
  }
} else if (!server) {
  if (typeof window !== "undefined") {
    server = window.location.origin;
  } else {
    server = "http://localhost:8000";
  }
}

// Strip trailing slash if present
server = (server || "http://localhost:8000").replace(/\/$/, "");

export default server;