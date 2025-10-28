import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import Home from './page';

describe('Home', () => {
  it('renders the Next.js logo', () => {
    render(<Home />);
    const logo = screen.getByAltText('Next.js logo');
    expect(logo).toBeInTheDocument();
  });

  it('renders the Deploy now link', () => {
    render(<Home />);
    const deployLink = screen.getByRole('link', { name: /deploy now/i });
    expect(deployLink).toBeInTheDocument();
    expect(deployLink).toHaveAttribute(
      'href',
      expect.stringContaining('vercel.com/new')
    );
  });

  it('renders the Read our docs link', () => {
    render(<Home />);
    const docsLink = screen.getByRole('link', { name: /read our docs/i });
    expect(docsLink).toBeInTheDocument();
    expect(docsLink).toHaveAttribute(
      'href',
      expect.stringContaining('nextjs.org/docs')
    );
  });

  it('renders the getting started text', () => {
    render(<Home />);
    const gettingStartedText = screen.getByText(/get started by editing/i);
    expect(gettingStartedText).toBeInTheDocument();
  });
});
