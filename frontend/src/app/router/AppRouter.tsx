import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { LoginPage } from '../../features/auth/pages/LoginPage';
import { RegisterPage } from '../../features/auth/pages/RegisterPage';
import { DashboardPage } from '../../features/dashboard/pages/DashboardPage';
import { DocumentDetailPage } from '../../features/documents/pages/DocumentDetailPage';
import { DocumentsPage } from '../../features/documents/pages/DocumentsPage';
import { ProfilePage } from '../../features/profile/pages/ProfilePage';
import { SettingsPage } from '../../features/settings/pages/SettingsPage';
import { TeamPage } from '../../features/team/pages/TeamPage';
import { FavoritesPage } from '../../features/favorites/pages/FavoritesPage';
import { SharedPage } from '../../features/shared/pages/SharedPage';
import { TrashPage } from '../../features/trash/pages/TrashPage';
import { GlobalLayout } from '../../layouts/GlobalLayout';
import { ProtectedRoute, PublicRoute } from './route-guards';

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<PublicRoute />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route element={<GlobalLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/documents" element={<DocumentsPage />} />
            <Route path="/documents/:id" element={<DocumentDetailPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/team" element={<TeamPage />} />
            <Route path="/favorites" element={<FavoritesPage />} />
            <Route path="/shared" element={<SharedPage />} />
            <Route path="/trash" element={<TrashPage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate replace to="/dashboard" />} />
      </Routes>
    </BrowserRouter>
  );
}
