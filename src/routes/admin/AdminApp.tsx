import { Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../../auth/AuthProvider';
import { RequireAuth } from '../../auth/RequireAuth';
import AdminHome from '../AdminHome';
import { Login } from './Login';
import { MedsTab } from './MedsTab';
import { SpeciesTab } from './SpeciesTab';
import { RulesTab } from './RulesTab';

export default function AdminApp() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="login" element={<Login />} />
        <Route
          element={
            <RequireAuth>
              <AdminHome />
            </RequireAuth>
          }
        >
          <Route index element={<MedsTab />} />
          <Route path="species" element={<SpeciesTab />} />
          <Route path="rules" element={<RulesTab />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}
