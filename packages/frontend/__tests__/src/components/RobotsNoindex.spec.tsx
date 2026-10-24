import {render} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';

const robotsTags = () =>
  [...document.head.querySelectorAll('meta[name="robots"]')].map(meta =>
    meta.getAttribute('content')
  );

// The component reads index.html's tag when it loads, so each test loads it
// afresh.
const load = async () => {
  vi.resetModules();
  return (await import('../../../src/components/RobotsNoindex')).RobotsNoindex;
};

afterEach(() => {
  for (const meta of document.head.querySelectorAll('meta[name="robots"]')) {
    meta.remove();
  }
});

describe('RobotsNoindex', () => {
  it('says noindex in the head while it is rendered', async () => {
    const RobotsNoindex = await load();
    const {unmount} = render(<RobotsNoindex />);
    expect(robotsTags()).toEqual(['noindex, nofollow']);
    unmount();
    expect(robotsTags()).toEqual([]);
  });

  // Outside production, index.html says noindex for every page.
  it('adds no second tag where index.html says noindex', async () => {
    const shell = document.createElement('meta');
    shell.name = 'robots';
    shell.content = 'noindex, nofollow';
    document.head.append(shell);
    const RobotsNoindex = await load();
    render(<RobotsNoindex />);
    expect(robotsTags()).toEqual(['noindex, nofollow']);
  });
});
