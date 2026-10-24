import {describe, expect, it} from 'vitest';
import {entryPath, reusesPath, routeOf} from '../../../../src/lib/router/route';

describe('routeOf', () => {
  it.each([
    ['/', {page: 'root'}],
    ['//', {page: 'root'}],
    ['/admin', {page: 'admin'}],
    ['/ADMIN/', {page: 'admin'}],
    ['/oauth/github', {page: 'githubOAuth'}],
    ['/oauth/google/', {page: 'googleOAuth'}],
    ['/test', {page: 'user', user: 'test'}],
    ['/test/', {page: 'user', user: 'test'}],
    ['/test/shell', {page: 'user', user: 'test', tag: 'shell'}],
    // Another path under /oauth is a user's tag, as React Router matched it.
    ['/oauth/other', {page: 'user', user: 'oauth', tag: 'other'}],
    ['/test/entries/589', {page: 'entry', user: 'test', entryId: '589'}],
    ['/test/entries/589/', {page: 'entry', user: 'test', entryId: '589'}],
    // A tag named "entries" is still a tag.
    ['/test/activity/reuses', {page: 'reuses', user: 'test'}],
    ['/test/activity/reuses/', {page: 'reuses', user: 'test'}],
    ['/test/reuses', {page: 'user', user: 'test', tag: 'reuses'}],
    ['/test/activity', {page: 'user', user: 'test', tag: 'activity'}],
    ['/test/entries', {page: 'user', user: 'test', tag: 'entries'}],
  ])('routes %s', (pathname, route) => {
    expect(routeOf(pathname)).toEqual(route);
  });

  it.each([
    ['/test/my%20tag', 'my tag'],
    ['/test/a%2Fb', 'a/b'],
    ['/test/caf%C3%A9', 'café'],
    // Not valid percent-encoding: as it is.
    ['/test/100%', '100%'],
  ])('decodes %s', (pathname, tag) => {
    expect(routeOf(pathname)).toEqual({page: 'user', user: 'test', tag});
  });

  it.each([
    '/a/b/c',
    '//x',
    '/test//x',
    '/test/entries/1/more',
    '/test/Entries/1',
  ])('has no route for %s', pathname => {
    expect(routeOf(pathname)).toEqual({page: 'none'});
  });

  it('round-trips a profile history path', () => {
    expect(routeOf(reusesPath('a/b c'))).toEqual({
      page: 'reuses',
      user: 'a/b c',
    });
  });

  it("names an entry's page, any id round-tripping", () => {
    expect(entryPath('test', '589')).toBe('/test/entries/589');
    const local = 'local-1/2 x';
    expect(routeOf(entryPath('test', local))).toEqual({
      page: 'entry',
      user: 'test',
      entryId: local,
    });
  });
});
