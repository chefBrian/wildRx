import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import CalculatorHome from './routes/CalculatorHome';
import NotFound from './routes/NotFound';
import { SpeciesAndWeight } from './routes/calculator/SpeciesAndWeight';
import { Result } from './routes/calculator/Result';

const AdminApp = lazy(() => import('./routes/admin/AdminApp'));

const AdminFallback = () => (
  <main className="mx-auto max-w-3xl px-5 pt-10 text-[14px] italic text-ink2">
    Loading admin…
  </main>
);

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<CalculatorHome />} />
        <Route path="/calc/:medId" element={<SpeciesAndWeight />} />
        <Route path="/calc/:medId/:speciesId/:weight" element={<Result />} />
        <Route
          path="/admin/*"
          element={
            <Suspense fallback={<AdminFallback />}>
              <AdminApp />
            </Suspense>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
