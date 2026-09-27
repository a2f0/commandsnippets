import '@testing-library/jest-dom';

import {createTheme, ThemeProvider} from '@mui/material/styles';
import {render, screen} from '@testing-library/react';
import {vi} from 'vitest';

import {Footer} from '../src/components/public_home_page/Footer';
import * as envModule from '../src/lib/environment';

const theme = createTheme();

const FooterWithTheme = () => (
  <ThemeProvider theme={theme}>
    <Footer />
  </ThemeProvider>
);

describe('Footer Component', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders footer in non-production environment', () => {
    vi.spyOn(envModule, 'environment', 'get').mockReturnValue('development');

    render(<FooterWithTheme />);

    expect(screen.getByText('Privacy Policy')).toBeInTheDocument();
    expect(screen.getByText('Terms of Service')).toBeInTheDocument();
    expect(screen.getByText('Contact Us')).toBeInTheDocument();
    expect(screen.getByText('About')).toBeInTheDocument();
    expect(
      screen.getByText(/© \d{4} Tearleads\. All rights reserved\./)
    ).toBeInTheDocument();
  });

  it('does not render footer in production environment', () => {
    vi.spyOn(envModule, 'environment', 'get').mockReturnValue('production');

    const {container} = render(<FooterWithTheme />);

    expect(container.firstChild).toBeNull();
  });

  it('has correct links', () => {
    vi.spyOn(envModule, 'environment', 'get').mockReturnValue('test');

    render(<FooterWithTheme />);

    expect(screen.getByRole('link', {name: 'Privacy Policy'})).toHaveAttribute(
      'href',
      '/privacy'
    );
    expect(
      screen.getByRole('link', {name: 'Terms of Service'})
    ).toHaveAttribute('href', '/terms');
    expect(screen.getByRole('link', {name: 'Contact Us'})).toHaveAttribute(
      'href',
      '/contact'
    );
    expect(screen.getByRole('link', {name: 'About'})).toHaveAttribute(
      'href',
      '/about'
    );
  });
});
