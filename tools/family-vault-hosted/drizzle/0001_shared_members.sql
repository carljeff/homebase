CREATE TABLE demo_household(slot integer PRIMARY KEY NOT NULL CHECK(slot=1),owner_id text NOT NULL);
CREATE TABLE demo_members(user_id text PRIMARY KEY NOT NULL,owner_id text NOT NULL,request_id text NOT NULL UNIQUE,credential_json text NOT NULL,status text NOT NULL CHECK(status IN ('pending','approved')),package_json text);
CREATE TABLE demo_erase(owner_id text PRIMARY KEY NOT NULL,request_id text NOT NULL,requested_by text NOT NULL,expires_at integer NOT NULL);
