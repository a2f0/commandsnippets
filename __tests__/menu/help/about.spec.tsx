import '@testing-library/jest-dom';
import {render, screen} from '@testing-library/react';
import AppRouter from '../../../src/AppRouter';
import React from 'react';
import userEvent from '@testing-library/user-event';

describe('Help Menu', () => {
  it('Is clickable', async () => {
    const user = userEvent.setup();
    expect(window.location.href).toBe('http://localhost:8081/');
    render(<AppRouter />);
    const helpMenu = screen.getByRole('menu', {name: 'Help'});
    await user.pointer({target: helpMenu, keys: '[MouseLeft]'});
  });
});
