import '@testing-library/jest-dom';
import {render, screen} from '@testing-library/react';
import AppRouter from '../src/AppRouter';
import React from 'react';

describe('appRouter', () => {
  it('Renders', async () => {
    expect(window.location.href).toBe('http://localhost:8081/');
    render(<AppRouter />);
    expect(screen.getByText(/Login with Google/i)).toBeInTheDocument();
    expect(screen.getByText(/Login with GitHub/i)).toBeInTheDocument();
  });
});
