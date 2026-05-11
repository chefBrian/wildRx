import { BrowserRouter, Routes, Route } from 'react-router-dom';
import CalculatorHome from './routes/CalculatorHome';
import AdminHome from './routes/AdminHome';
import NotFound from './routes/NotFound';
import { SpeciesAndWeight } from './routes/calculator/SpeciesAndWeight';
import { Result } from './routes/calculator/Result';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<CalculatorHome />} />
        <Route path="/admin/*" element={<AdminHome />} />
        <Route path="/calc/:medId" element={<SpeciesAndWeight />} />
        <Route path="/calc/:medId/:speciesId/:weight" element={<Result />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
