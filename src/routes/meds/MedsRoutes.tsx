import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { MedIndex } from './MedIndex';
import { FactSheet } from './FactSheet';

/** Public reference pages, lazy-loaded from App.tsx. No admin or firebase/auth imports. */
export default function MedsRoutes() {
  return (
    <Routes>
      <Route index element={<MedIndex />} />
      <Route path=":medId" element={<FactSheetRoute />} />
      <Route path="*" element={<Navigate to="/meds" replace />} />
    </Routes>
  );
}

// Remount per med so one sheet's load state never shows under another med.
function FactSheetRoute() {
  const { medId } = useParams();
  return <FactSheet key={medId} />;
}
