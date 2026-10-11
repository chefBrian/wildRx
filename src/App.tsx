import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, useParams } from 'react-router-dom';
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
        <Route path="/calc/:medId" element={<StepTwoRoute />} />
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

// Remount per med so concentration, species and weight state can't carry between /calc/:medId routes.
function StepTwoRoute() {
  const { medId } = useParams();
  return <SpeciesAndWeight key={medId} />;
}
