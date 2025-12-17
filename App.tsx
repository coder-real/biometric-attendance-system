import React from "react";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import Login from "./components/Login";
import Dashboard from "./components/Dashboard";
import ProtectedRoute from "./components/ProtectedRoute";
import FingerprintPortal from "./components/FingerprintPortal";
import ExamVerification from "./components/ExamVerification";

import GlobalAttendanceListener from "./components/GlobalAttendanceListener";

export default function App() {
  return (
    <AuthProvider>
      <GlobalAttendanceListener />
      <HashRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/portal" element={<FingerprintPortal />} />
          <Route path="/verify" element={<ExamVerification />} />

          {/* Protected routes */}
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<Dashboard />} />
          </Route>

          {/* Catch-all redirect */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </HashRouter>
    </AuthProvider>
  );
}
