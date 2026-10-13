import { ChakraProvider } from '@chakra-ui/react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as resumeService from '../../services/resumeService';
import * as tailorService from '../../services/tailorService';
import type { Resume } from '../../types';
import type { TailorResult } from '../../types/tailor';
import { TailorPanel, skillsAfterAction } from './TailorPanel';

vi.mock('../../services/resumeService', () => ({
  updateResume: vi.fn(),
  getApiErrorMessage: (_e: unknown, fallback: string) => fallback,
}));
vi.mock('../../services/tailorService', () => ({ analyzeTailor: vi.fn() }));

const resume = {
  id: 9,
  user_id: 1,
  template_id: 1,
  title: 'My CV',
  skills: ['Python', 'SQL'],
  sections: [],
  job_title: 'Data Engineer',
  company: null,
  job_description: 'We need Python and Docker.',
} as unknown as Resume;

const result: TailorResult = {
  match_score: 62,
  job_title: 'Data Engineer',
  matched: [{ keyword: 'Python', importance: 'high', where: ['skills'] }],
  missing: [
    { keyword: 'Docker', importance: 'high', suggestion: 'Add Docker only if you have used it.' },
    { keyword: 'Kafka', importance: 'low', suggestion: 'Mention Kafka if relevant.' },
  ],
  suggestions: [
    {
      code: 'add_skill',
      severity: 'high',
      section: 'skills',
      message: 'Add Docker to your skills',
      action: { type: 'add_skill', value: 'Docker' },
    },
    { code: 'info', severity: 'low', section: null, message: 'Quantify your results', action: null },
  ],
  ats: { score: 80, suggestions: [] },
};

const renderPanel = (onResumeChanged = vi.fn().mockResolvedValue(undefined)) => {
  render(
    <ChakraProvider>
      <TailorPanel resume={resume} onResumeChanged={onResumeChanged} />
    </ChakraProvider>,
  );
  return onResumeChanged;
};

describe('TailorPanel', () => {
  beforeEach(() => vi.clearAllMocks());

  it('prefills the job fields and shows score, keywords and suggestions', async () => {
    vi.mocked(tailorService.analyzeTailor).mockResolvedValue(result);
    renderPanel();
    expect(screen.getByLabelText(/job title/i)).toHaveValue('Data Engineer');
    expect(screen.getByLabelText(/paste the job description/i)).toHaveValue(
      'We need Python and Docker.',
    );
    await userEvent.click(screen.getByRole('button', { name: /analyze match/i }));
    expect(tailorService.analyzeTailor).toHaveBeenCalledWith(9, 'We need Python and Docker.');
    expect(await screen.findByText(/partial match: 62 out of 100/i)).toBeInTheDocument();
    expect(screen.getByText(/estimate of keyword coverage, not a guarantee/i)).toBeInTheDocument();
    expect(screen.getByText('Python')).toBeInTheDocument();
    expect(screen.getByText(/Add Docker only if you have used it/)).toBeInTheDocument();
    expect(screen.getByText('Quantify your results')).toBeInTheDocument();
    // Only the suggestion with an action has an Apply button.
    expect(screen.getAllByRole('button', { name: /^apply:/i })).toHaveLength(1);
  });

  it('asks for confirmation, then applies, refreshes and re-analyzes', async () => {
    vi.mocked(tailorService.analyzeTailor).mockResolvedValue(result);
    vi.mocked(resumeService.updateResume).mockResolvedValue(resume);
    const onChanged = renderPanel();
    await userEvent.click(screen.getByRole('button', { name: /analyze match/i }));
    await userEvent.click(await screen.findByRole('button', { name: /^apply:/i }));

    expect(await screen.findByText(/only add skills you really have/i)).toBeInTheDocument();
    expect(resumeService.updateResume).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: /yes, apply it/i }));
    await waitFor(() =>
      expect(resumeService.updateResume).toHaveBeenCalledWith(9, {
        skills: ['Python', 'SQL', 'Docker'],
      }),
    );
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    await waitFor(() => expect(tailorService.analyzeTailor).toHaveBeenCalledTimes(2));
  });

  it('does nothing when the confirmation is cancelled', async () => {
    vi.mocked(tailorService.analyzeTailor).mockResolvedValue(result);
    renderPanel();
    await userEvent.click(screen.getByRole('button', { name: /analyze match/i }));
    await userEvent.click(await screen.findByRole('button', { name: /^apply:/i }));
    await userEvent.click(await screen.findByRole('button', { name: /^cancel$/i }));
    expect(resumeService.updateResume).not.toHaveBeenCalled();
    expect(tailorService.analyzeTailor).toHaveBeenCalledTimes(1);
  });

  it('shows an error when the analysis fails', async () => {
    vi.mocked(tailorService.analyzeTailor).mockRejectedValue(new Error('boom'));
    renderPanel();
    await userEvent.click(screen.getByRole('button', { name: /analyze match/i }));
    expect(await screen.findByText(/could not analyze your resume/i)).toBeInTheDocument();
  });

  it('saves the job description to the resume', async () => {
    vi.mocked(resumeService.updateResume).mockResolvedValue(resume);
    const onChanged = renderPanel();
    const save = screen.getByRole('button', { name: /save job description to this resume/i });
    expect(save).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/paste the job description/i), ' More.');
    await userEvent.click(save);
    await waitFor(() =>
      expect(resumeService.updateResume).toHaveBeenCalledWith(9, {
        job_title: 'Data Engineer',
        job_description: 'We need Python and Docker. More.',
      }),
    );
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });
});

describe('skillsAfterAction', () => {
  it('does not duplicate an existing skill', () => {
    expect(skillsAfterAction(['Python'], { type: 'add_skill', value: 'python' })).toEqual(['Python']);
  });
  it('reorders without dropping or inventing skills', () => {
    expect(
      skillsAfterAction(['A', 'B', 'C'], { type: 'reorder_skills', value: ['C', 'Z', 'A'] }),
    ).toEqual(['C', 'A', 'B']);
  });
});
