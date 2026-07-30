import "@testing-library/jest-dom/vitest";

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  }),
});

const getComputedStyleWithoutPseudoElements =
  window.getComputedStyle.bind(window);

Object.defineProperty(window, "getComputedStyle", {
  writable: true,
  value: (element: Element, pseudoElement?: string | null) => {
    void pseudoElement;
    return getComputedStyleWithoutPseudoElements(element);
  },
});

class ResizeObserverStub implements ResizeObserver {
  constructor(_callback: ResizeObserverCallback) {
    void _callback;
  }
  observe(_target: Element, _options?: ResizeObserverOptions) {
    void _target;
    void _options;
  }
  unobserve(_target: Element) {
    void _target;
  }
  disconnect() {}
}

Object.defineProperty(globalThis, "ResizeObserver", {
  writable: true,
  value: ResizeObserverStub,
});
