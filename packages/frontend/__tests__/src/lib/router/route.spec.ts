import {describe, expect, it} from 'vitest';
import {
  entryPath,
  reusesPath,
  routeOf,
  tagPath,
  userPath,
} from '../../../../src/lib/router/route';

describe('routeOf', () => {
  it.each([
    ['/', {page: 'root'}],
    ['//', {page: 'root'}],
    ['/admin', {page: 'admin'}],
    ['/ADMIN/', {page: 'admin'}],
    ['/%61dmin/', {page: 'admin'}],
    ['/oauth/github', {page: 'githubOAuth'}],
    ['/oauth/google/', {page: 'googleOAuth'}],
    ['/oauth%2Fgithub', {page: 'user', user: 'oauth/github'}],
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
    ['/test/literal%252F', 'literal%2F'],
    ['/test/literal%252f', 'literal%2f'],
    ['/test/a%2F', 'a/'],
    ['/test/100%25', '100%'],
    ['/test/caf%C3%A9', 'café'],
    // Not valid percent-encoding: as it is.
    ['/test/100%', '100%'],
  ])('decodes %s', (pathname, tag) => {
    expect(routeOf(pathname)).toEqual({page: 'user', user: 'test', tag});
  });

  it.each([
    ['/oauth%2Fgithub/100%', {page: 'user', user: 'oauth/github', tag: '100%'}],
    ['/100%/caf%C3%A9', {page: 'user', user: '100%', tag: 'café'}],
    ['/literal%252F/100%', {page: 'user', user: 'literal%2F', tag: '100%'}],
    [
      '/oauth%2Fgithub/%65ntries/%ZZ',
      {page: 'entry', user: 'oauth/github', entryId: '%ZZ'},
    ],
    [
      '/%E0%A4/hello%20world',
      {page: 'user', user: '%E0%A4', tag: 'hello world'},
    ],
  ])(
    'isolates invalid encoding to its own segment in %s',
    (pathname, route) => {
      expect(routeOf(pathname)).toEqual(route);
    }
  );

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

  it.each([
    ['test', '/test'],
    ['oauth/github', '/oauth%2Fgithub'],
    ['literal%2F?x#y', '/literal%252F%3Fx%23y'],
    ['café + space', '/caf%C3%A9%20%2B%20space'],
  ])('round-trips the account path for %s', (user, path) => {
    expect(userPath(user)).toBe(path);
    const url = new URL(userPath(user), 'https://example.com');
    expect(url.search).toBe('');
    expect(url.hash).toBe('');
    expect(routeOf(url.pathname)).toEqual({page: 'user', user});
  });

  it.each([
    ['oauth/github', 'C#/literal%20'],
    ['literal%2F', 'ops?x=1#top'],
    ['café', 'plus+space tag'],
  ])('round-trips a tag path for %s without query or hash', (user, tag) => {
    const url = new URL(tagPath(user, tag), 'https://example.com');
    expect(url.search).toBe('');
    expect(url.hash).toBe('');
    expect(routeOf(url.pathname)).toEqual({page: 'user', user, tag});
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
