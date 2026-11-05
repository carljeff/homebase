CREATE TABLE crm_contact_review (
 device_id text NOT NULL REFERENCES crm_devices(id),
 candidate_id text NOT NULL,
 data_json text NOT NULL,
 status text NOT NULL DEFAULT 'pending',
 contact_id text,
 version integer NOT NULL DEFAULT 1,
 updated_at text NOT NULL,
 PRIMARY KEY(device_id,candidate_id)
);
--> statement-breakpoint
CREATE TABLE crm_contact_review_state (
 device_id text PRIMARY KEY NOT NULL REFERENCES crm_devices(id),
 last_sync text NOT NULL
);
