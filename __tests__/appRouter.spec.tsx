import '@testing-library/jest-dom';
import {render, screen} from '@testing-library/react';
import AppRouter from '../src/AppRouter';
import React from 'react';
import server from './msw';
import userEvent from '@testing-library/user-event';

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('appRouter', () => {
  it('Renders', async () => {
    const user = userEvent.setup();
    localStorage.removeItem('mst-tearleads-test');
    expect(window.location.href).toBe('http://localhost:8081/');
    render(<AppRouter />);
    const fileMenu = screen.getByRole('menu', {name: 'File'});
    await user.pointer({target: fileMenu, keys: '[MouseLeft]'});
    const logoutButton = screen.getByText('Logout');
    expect(screen.queryByText('Login with Google')).toBeNull();
    expect(screen.queryByText('Login with GitHub')).toBeNull();
    await user.pointer({target: logoutButton, keys: '[MouseLeft]'});
    expect(screen.getByText('Login with Google')).toBeInTheDocument();
    expect(screen.getByText('Login with GitHub')).toBeInTheDocument();
    // expect(screen.getByText(/Solve, Curate, Retrieve./i)).toBeInTheDocument();
  });
});
