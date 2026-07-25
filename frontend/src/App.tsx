import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthPage } from './pages/AuthPage';
import { TripsListPage } from './pages/TripsListPage';
import { TripRoomPage } from './pages/TripRoomPage';
import { ProtectedRoute } from './components/ProtectedRoute';

export default function App() {
  return (
    <Routes>
      <Route path="/auth" element={<AuthPage />} />
      <Route
        path="/trips"
        element={
          <ProtectedRoute>
            <TripsListPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/trips/:id"
        element={
          <ProtectedRoute>
            <TripRoomPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/trips" replace />} />
    </Routes>
  );
}
