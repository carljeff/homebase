CREATE UNIQUE INDEX family_unique_name ON records (lower(trim(json_extract(data, '$.name')))) WHERE kind = 'family';
