import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, useParams } from 'react-router-dom';
import CalculatorHome from './routes/CalculatorHome';
import NotFound from './routes/NotFound';
import { MedList } from './routes/calculator/MedList';
import { Result } from './routes/calculator/Result';
import { LegacyResultRedirect, LegacyStepTwoRedirect } from './routes/calculator/LegacyRedirects';

const AdminApp = lazy(() => import('./routes/admin/AdminApp'));
const MedsRoutes = lazy(() => import('./routes/meds/MedsRoutes'));

const AdminFallback = () => (
  <main className="mx-auto max-w-3xl px-5 pt-10 text-[14px] italic text-ink2">
    Loading admin…
  </main>
);

const MedsFallback = () => (
  <main className="mx-auto max-w-md px-5 pt-10" role="status">
    <span className="sr-only">Loading…</span>
    <div className="h-8 w-2/3 bg-cream rounded animate-pulse" />
    <div className="mt-6 h-14 w-full bg-cream rounded animate-pulse" />
  </main>
);

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<CalculatorHome />} />
        <Route path="/dose/:speciesId/:weight" element={<MedListRoute />} />
        <Route path="/dose/:speciesId/:weight/:medId" element={<Result />} />
        <Route
          path="/meds/*"
          element={
            <Suspense fallback={<MedsFallback />}>
              <MedsRoutes />
            </Suspense>
          }
        />
        <Route path="/calc/:medId" element={<LegacyStepTwoRedirect />} />
        <Route path="/calc/:medId/:speciesId/:weight" element={<LegacyResultRedirect />} />
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

// Remount per patient so filter and bottle-pick state can't carry between animals or weights.
function MedListRoute() {
  const { speciesId, weight } = useParams();
  return <MedList key={`${speciesId}/${weight}`} />;
}
