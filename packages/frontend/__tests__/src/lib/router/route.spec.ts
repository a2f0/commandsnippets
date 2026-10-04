import {describe, expect, it} from 'vitest';
import {routeOf} from '../../../../src/lib/router/route';

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

  it.each(['/a/b/c', '//x', '/test//x'])('has no route for %s', pathname => {
    expect(routeOf(pathname)).toEqual({page: 'none'});
  });
});
