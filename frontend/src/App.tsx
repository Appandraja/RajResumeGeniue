import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { NativeAuthListener } from './components/auth/NativeAuthListener';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { AppLayout } from './components/layout/AppLayout';
import { AuthProvider } from './context/AuthContext';
import AuthCallbackPage from './pages/AuthCallbackPage';
import DashboardPage from './pages/DashboardPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ImportResumePage from './pages/ImportResumePage';
import LoginPage from './pages/LoginPage';
import PlaceholderPage from './pages/PlaceholderPage';
import ProfilePage from './pages/ProfilePage';
import RegisterPage from './pages/RegisterPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import ResumeDetailPage from './pages/ResumeDetailPage';
import ResumeEditPage from './pages/ResumeEditPage';
import ResumeListPage from './pages/ResumeListPage';
import ResumeWizardPage from './pages/ResumeWizardPage';
import SettingsPage from './pages/SettingsPage';
import TemplateGalleryPage from './pages/TemplateGalleryPage';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <NativeAuthListener />
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          {/* Public (no app header) */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />

          {/* Signed-in area: guard, then the app shell (header, nav, sign out) */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/templates" element={<TemplateGalleryPage />} />
              <Route path="/resumes" element={<ResumeListPage />} />
              <Route path="/resumes/import" element={<ImportResumePage />} />
              <Route path="/resumes/new" element={<ResumeWizardPage />} />
              <Route path="/resumes/:id" element={<ResumeDetailPage />} />
              <Route path="/resumes/:id/edit" element={<ResumeEditPage />} />
            </Route>
          </Route>

          <Route path="*" element={<PlaceholderPage title="Not Found" />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
