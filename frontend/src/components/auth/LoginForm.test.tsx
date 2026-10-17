import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChakraProvider } from '@chakra-ui/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { theme } from '../../theme';
import { LoginForm } from './LoginForm';

const renderForm = (onSubmit: () => Promise<void>) =>
  render(
    <ChakraProvider theme={theme}>
      <MemoryRouter>
        <LoginForm onSubmit={onSubmit} />
      </MemoryRouter>
    </ChakraProvider>,
  );

describe('LoginForm', () => {
  it('shows validation errors, focuses the first invalid field and does not submit', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    renderForm(onSubmit);
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByText('Enter a valid email address.')).toBeInTheDocument();
    expect(screen.getByText('Password is required.')).toBeInTheDocument();
    expect(screen.getByLabelText(/^email/i)).toHaveFocus();
    expect(screen.getByLabelText(/^email/i)).toHaveAttribute('aria-invalid', 'true');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits credentials (also with Enter)', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    renderForm(onSubmit);
    await userEvent.type(screen.getByLabelText(/^email/i), 'a@b.co');
    await userEvent.type(screen.getByLabelText(/^password/i), 'secret123{Enter}');
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith('a@b.co', 'secret123'));
  });

  it('displays an error when submit fails', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('bad'));
    renderForm(onSubmit);
    await userEvent.type(screen.getByLabelText(/^email/i), 'a@b.co');
    await userEvent.type(screen.getByLabelText(/^password/i), 'x');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to sign in');
  });

  it('links to the forgot password page', () => {
    renderForm(vi.fn());
    expect(screen.getByRole('link', { name: /forgot password/i })).toHaveAttribute(
      'href',
      '/forgot-password',
    );
  });

  it('toggles password visibility with an accessible button', async () => {
    renderForm(vi.fn());
    const input = screen.getByLabelText(/^password/i);
    expect(input).toHaveAttribute('type', 'password');
    await userEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(input).toHaveAttribute('type', 'text');
    await userEvent.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(input).toHaveAttribute('type', 'password');
  });
});
