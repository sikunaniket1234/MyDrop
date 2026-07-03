CREATE TABLE tags (
    item_id         TEXT,
    tag             TEXT NOT NULL,
    source          TEXT CHECK(source IN ('manual','auto')) DEFAULT 'manual',
    PRIMARY KEY (item_id, tag)
);

CREATE VIRTUAL TABLE items_fts USING fts5(
    content,
    content='items',
    content_rowid='rowid'
);

CREATE TRIGGER items_ai AFTER INSERT ON items BEGIN
  INSERT INTO items_fts(rowid, content) VALUES (new.rowid, new.content);
END;

CREATE TRIGGER items_ad AFTER DELETE ON items BEGIN
  INSERT INTO items_fts(items_fts, rowid, content) VALUES('delete', old.rowid, old.content);
END;

CREATE TRIGGER items_au AFTER UPDATE ON items BEGIN
  INSERT INTO items_fts(items_fts, rowid, content) VALUES('delete', old.rowid, old.content);
  INSERT INTO items_fts(rowid, content) VALUES (new.rowid, new.content);
END;
