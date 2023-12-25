import '@testing-library/jest-dom';
import {render, screen, waitFor} from '@testing-library/react';
import AppRouter from '../src/AppRouter';
import React from 'react';

describe('Public Homepage', () => {
  it('Renders', async () => {
    render(<AppRouter />);
    await waitFor(() => screen.getByText(/Solve, Curate, Retrieve./i));
  });

  it('Has a window size', async () => {
    render(<AppRouter />);
    expect(window.innerHeight).toBe(768);
    expect(window.innerWidth).toBe(1024);
  });
});
