import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../../auth/AuthProvider';
import { RequireAuth } from '../../auth/RequireAuth';
import AdminHome from '../AdminHome';
import { Login } from './Login';
import { MedsTab } from './MedsTab';
import { AnimalsIndex } from './animals/AnimalsIndex';
import { SpeciesPage } from './animals/SpeciesPage';
import { GroupPage } from './animals/GroupPage';

export default function AdminApp() {
  return (
    <AuthProvider>
      <AdminRoutes />
    </AuthProvider>
  );
}

export function AdminRoutes() {
  return (
    <Routes>
      <Route path="login" element={<Login />} />
      <Route
        element={
          <RequireAuth>
            <AdminHome />
          </RequireAuth>
        }
      >
        <Route index element={<AnimalsIndex />} />
        <Route path="animals/species/:speciesId" element={<SpeciesPage />} />
        <Route path="animals/group/:group" element={<GroupPage />} />
        <Route path="meds" element={<MedsTab />} />
        {/* Old /admin/species and /admin/rules bookmarks, and anything else. */}
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Route>
    </Routes>
  );
}
