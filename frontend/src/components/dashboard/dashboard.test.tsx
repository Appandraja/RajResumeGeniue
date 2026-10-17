import { ChakraProvider } from '@chakra-ui/react';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { AtsScoreBadge, getAtsLevel } from './AtsScoreBadge';
import { RecentResumes } from './RecentResumes';
import { computeStats } from './stats';
import type { Resume } from '../../types';

const wrap = (ui: ReactNode) =>
  render(
    <ChakraProvider>
      <MemoryRouter>{ui}</MemoryRouter>
    </ChakraProvider>,
  );

const makeResume = (id: number, score: number | null): Resume => ({
  id,
  user_id: 1,
  template_id: 1,
  title: `Resume ${id}`,
  full_name: null,
  email: null,
  phone: null,
  location: null,
  linkedin_url: null,
  website_url: null,
  summary: null,
  skills: [],
  ats_score: score,
  sections: [],
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-02T00:00:00Z',
});

describe('AtsScoreBadge thresholds', () => {
  it('maps scores to levels at the boundaries', () => {
    expect(getAtsLevel(0)).toBe('low');
    expect(getAtsLevel(49)).toBe('low');
    expect(getAtsLevel(50)).toBe('medium');
    expect(getAtsLevel(79)).toBe('medium');
    expect(getAtsLevel(80)).toBe('high');
    expect(getAtsLevel(100)).toBe('high');
  });

  it('shows a text label alongside the score', () => {
    wrap(<AtsScoreBadge score={85} />);
    expect(screen.getByText(/ATS 85/)).toHaveTextContent('Excellent');
  });

  it('handles unscored resumes', () => {
    wrap(<AtsScoreBadge score={null} />);
    expect(screen.getByText('Not scored')).toBeInTheDocument();
  });
});

describe('dashboard stats', () => {
  it('computes average and best ignoring unscored resumes', () => {
    const stats = computeStats([makeResume(1, 60), makeResume(2, 90), makeResume(3, null)]);
    expect(stats).toEqual({ total: 3, averageScore: 75, bestScore: 90 });
  });
});

describe('RecentResumes', () => {
  it('renders the friendly empty state', () => {
    wrap(<RecentResumes resumes={[]} templateNames={{}} />);
    expect(screen.getByTestId('dashboard-empty')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create my first resume/i })).toBeInTheDocument();
  });

  it('renders resumes with view and edit links', () => {
    wrap(<RecentResumes resumes={[makeResume(7, 55)]} templateNames={{ 1: 'Classic' }} />);
    expect(screen.getByText('Resume 7')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View' })).toHaveAttribute('href', '/resumes/7');
    expect(screen.getByRole('link', { name: 'Edit' })).toHaveAttribute('href', '/resumes/7/edit');
  });
});
