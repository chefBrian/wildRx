import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, Link } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UpdateGate } from './UpdateGate';
import { markUpdateReady, resetUpdateState, shouldReloadNow } from './updates';

beforeEach(() => resetUpdateState());

function renderAt(url: string, reload = vi.fn()) {
  render(
    <MemoryRouter initialEntries={[url]}>
      <UpdateGate reload={reload}>
        <Routes>
          <Route path="/" element={<Link to="/dose/rth/1.2">Choose medication</Link>} />
          <Route path="/dose/rth/1.2" element={<div>MED LIST</div>} />
          <Route path="/admin" element={<Link to="/admin/meds">Meds tab</Link>} />
          <Route path="/admin/meds" element={<Link to="/">View calculator</Link>} />
        </Routes>
      </UpdateGate>
    </MemoryRouter>
  );
  return reload;
}

describe('UpdateGate', () => {
  it('keeps the current screen when an update arrives, then reloads on the next screen change', async () => {
    const user = userEvent.setup();
    const reload = renderAt('/');
    act(() => markUpdateReady('/'));
    expect(reload).not.toHaveBeenCalled();
    expect(screen.getByText('Choose medication')).toBeInTheDocument();
    await user.click(screen.getByText('Choose medication'));
    expect(reload).toHaveBeenCalledTimes(1);
    // The old build never renders the new screen.
    expect(screen.queryByText('MED LIST')).not.toBeInTheDocument();
  });

  it('does nothing without an update', async () => {
    const user = userEvent.setup();
    const reload = renderAt('/');
    await user.click(screen.getByText('Choose medication'));
    expect(screen.getByText('MED LIST')).toBeInTheDocument();
    expect(reload).not.toHaveBeenCalled();
  });

  it('shows a banner in admin instead of reloading, so unsaved edits survive', async () => {
    const user = userEvent.setup();
    const reload = renderAt('/admin');
    act(() => markUpdateReady('/admin'));
    expect(screen.getByRole('status')).toHaveTextContent("A new version is available. Reload when you've saved.");
    await user.click(screen.getByText('Meds tab'));
    expect(reload).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: /reload/i }));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('reloads when leaving admin for the calculator', async () => {
    const user = userEvent.setup();
    const reload = renderAt('/admin/meds');
    act(() => markUpdateReady('/admin/meds'));
    await user.click(screen.getByText('View calculator'));
    expect(reload).toHaveBeenCalledTimes(1);
  });
});

describe('shouldReloadNow', () => {
  it('reloads a hidden calculator right away, never admin', () => {
    expect(shouldReloadNow({ hidden: true, pathname: '/dose/rth/1.2' })).toBe(true);
    expect(shouldReloadNow({ hidden: false, pathname: '/dose/rth/1.2' })).toBe(false);
    expect(shouldReloadNow({ hidden: true, pathname: '/admin/meds' })).toBe(false);
    expect(shouldReloadNow({ hidden: true, pathname: '/administer' })).toBe(true);
  });
});
