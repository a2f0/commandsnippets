import {CODES} from '@commandsnippets/api-shared';
import {describe, expect, it} from 'vitest';

import {firstError} from '../../../../src/lib/api/errorDocument';
import {errorDocument} from '../../../../src/msw/documents';

const none = {code: undefined, detail: undefined};

describe('firstError', () => {
  it("reads an error document's first error", () => {
    expect(
      firstError(
        errorDocument(
          403,
          CODES.permissionDenied,
          'You do not have permission.'
        )
      )
    ).toEqual({
      code: 'permission_denied',
      detail: 'You do not have permission.',
    });
  });

  it('reads only the first error', () => {
    expect(
      firstError({
        errors: [
          {code: CODES.permissionDenied},
          {code: CODES.notAuthenticated, detail: 'Not signed in.'},
        ],
      })
    ).toEqual({code: 'permission_denied', detail: undefined});
  });

  it('reads each member on its own', () => {
    // The rest of the error, or of the document, does not matter.
    expect(
      firstError({errors: [{code: 'invalid', status: 400}, 'junk'], extra: 1})
    ).toEqual({code: 'invalid', detail: undefined});
    // A member of the wrong type reads as missing.
    expect(firstError({errors: [{code: 403, detail: 'Forbidden'}]})).toEqual({
      code: undefined,
      detail: 'Forbidden',
    });
  });

  it.each([
    ['an empty errors list', {errors: []}],
    ['a first error that is not an object', {errors: ['Forbidden']}],
    ['errors that are not a list', {errors: {code: 'permission_denied'}}],
    ['another document', {error: 'Forbidden'}],
    ['null', null],
    ['no body', undefined],
    ['text', 'Forbidden'],
  ])('reads nothing from %s', (_name, body) => {
    expect(firstError(body)).toEqual(none);
  });
});
