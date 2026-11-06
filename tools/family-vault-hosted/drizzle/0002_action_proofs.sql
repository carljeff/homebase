CREATE TABLE demo_action_proofs(id text PRIMARY KEY NOT NULL,owner_id text NOT NULL,user_id text NOT NULL,session_digest text NOT NULL,credential_json text NOT NULL,scope text NOT NULL,vault_id text NOT NULL,response_digest text NOT NULL,expires_at integer NOT NULL);
CREATE INDEX demo_action_proofs_actor ON demo_action_proofs(user_id,expires_at);
CREATE TABLE demo_authorized_erase(owner_id text PRIMARY KEY NOT NULL,request_id text NOT NULL,requested_by text NOT NULL,expires_at integer NOT NULL);
