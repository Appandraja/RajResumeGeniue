import '@testing-library/jest-dom/vitest';

// jsdom does not implement scrollTo; Chakra's Menu calls it when focusing items.
if (typeof Element.prototype.scrollTo !== 'function') {
  Element.prototype.scrollTo = () => undefined;
}
