-- Run through sqlite3 "file:$HOME/Library/Messages/chat.db?mode=ro"
-- Metadata only. Never select text, attributedBody, payload_data or attachments.
PRAGMA query_only=ON;
SELECT count(*) AS messages,sum(is_from_me=0) AS incoming,sum(is_from_me=1) AS outgoing FROM message;
SELECT count(*) AS handles FROM handle;
SELECT count(*) AS chats FROM chat;
SELECT count(DISTINCT message_id) AS linked_messages FROM chat_message_join WHERE message_id IN (SELECT ROWID FROM message);
SELECT count(*) AS unlinked_messages FROM message m WHERE NOT EXISTS (SELECT 1 FROM chat_message_join j WHERE j.message_id=m.ROWID);
SELECT participant_count,count(*) AS chats FROM (SELECT chat_id,count(DISTINCT handle_id) AS participant_count FROM chat_handle_join GROUP BY chat_id) GROUP BY participant_count;
SELECT typeof(date),count(*),min(CASE WHEN typeof(date) IN ('integer','real') THEN date END),max(CASE WHEN typeof(date) IN ('integer','real') THEN date END) FROM message GROUP BY typeof(date);
-- Counts investigate incomplete joins without exposing handles or content.
SELECT count(*) AS multiple_chat_associations FROM (SELECT message_id FROM chat_message_join GROUP BY message_id HAVING count(DISTINCT chat_id)>1);
SELECT count(*) AS missing_handle_messages FROM message m LEFT JOIN handle h ON h.ROWID=m.handle_id WHERE m.is_from_me=0 AND h.ROWID IS NULL;
