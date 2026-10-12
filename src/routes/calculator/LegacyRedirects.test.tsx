import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import { LegacyResultRedirect, LegacyStepTwoRedirect } from './LegacyRedirects';

function Where() {
  const loc = useLocation();
  return <div>AT {loc.pathname}{loc.search}</div>;
}

function renderAt(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/calc/:medId" element={<LegacyStepTwoRedirect />} />
        <Route path="/calc/:medId/:speciesId/:weight" element={<LegacyResultRedirect />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('legacy /calc redirects', () => {
  it.each([
    ['/calc/m1/s1/1.2?conc=inj', 'AT /dose/s1/1.2/m1?conc=inj'],
    ['/calc/m1/s1/1.2', 'AT /dose/s1/1.2/m1'],
    ['/calc/m1?species=s1&weight=1.2&conc=inj', 'AT /dose/s1/1.2?open=m1'],
    ['/calc/m1?species=s1', 'AT /?species=s1'],
    ['/calc/m1?weight=2', 'AT /?weight=2'],
    ['/calc/m1', 'AT /'],
  ])('%s → %s', async (from, to) => {
    renderAt(from);
    expect(await screen.findByText(to)).toBeInTheDocument();
  });
});
