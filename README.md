# Connect Meet

Connect Meet is a premium, secure, and modern full-stack video conferencing application built with the MERN stack (MongoDB, Express, React, Node.js), Socket.io, and WebRTC.

## Tech Stack
- **Frontend**: React 19, Vite, Framer Motion (Animations), React Hook Form, Zod, Axios, Lucide Icons, Vanilla CSS
- **Backend**: Node.js, Express, Socket.io (Signaling & Chat), Mongoose, MongoDB
- **APIs & Communication**: WebRTC (RTCPeerConnection with STUN signaling)

---

## Features
- **Modern Landing Page**: High fidelity, responsive, feature logs, pricing models.
- **Premium MERN Auth**: Clean login/register tabs, client-side React Hook Form schema validation, and token persistence.
- **Interactive Dashboard**: Meeting status counts, recent room history, and action controls to create or join a meeting code.
- **Redesigned Meeting Room**:
  - Pre-meeting join lobby to enter credentials and preview local video.
  - Video stream grids adjusting dynamically based on active connections.
  - Responsive floating action toolbar.
  - Real-time text chat drawer powered by WebSockets.
- **Dark Mode Support**: Persisted dark/light styling preferences using CSS variables.

---

## Directory Layout

```
├── backend/
│   ├── src/
│   │   ├── controllers/      # Socket signaling logic & user controller
│   │   ├── models/           # Mongoose schemas (User, Meeting)
│   │   ├── routes/           # User authentication & history APIs
│   │   └── app.js            # Node startup script
│   └── .env                  # Port & DB connection strings
│
└── frontend/
    ├── public/               # Static assets & metadata
    ├── src/
    │   ├── api/              # Module Axios wrappers
    │   ├── components/       # Reusable layout and custom UI controls
    │   ├── context/          # React contexts (Auth, Theme, Toast)
    │   ├── pages/            # Core page designs
    │   ├── styles/           # Global theme colors and variables
    │   ├── utils/            # Helper validation wrappers (withAuth)
    │   ├── App.jsx           # Main application setup
    │   └── main.jsx          # Entry point
    ├── index.html            # Vite template root
    └── vite.config.js        # Vite compilation configuration
```

---

## Environment Configuration

### Backend Setup
Create a `.env` file under `/backend` with the following variables:
```env
PORT=8000
MONGO_URI=<your-mongodb-atlas-uri>
JWT_SECRET=<your-jwt-signing-secret>
```

### Frontend Setup
Create a `.env` file under `/frontend` with the following variable:
```env
VITE_API_URL=http://localhost:8000
```

---

## Getting Started

### 1. Run the Backend
```bash
cd backend
npm install
npm start
```
*The backend server will run at `http://localhost:8000`.*

### 2. Run the Frontend
```bash
cd frontend
npm install
npm run dev
```
*The development server will boot at `http://localhost:3000`.*

---

## Verification & Build
Ensure code compiles error-free by executing:
```bash
cd frontend
npm run build
```
This bundles the optimized codebase inside `/dist`.
