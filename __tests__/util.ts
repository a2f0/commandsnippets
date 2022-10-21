function assignLoggedInCookie() {
  Object.defineProperty(window.document, 'cookie', {
    writable: true,
    value: 'LoggedIn=True',
  });
}

export {assignLoggedInCookie};
