import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChakraProvider } from '@chakra-ui/react';
import { vi } from 'vitest';
import { theme } from '../../theme';
import { LoginForm } from './LoginForm';

const renderForm = (onSubmit: () => Promise<void>) =>
  render(
    <ChakraProvider theme={theme}>
      <LoginForm onSubmit={onSubmit} />
    </ChakraProvider>,
  );

describe('LoginForm', () => {
  it('shows validation errors and does not submit empty form', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    renderForm(onSubmit);
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByText('Enter a valid email address.')).toBeInTheDocument();
    expect(screen.getByText('Password is required.')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits credentials', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    renderForm(onSubmit);
    await userEvent.type(screen.getByLabelText(/email/i), 'a@b.co');
    await userEvent.type(screen.getByLabelText(/password/i), 'secret123');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith('a@b.co', 'secret123'));
  });

  it('displays an error when submit fails', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('bad'));
    renderForm(onSubmit);
    await userEvent.type(screen.getByLabelText(/email/i), 'a@b.co');
    await userEvent.type(screen.getByLabelText(/password/i), 'x');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to sign in');
  });
});
