-- Up
CREATE VIRTUAL TABLE conversations_fts USING fts5(indexedText, content='conversations', content_rowid='id', tokenize = 'porter unicode61 remove_diacritics 1');

-- Triggers to keep the FTS index up to date.
CREATE TRIGGER conversations_ai AFTER INSERT ON conversations BEGIN
  INSERT INTO conversations_fts(rowid, indexedText) VALUES (new.id, new.indexedText);
END;
CREATE TRIGGER conversations_ad AFTER DELETE ON conversations BEGIN
  INSERT INTO conversations_fts(conversations_fts, rowid, indexedText) VALUES('delete', old.id, old.indexedText);
END;
CREATE TRIGGER conversations_au AFTER UPDATE ON conversations BEGIN
  INSERT INTO conversations_fts(conversations_fts, rowid, indexedText) VALUES('delete', old.id, old.indexedText);
  INSERT INTO conversations_fts(rowid, b, c) VALUES (new.a, new.indexedText);
END;

INSERT INTO conversations_fts(conversations_fts) VALUES ('rebuild');

-- Down
DROP TRIGGER conversations_ai;
DROP TRIGGER conversations_ad;
DROP TRIGGER conversations_au;
DROP TABLE conversations_fts;
