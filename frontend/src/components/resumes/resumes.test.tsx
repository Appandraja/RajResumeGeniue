import { ChakraProvider } from '@chakra-ui/react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ReactNode } from 'react';
import { ResumePreview } from './ResumePreview';
import { emptyForm, validateContact, type ResumeFormState } from './resumeForm';

const wrap = (ui: ReactNode) => render(<ChakraProvider>{ui}</ChakraProvider>);

describe('resume form validation', () => {
  it('requires name and a valid email', () => {
    const errors = validateContact({ ...emptyForm(), email: 'nope' });
    expect(errors.full_name).toBeDefined();
    expect(errors.email).toBeDefined();
  });

  it('accepts valid contact info', () => {
    const form: ResumeFormState = { ...emptyForm(), full_name: 'Jane', email: 'jane@example.com' };
    expect(validateContact(form)).toEqual({});
  });
});

describe('ResumePreview', () => {
  it('renders name, summary and skills with standard headings', () => {
    const form: ResumeFormState = {
      ...emptyForm(),
      full_name: 'Jane Doe',
      summary: 'Experienced engineer.',
      skills: ['Python', 'SQL'],
    };
    wrap(<ResumePreview form={form} template={{ font_family: 'Georgia', accent_color: '#112233' }} />);
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    expect(screen.getByText('Summary')).toBeInTheDocument();
    expect(screen.getByText('Skills')).toBeInTheDocument();
    expect(screen.getByText('Python, SQL')).toBeInTheDocument();
  });

  it('shows a hint when the form is empty', () => {
    wrap(<ResumePreview form={emptyForm()} template={null} />);
    expect(screen.getByText(/will appear here/i)).toBeInTheDocument();
  });
});
