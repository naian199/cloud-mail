// Indexed rows already carry a normalized, sorted peer list. Older mail may never
// have been opened in the personal chat UI, so derive the same peers without writing
// to any user's mailbox. The mailbox is part of the conversation identity.
const peers = `CASE
  WHEN e.conversation_key != '' AND json_valid(e.conversation_peers) AND e.conversation_peers != '[]'
  THEN e.conversation_peers
  ELSE coalesce(nullif((SELECT json_group_array(address) FROM (
    SELECT DISTINCT lower(trim(value)) AS address FROM (
      SELECT e.send_email AS value
      UNION ALL
      SELECT CASE WHEN r.type = 'text' THEN r.value WHEN r.type = 'object' THEN json_extract(r.value, '$.address') END
        FROM json_each(CASE WHEN json_valid(e.recipient) THEN e.recipient ELSE '[]' END) r
      UNION ALL
      SELECT CASE WHEN r.type = 'text' THEN r.value WHEN r.type = 'object' THEN json_extract(r.value, '$.address') END
        FROM json_each(CASE WHEN json_valid(e.cc) THEN e.cc ELSE '[]' END) r
    ) WHERE trim(coalesce(value, '')) != ''
      AND lower(trim(value)) NOT IN (lower(coalesce(a.email, '')), lower(coalesce(e.to_email, '')))
      ORDER BY address
  )), '[]'), CASE WHEN a.email IS NOT NULL THEN json_array(lower(a.email)) ELSE json_array('#' || e.email_id) END)
END`;

const columns = `e.email_id, e.user_id, e.account_id, e.send_email, e.name, e.subject,
  e.text, e.type, e.create_time, e.message_id, a.email AS mailbox, u.email AS owner,
  ${peers} AS peers`;
const joins = `FROM email e LEFT JOIN account a ON a.account_id = e.account_id AND a.user_id = e.user_id
  LEFT JOIN user u ON u.user_id = e.user_id`;
const eligible = 'e.is_del = 0 AND e.type IN (0, 1) AND e.status NOT IN (6, 7)';
const messageIdentity = `CASE WHEN trim(coalesce(message_id, '')) = '' THEN 'id:' || email_id
  ELSE 'msg:' || lower(coalesce(send_email, '')) || ':' || message_id END`;
const summaries = `email_id AS emailId, send_email AS sendEmail, name, subject, type,
  user_id AS userId, account_id AS accountId, create_time AS createTime, mailbox, owner, peers`;

export const adminConversationList = `WITH scoped AS (
  SELECT ${columns} ${joins} WHERE ${eligible}
), ranked AS (
  SELECT *, row_number() OVER (PARTITION BY user_id, account_id, peers ORDER BY create_time DESC, email_id DESC) AS position
  FROM scoped
), matching AS (
  SELECT DISTINCT user_id, account_id, peers FROM scoped
  WHERE instr(lower(coalesce(mailbox, '')), ?1) > 0 OR instr(lower(coalesce(owner, '')), ?1) > 0
    OR instr(lower(peers), ?1) > 0 OR instr(lower(coalesce(name, '')), ?1) > 0
    OR instr(lower(coalesce(subject, '')), ?1) > 0 OR instr(lower(coalesce(text, '')), ?1) > 0
) SELECT ${summaries}, substr(text, 1, 180) AS preview
  FROM ranked JOIN matching USING (user_id, account_id, peers)
  WHERE position = 1 AND (?2 = '' OR (create_time, email_id) < (?2, ?3))
  ORDER BY create_time DESC, email_id DESC LIMIT ?4`;

export const adminConversationMessages = `WITH anchor AS (
  SELECT e.user_id, e.account_id, ${peers} AS peers ${joins} WHERE e.email_id = ?1 AND ${eligible}
), scoped AS (
  SELECT ${columns} ${joins} JOIN anchor ON anchor.user_id = e.user_id AND anchor.account_id = e.account_id
  WHERE ${eligible} AND ${peers} = anchor.peers
), copies AS (
  SELECT *, row_number() OVER (PARTITION BY ${messageIdentity} ORDER BY create_time DESC, email_id DESC) AS copy
  FROM scoped
) SELECT ${summaries}, text,
  CASE WHEN trim(coalesce(text, '')) = '' THEN
    (SELECT substr(e.content, 1, 48000) FROM email e WHERE e.email_id = copies.email_id)
  END AS html
  FROM copies
  WHERE copy = 1 AND (?2 = '' OR (create_time, email_id) < (?2, ?3))
  ORDER BY create_time DESC, email_id DESC LIMIT ?4`;
