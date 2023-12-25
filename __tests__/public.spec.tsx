import '@testing-library/jest-dom';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import AppRouter from '../src/AppRouter';
import React from 'react';

describe('Public Homepage', () => {
  it('Renders', async () => {
    render(<AppRouter />);
    await waitFor(() => screen.getByText(/Solve, Curate, Retrieve./i));
  });

  it('Has a window size', async () => {
    render(<AppRouter />);
    expect(window.innerWidth).toBe(1024);
    expect(window.innerHeight).toBe(768);
  });

  it('has a window that cen be resized', async () => {
    render(<AppRouter />);
    expect(window.innerWidth).toBe(1024);
    expect(window.innerHeight).toBe(768);
    window.innerWidth = 640;
    window.innerHeight = 480;
    fireEvent(window, new Event('resize'));
    expect(window.innerWidth).toBe(640);
    expect(window.innerHeight).toBe(480);
  });
});
