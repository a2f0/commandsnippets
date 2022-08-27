import '@testing-library/jest-dom';
import {render, screen} from '@testing-library/react';
import AppRouter from '../src/AppRouter';
import React from 'react';
import userEvent from '@testing-library/user-event';

describe('appRouter', () => {
  it('Renders', async () => {
    localStorage.removeItem('mst-tearleads-test');
    expect(window.location.href).toBe('http://localhost:8081/');
    render(<AppRouter />);
    const user = userEvent.setup();
    const fileMenu = screen.getByRole('menu', {name: 'File'});
    await user.pointer({target: fileMenu, keys: '[MouseLeft]'});
    // expect(screen.getByText(/Login with Google/i)).toBeInTheDocument();
    // expect(screen.getByText(/Login with GitHub/i)).toBeInTheDocument();
    // expect(screen.getByText(/Solve, Curate, Retrieve./i)).toBeInTheDocument();
  });
});
