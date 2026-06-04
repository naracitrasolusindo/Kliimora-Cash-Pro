CREATE TABLE IF NOT EXISTS contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT
);

ALTER TABLE journal_lines ADD COLUMN contact_id INTEGER REFERENCES contacts(id);
