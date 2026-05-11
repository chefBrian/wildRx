import { BrowserRouter, Routes, Route } from 'react-router-dom';
import CalculatorHome from './routes/CalculatorHome';
import AdminHome from './routes/AdminHome';
import NotFound from './routes/NotFound';
import { SpeciesAndWeight } from './routes/calculator/SpeciesAndWeight';
import { Result } from './routes/calculator/Result';
import { Login } from './routes/admin/Login';
import { RequireAuth } from './auth/RequireAuth';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<CalculatorHome />} />
        <Route path="/admin/login" element={<Login />} />
        <Route path="/admin/*" element={<RequireAuth><AdminHome /></RequireAuth>} />
        <Route path="/calc/:medId" element={<SpeciesAndWeight />} />
        <Route path="/calc/:medId/:speciesId/:weight" element={<Result />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
