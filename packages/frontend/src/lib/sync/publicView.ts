/** A failed public read that makes its cached data unsafe to retain. */
export class PublicViewChangedError extends Error {
  constructor(readonly restart = true) {
    super(
      restart
        ? 'The public view changed; reloading.'
        : 'This public view is unavailable.'
    );
    this.name = 'PublicViewChangedError';
  }
}
