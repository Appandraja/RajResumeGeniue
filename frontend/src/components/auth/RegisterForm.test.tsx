import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChakraProvider } from '@chakra-ui/react';
import { vi } from 'vitest';
import { theme } from '../../theme';
import { RegisterForm } from './RegisterForm';

const renderForm = (onSubmit: () => Promise<void>) =>
  render(
    <ChakraProvider theme={theme}>
      <RegisterForm onSubmit={onSubmit} />
    </ChakraProvider>,
  );

describe('RegisterForm', () => {
  it('validates required fields and focuses the first invalid one', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    renderForm(onSubmit);
    await userEvent.click(screen.getByRole('button', { name: /create account/i }));
    expect(await screen.findByText('Full name is required.')).toBeInTheDocument();
    expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument();
    expect(screen.getByLabelText(/^full name/i)).toHaveFocus();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('flags mismatched passwords', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    renderForm(onSubmit);
    await userEvent.type(screen.getByLabelText(/^full name/i), 'Ada');
    await userEvent.type(screen.getByLabelText(/^email/i), 'ada@b.co');
    await userEvent.type(screen.getByLabelText(/^password/i), 'Password1');
    await userEvent.type(screen.getByLabelText(/^confirm password/i), 'Password2');
    await userEvent.click(screen.getByRole('button', { name: /create account/i }));
    expect(await screen.findByText('Passwords do not match.')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('shows strength while typing and submits valid data', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    renderForm(onSubmit);
    await userEvent.type(screen.getByLabelText(/^full name/i), 'Ada');
    await userEvent.type(screen.getByLabelText(/^email/i), 'ada@b.co');
    await userEvent.type(screen.getByLabelText(/^password/i), 'Abcdefg1!');
    expect(screen.getByText('Strong')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/^confirm password/i), 'Abcdefg1!');
    await userEvent.click(screen.getByRole('button', { name: /create account/i }));
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith('ada@b.co', 'Abcdefg1!', 'Ada'),
    );
  });
});
