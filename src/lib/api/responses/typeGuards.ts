import type {UserResponse} from './types';

export function isUserResponse(response: unknown): response is UserResponse {
  return (
    typeof response === 'object' &&
    response !== null &&
    'data' in response &&
    typeof response.data === 'object' &&
    response.data !== null &&
    'attributes' in response.data &&
    typeof response.data.attributes === 'object' &&
    response.data.attributes !== null &&
    'username' in response.data.attributes &&
    typeof response.data.attributes.username === 'string'
  );
}
