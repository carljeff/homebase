CREATE TABLE demo_vaults(owner_id text PRIMARY KEY NOT NULL,config_json text NOT NULL);
CREATE TABLE demo_sessions(token_digest text PRIMARY KEY NOT NULL,owner_id text NOT NULL,last_seen integer NOT NULL,expires_at integer NOT NULL);
CREATE INDEX demo_session_owner ON demo_sessions(owner_id);
CREATE TABLE demo_records(owner_id text NOT NULL,id text NOT NULL,profile_id text NOT NULL,revision integer NOT NULL,data_json text NOT NULL,deleted integer NOT NULL DEFAULT 0,PRIMARY KEY(owner_id,id));
CREATE TABLE demo_limits(owner_id text PRIMARY KEY NOT NULL,minute integer NOT NULL,used integer NOT NULL);
