import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { NativeAuthListener } from './components/auth/NativeAuthListener';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { AuthProvider } from './context/AuthContext';
import AuthCallbackPage from './pages/AuthCallbackPage';
import DashboardPage from './pages/DashboardPage';
import LoginPage from './pages/LoginPage';
import PlaceholderPage from './pages/PlaceholderPage';
import ProfilePage from './pages/ProfilePage';
import RegisterPage from './pages/RegisterPage';
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

          {/* Public */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route path="/templates" element={<TemplateGalleryPage />} />

          {/* Protected */}
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/resumes" element={<ResumeListPage />} />
            <Route path="/resumes/new" element={<ResumeWizardPage />} />
            <Route path="/resumes/:id" element={<ResumeDetailPage />} />
            <Route path="/resumes/:id/edit" element={<ResumeEditPage />} />
          </Route>

          <Route path="*" element={<PlaceholderPage title="Not Found" />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
