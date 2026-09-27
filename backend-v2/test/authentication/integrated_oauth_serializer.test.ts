import {describe, expect, it} from 'vitest';
import {INTEGRATED_OAUTH_FIELDS} from '../../src/auth/routes';
import {validate} from '../../src/lib/validation';

const serializer = (data: Record<string, unknown>) =>
  validate<{provider: string; token: string}>(INTEGRATED_OAUTH_FIELDS, data);

// tearleads/authentication/tests/test_integrated_oauth_serializer.py
describe('TestIntegratedOAuthSerializer', () => {
  it('test_valid_google_data', () => {
    const result = serializer({provider: 'google', token: 'test_google_token'});
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data.provider).toBe('google');
      expect(result.data.token).toBe('test_google_token');
    }
  });

  it('test_invalid_provider', () => {
    const result = serializer({provider: 'github', token: 'test_token'});
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors).toHaveProperty('provider');
    }
  });

  it('test_missing_provider', () => {
    const result = serializer({token: 'test_token'});
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors).toHaveProperty('provider');
    }
  });

  it('test_missing_token', () => {
    const result = serializer({provider: 'google'});
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors).toHaveProperty('token');
    }
  });

  it('test_empty_data', () => {
    const result = serializer({});
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors).toHaveProperty('provider');
      expect(result.errors).toHaveProperty('token');
    }
  });

  it('test_choice_field_case_sensitivity', () => {
    const result = serializer({provider: 'Google', token: 'test_token'});
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors).toHaveProperty('provider');
    }
  });
});
