-- Usernames are the web app's first path segment, and /admin and /oauth/...
-- are its own routes (src/services/reserved-usernames.json). createUser no
-- longer gives these names out; rename any account that already has one
-- (staging and production had none) so its pages are reachable. A clash with
-- an existing `<name>-<id>` fails on the unique index instead of merging.
UPDATE `users_user` SET `username` = `username` || '-' || `id`
WHERE lower(`username`) IN ('admin', 'oauth');
