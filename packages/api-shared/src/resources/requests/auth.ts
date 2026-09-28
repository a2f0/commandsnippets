/**
 * OAuth logins: `POST /api/v1/github-login/` and `/api/v1/google-login/`
 * with the provider's authorization code. Success is `{}` with the auth
 * cookies set; a failed exchange is a 401 `{errors: []}`.
 */
import * as z from 'zod/mini';
import {charField} from '../../fields';
import {createDocumentSchema, noFieldsSchema} from '../../jsonapi/request';
import {GITHUB_LOGIN, GOOGLE_LOGIN} from '../types';

/** The code, trimmed. Other attributes (the old `clientType`) are ignored. */
export const loginAttributesSchema = z.object({code: charField()});

export const githubLoginDocumentSchema = createDocumentSchema(GITHUB_LOGIN, {
  attributes: loginAttributesSchema,
  relationships: noFieldsSchema,
});

export const googleLoginDocumentSchema = createDocumentSchema(GOOGLE_LOGIN, {
  attributes: loginAttributesSchema,
  relationships: noFieldsSchema,
});

export type LoginAttributes = z.output<typeof loginAttributesSchema>;
export type GithubLoginDocument = z.output<typeof githubLoginDocumentSchema>;
export type GoogleLoginDocument = z.output<typeof googleLoginDocumentSchema>;
