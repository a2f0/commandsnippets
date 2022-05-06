import AppRouter from '../src/AppRouter';
import React from 'react';
import {render} from '@testing-library/react';

describe('appRouter', () => {
  it('Renders', async () => {
    expect(window.location.href).toBe('http://localhost:8081/');
    render(<AppRouter />);
  });
});
