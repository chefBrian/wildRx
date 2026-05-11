import { BrowserRouter, Routes, Route } from 'react-router-dom';
import CalculatorHome from './routes/CalculatorHome';
import AdminHome from './routes/AdminHome';
import NotFound from './routes/NotFound';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<CalculatorHome />} />
        <Route path="/admin/*" element={<AdminHome />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
