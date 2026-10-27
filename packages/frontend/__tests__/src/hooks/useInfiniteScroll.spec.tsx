import {act, render} from '@testing-library/react';
import {vi} from 'vitest';
import {useInfiniteScroll} from '../../../src/hooks/useInfiniteScroll';
import {mockIntersectionObserver} from '../../util/intersectionObserver';

afterEach(() => vi.unstubAllGlobals());

interface Props {
  loadMore: () => void;
  enabled?: boolean;
  footer?: boolean;
}

const List = ({loadMore, enabled = true, footer = true}: Props) => {
  const loadMoreTarget = useInfiniteScroll(loadMore, enabled);
  return footer ? <div ref={loadMoreTarget} /> : null;
};

describe('useInfiniteScroll', () => {
  it('loads once per observer when the footer comes into view', () => {
    const observer = mockIntersectionObserver();
    const loadMore = vi.fn();
    render(<List loadMore={loadMore} />);
    const first = observer.latest();
    act(() => first.intersect(false));
    expect(loadMore).not.toHaveBeenCalled();
    act(() => {
      first.intersect();
      first.intersect();
    });
    expect(loadMore).toHaveBeenCalledTimes(1);
    expect(first.disconnect).toHaveBeenCalled();
  });

  it('observes afresh on each re-enable, ignoring the old observer', () => {
    const observer = mockIntersectionObserver();
    const loadMore = vi.fn();
    const {rerender} = render(<List loadMore={loadMore} />);
    const first = observer.latest();
    rerender(<List loadMore={loadMore} enabled={false} />);
    expect(first.disconnect).toHaveBeenCalled();
    rerender(<List loadMore={loadMore} />);
    expect(observer.observers).toHaveLength(2);
    act(() => first.intersect());
    expect(loadMore).not.toHaveBeenCalled();
    act(() => observer.latest().intersect());
    expect(loadMore).toHaveBeenCalledTimes(1);
  });

  it('waits until enabled with a footer rendered', () => {
    const observer = mockIntersectionObserver();
    const loadMore = vi.fn();
    const {rerender} = render(<List loadMore={loadMore} footer={false} />);
    rerender(<List loadMore={loadMore} enabled={false} />);
    expect(observer.observers).toHaveLength(0);
    rerender(<List loadMore={loadMore} />);
    expect(observer.observers).toHaveLength(1);
  });

  it('calls the latest callback without observing again', () => {
    const observer = mockIntersectionObserver();
    const stale = vi.fn();
    const latest = vi.fn();
    const {rerender} = render(<List loadMore={stale} />);
    rerender(<List loadMore={latest} />);
    expect(observer.observers).toHaveLength(1);
    act(() => observer.latest().intersect());
    expect(stale).not.toHaveBeenCalled();
    expect(latest).toHaveBeenCalledTimes(1);
  });

  it('leaves loading to the caller without IntersectionObserver', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    const loadMore = vi.fn();
    render(<List loadMore={loadMore} />);
    expect(loadMore).not.toHaveBeenCalled();
  });
});
