import invariant from 'invariant';
import {type Mock, vi} from 'vitest';

interface ControlledObserver extends IntersectionObserver {
  intersect(isIntersecting?: boolean): void;
  disconnect: Mock<() => void>;
}

/** Deliver viewport notifications explicitly, including ones queued at cleanup. */
export const mockIntersectionObserver = (): {
  observers: ControlledObserver[];
  latest: () => ControlledObserver;
} => {
  const observers: ControlledObserver[] = [];
  class TestObserver implements ControlledObserver {
    readonly root = null;
    readonly rootMargin = '0px';
    readonly scrollMargin = '0px';
    readonly thresholds = [0];
    private target: Element | null = null;
    readonly observe = vi.fn((target: Element) => {
      this.target = target;
    });
    readonly unobserve = vi.fn();
    readonly disconnect = vi.fn();
    readonly takeRecords = () => [];

    constructor(private readonly callback: IntersectionObserverCallback) {
      observers.push(this);
    }

    intersect(isIntersecting = true) {
      invariant(this.target, 'An element must be observed first');
      const rect = this.target.getBoundingClientRect();
      this.callback(
        [
          {
            target: this.target,
            isIntersecting,
            intersectionRatio: isIntersecting ? 1 : 0,
            boundingClientRect: rect,
            intersectionRect: rect,
            rootBounds: null,
            time: performance.now(),
          },
        ],
        this
      );
    }
  }
  vi.stubGlobal('IntersectionObserver', TestObserver);
  return {
    observers,
    latest: () => {
      const observer = observers.at(-1);
      invariant(observer, 'Expected an intersection observer');
      return observer;
    },
  };
};
