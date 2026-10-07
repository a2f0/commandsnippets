/**
 * `@commandsnippets/api-shared/responses`: what a client needs to read the
 * API's answers. Every response document, resource and error document
 * schema, their types, and the resource type names. It imports none of the
 * request-side modules (a test checks), so a client bundles only these.
 */

export * from './cursor';
export * from './jsonapi/response';
export * from './resources/admin';
export * from './resources/backup';
export * from './resources/dataOwner';
export * from './resources/dataVersion';
export * from './resources/documents';
export * from './resources/tag';
export * from './resources/tagTextEntry';
export * from './resources/textEntry';
export * from './resources/textEntryReused';
export * from './resources/types';
export * from './resources/user';
