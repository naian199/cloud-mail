-- Read-only preflight. Run against a backup or the selected production D1 database.
-- No rows are renamed, deleted or assigned certification by this script.
SELECT lower(email) AS address,count(*) AS copies FROM account GROUP BY lower(email) HAVING count(*)>1;
SELECT lower(email) AS address,count(*) AS copies FROM user GROUP BY lower(email) HAVING count(*)>1;
SELECT lower(username) AS handle,count(*) AS copies FROM mail_user_handle GROUP BY lower(username) HAVING count(*)>1;
SELECT count(*) AS users_without_handle FROM user u WHERE is_del=0 AND NOT EXISTS(SELECT 1 FROM mail_user_handle h WHERE h.user_id=u.user_id);
SELECT username AS grandfathered_handle FROM mail_user_handle WHERE length(username)<4 OR length(username)>24;
SELECT username AS reserved_legacy_handle FROM mail_user_handle WHERE lower(username) IN('admin','administrator','root','system','official','support','help','security','postmaster','mailer_daemon','abuse','noreply','no_reply','webmaster','cloudmail');
