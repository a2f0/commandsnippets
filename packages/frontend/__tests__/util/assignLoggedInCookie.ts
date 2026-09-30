function assignLoggedInCookie(cookie = 'LoggedIn=True') {
  Object.defineProperty(window.document, 'cookie', {
    writable: true,
    value: cookie,
  });
}

export {assignLoggedInCookie};
