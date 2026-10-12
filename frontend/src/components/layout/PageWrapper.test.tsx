import { render, screen } from '@testing-library/react';
import { PageWrapper } from './PageWrapper';

describe('PageWrapper', () => {
  it('renders children', () => {
    render(
      <PageWrapper>
        <p>hello</p>
      </PageWrapper>,
    );
    expect(screen.getByText('hello')).toBeInTheDocument();
  });
});
