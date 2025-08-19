import '@testing-library/jest-dom';

import {createTheme, ThemeProvider} from '@mui/material/styles';
import {render, screen} from '@testing-library/react';
import {vi} from 'vitest';

import {Footer} from '../src/components/Footer';

const theme = createTheme();

const FooterWithTheme = () => (
  <ThemeProvider theme={theme}>
    <Footer />
  </ThemeProvider>
);

describe('Footer Component', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('renders footer in non-production environment', () => {
    vi.stubEnv('PROD', false);

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
    vi.stubEnv('PROD', true);

    const {container} = render(<FooterWithTheme />);

    expect(container.firstChild).toBeNull();
  });

  it('has correct links', () => {
    vi.stubEnv('PROD', false);

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
