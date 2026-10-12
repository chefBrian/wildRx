import { Navigate, useParams, useSearchParams } from 'react-router-dom';

const enc = encodeURIComponent;

/** Old result links: /calc/:medId/:speciesId/:weight?conc= → /dose/:speciesId/:weight/:medId?conc= */
export function LegacyResultRedirect() {
  const { medId = '', speciesId = '', weight = '' } = useParams();
  const [params] = useSearchParams();
  const conc = params.get('conc');
  const query = conc !== null ? `?conc=${enc(conc)}` : '';
  return <Navigate to={`/dose/${enc(speciesId)}/${enc(weight)}/${enc(medId)}${query}`} replace />;
}

/** Old step-2 links: /calc/:medId?species=&weight= → the med list with that med open, or the patient screen. */
export function LegacyStepTwoRedirect() {
  const { medId = '' } = useParams();
  const [params] = useSearchParams();
  const species = params.get('species');
  const weight = params.get('weight');
  if (species && weight) {
    return <Navigate to={`/dose/${enc(species)}/${enc(weight)}?open=${enc(medId)}`} replace />;
  }
  const keep = new URLSearchParams();
  if (species) keep.set('species', species);
  if (weight) keep.set('weight', weight);
  const qs = keep.toString();
  return <Navigate to={qs ? `/?${qs}` : '/'} replace />;
}
