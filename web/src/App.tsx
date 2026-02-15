import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { AdminLayout } from './components/layout/AdminLayout';
import { SurgeonLayout } from './components/layout/SurgeonLayout';
import { StaffLayout } from './components/layout/StaffLayout';

// Auth pages
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { ConnectionTest } from './pages/auth/ConnectionTest';

// Admin pages
import { AdminDashboardPage } from './pages/admin/DashboardPage';
import { SpecialtiesPage } from './pages/admin/SpecialtiesPage';
import { SpecialtyDetailPage } from './pages/admin/SpecialtyDetailPage';
import { OperationEditorPage } from './pages/admin/OperationEditorPage';
import { VersionHistoryPage } from './pages/admin/VersionHistoryPage';
import { UsersPage } from './pages/admin/UsersPage';

// Surgeon pages
import { SurgeonDashboardPage } from './pages/surgeon/DashboardPage';
import { OnboardingPage } from './pages/surgeon/OnboardingPage';
import { MyProceduresPage } from './pages/surgeon/MyProceduresPage';
import { ImportProceduresPage } from './pages/surgeon/ImportProceduresPage';
import { ProcedureEditorPage } from './pages/surgeon/ProcedureEditorPage';
import { ContentBuilderPage } from './pages/surgeon/ContentBuilderPage';
import { PatientsPage } from './pages/surgeon/PatientsPage';
import { ConsentsPage } from './pages/surgeon/ConsentsPage';
import { ConsentReviewPage } from './pages/surgeon/ConsentReviewPage';
import { QRFormPagesPage } from './pages/surgeon/QRFormPagesPage';
import { QRFormPageEditorPage } from './pages/surgeon/QRFormPageEditorPage';
import { SettingsPage } from './pages/surgeon/SettingsPage';
import { StaffPage } from './pages/surgeon/StaffPage';

// Staff pages
import { StaffDashboardPage } from './pages/staff/DashboardPage';
import { InvitationsPage } from './pages/staff/InvitationsPage';
import { StaffManagementPage } from './pages/staff/StaffManagementPage';

// Shared pages
import { MessagesPage } from './pages/shared/MessagesPage';

const roleRedirectMap: Record<string, string> = {
  admin: '/admin',
  surgeon: '/surgeon',
  manager: '/staff',
  nurse: '/staff',
};

function RootRedirect() {
  const { profile, loading } = useAuth();
  if (loading) return null;
  if (!profile) return <Navigate to="/login" replace />;
  return <Navigate to={roleRedirectMap[profile.role] || '/'} replace />;
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/test" element={<ConnectionTest />} />

          {/* Root redirect */}
          <Route path="/" element={<RootRedirect />} />

          {/* Admin routes */}
          <Route path="/admin" element={<ProtectedRoute requiredRole="admin"><AdminLayout /></ProtectedRoute>}>
            <Route index element={<AdminDashboardPage />} />
            <Route path="master-list" element={<SpecialtiesPage />} />
            <Route path="master-list/:specialtyId" element={<SpecialtyDetailPage />} />
            <Route path="master-list/:specialtyId/new" element={<OperationEditorPage />} />
            <Route path="master-list/:specialtyId/edit/:procedureId" element={<OperationEditorPage />} />
            <Route path="master-list/:specialtyId/history/:procedureId" element={<VersionHistoryPage />} />
            <Route path="users" element={<UsersPage />} />
          </Route>

          {/* Surgeon routes */}
          <Route path="/surgeon" element={<ProtectedRoute requiredRole="surgeon"><SurgeonLayout /></ProtectedRoute>}>
            <Route index element={<SurgeonDashboardPage />} />
            <Route path="onboarding" element={<OnboardingPage />} />
            <Route path="procedures" element={<MyProceduresPage />} />
            <Route path="procedures/import" element={<ImportProceduresPage />} />
            <Route path="procedures/new" element={<ProcedureEditorPage />} />
            <Route path="procedures/edit/:procedureId" element={<ProcedureEditorPage />} />
            <Route path="procedures/:procedureId/content" element={<ContentBuilderPage />} />
            <Route path="patients" element={<PatientsPage />} />
            <Route path="consents" element={<ConsentsPage />} />
            <Route path="consents/:consentId" element={<ConsentReviewPage />} />
            <Route path="qr-pages" element={<QRFormPagesPage />} />
            <Route path="qr-pages/:pageId" element={<QRFormPageEditorPage />} />
            <Route path="staff" element={<StaffPage />} />
            <Route path="messages" element={<MessagesPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>

          {/* Staff routes (manager & nurse) */}
          <Route path="/staff" element={<ProtectedRoute requiredRole={['manager', 'nurse']}><StaffLayout /></ProtectedRoute>}>
            <Route index element={<StaffDashboardPage />} />
            <Route path="invitations" element={<InvitationsPage />} />
            <Route path="patients" element={<PatientsPage />} />
            <Route path="consents" element={<ConsentsPage />} />
            <Route path="consents/:consentId" element={<ConsentReviewPage />} />
            <Route path="staff-management" element={<StaffManagementPage />} />
            <Route path="messages" element={<MessagesPage />} />
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
