import {getTableConfig} from 'drizzle-orm/sqlite-core';
import {describe, expect, it} from 'vitest';
import {
  adminAuditLog,
  entryReuses,
  tags,
  tagsEntries,
  textEntries,
  tokens,
  users,
} from '../../src/db/schema';

const config = (table: Parameters<typeof getTableConfig>[0]) => {
  const {name, checks, indexes, foreignKeys, uniqueConstraints} =
    getTableConfig(table);
  return {
    name,
    checks: checks.map(check => check.name).sort(),
    indexes: indexes.map(index => index.config.name).sort(),
    unique: uniqueConstraints.map(constraint => constraint.name).sort(),
    references: foreignKeys
      .map(fk => {
        const reference = fk.reference();
        return `${reference.columns.map(c => c.name).join()}->${getTableConfig(reference.foreignTable).name} ${fk.onDelete}`;
      })
      .sort(),
  };
};

// The Django models' constraints, carried over (varchar lengths become CHECKs,
// Django's Python-side cascades become ON DELETE CASCADE).
describe('schema', () => {
  it('users_user', () => {
    expect(config(users)).toEqual({
      name: 'users_user',
      checks: [
        'users_user_email_length',
        'users_user_login_count_check',
        'users_user_username_length',
      ],
      indexes: ['users_user_email_unique'],
      unique: [],
      references: [],
    });
  });

  // v2: the admin audit log outlives the users it names.
  it('admin_audit_log', () => {
    expect(config(adminAuditLog)).toEqual({
      name: 'admin_audit_log',
      checks: [],
      indexes: [
        'admin_audit_log_created_idx',
        'admin_audit_log_target_user_id_idx',
      ],
      unique: [],
      references: [
        'actor_id->users_user set null',
        'target_user_id->users_user set null',
      ],
    });
  });

  it('authtoken_token', () => {
    expect(config(tokens)).toMatchObject({
      checks: ['authtoken_token_key_length'],
      references: ['user_id->users_user cascade'],
    });
  });

  it('text_entries_textentry', () => {
    expect(config(textEntries)).toMatchObject({
      checks: [
        'text_entries_textentry_body_length',
        'text_entries_textentry_subject_length',
      ],
      indexes: [
        'text_entries_textentry_client_id_unique',
        'text_entries_textentry_user_id_idx',
      ],
      references: ['user_id->users_user cascade'],
    });
  });

  it('tags_tag', () => {
    expect(config(tags)).toMatchObject({
      checks: ['tags_tag_name_length', 'tags_tag_order_check'],
      indexes: ['tags_tag_user_order_idx', 'tags_tag_user_updated_idx'],
      unique: ['One tag of same name per user'],
      references: ['user_id->users_user cascade'],
    });
  });

  it('tags_tagtextentrythroughmodel', () => {
    expect(config(tagsEntries)).toMatchObject({
      checks: ['tags_tagtextentrythroughmodel_order_check'],
      unique: ['tags_tagtextentrythroughmodel_tag_id_text_entry_id_uniq'],
      references: [
        'tag_id->tags_tag cascade',
        'text_entry_id->text_entries_textentry cascade',
        'user_id->users_user cascade',
      ],
    });
  });

  it('text_entries_textentryreused', () => {
    expect(config(entryReuses)).toMatchObject({
      references: [
        'text_entry_id->text_entries_textentry cascade',
        'user_id->users_user cascade',
      ],
    });
  });
});
