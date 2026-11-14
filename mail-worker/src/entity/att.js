import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const  att = sqliteTable('attachments', {
	attId: integer('att_id').primaryKey({ autoIncrement: true }),
	userId: integer('user_id').notNull(),
	emailId: integer('email_id').notNull(),
	accountId: integer('account_id').notNull(),
	key: text('key').notNull(),
	filename: text('filename'),
	mimeType: text('mime_type'),
	size: integer('size'),
	status: text('status').default(0).notNull(),
	type: integer('type').default(0).notNull(),
	disposition: text('disposition'),
	related: text('related'),
	contentId: text('content_id'),
	encoding: text('encoding'),
	createTime: text('create_time').default(sql`CURRENT_TIMESTAMP`).notNull(),
	// '' = the deployment's own storage (R2/S3/KV); 'costaction' = Turbobit via CostAction.
	storage: text('storage').default('').notNull(),
	remoteId: text('remote_id').default('').notNull(),
	// uploading | ready | failed | expired | deleted
	remoteStatus: text('remote_status').default('').notNull(),
	remoteDeleteId: text('remote_delete_id').default('').notNull(),
	clientKey: text('client_key').default('').notNull(),
	// The cloud_file this row links to (large attachments only).
	fileId: integer('file_id').default(0).notNull(),
});

