import { render, screen } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import { theme } from '../../theme';
import { PasswordStrength, evaluatePassword } from './PasswordStrength';

describe('evaluatePassword', () => {
  it('rates levels', () => {
    expect(evaluatePassword('').level).toBe('empty');
    expect(evaluatePassword('abc').level).toBe('weak');
    expect(evaluatePassword('abcdefgh').level).toBe('weak');
    expect(evaluatePassword('abcdefg1').level).toBe('fair');
    expect(evaluatePassword('Abcdefg1!').level).toBe('strong');
  });
});

describe('PasswordStrength', () => {
  const renderMeter = (password: string) =>
    render(
      <ChakraProvider theme={theme}>
        <PasswordStrength password={password} />
      </ChakraProvider>,
    );

  it('shows a text label, not only colour', () => {
    renderMeter('abc');
    expect(screen.getByText('Weak')).toBeInTheDocument();
  });

  it('shows strong for a long mixed password', () => {
    renderMeter('Correct-Horse-9');
    expect(screen.getByText('Strong')).toBeInTheDocument();
  });
});
