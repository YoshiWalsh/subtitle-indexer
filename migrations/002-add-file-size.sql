-- Up
ALTER TABLE files ADD COLUMN size INTEGER;

-- Down
PRAGMA foreign_keys=off;
DROP INDEX `file_path_idx`;
ALTER TABLE files RENAME TO files_old;
CREATE TABLE `files` (
    id INTEGER PRIMARY KEY,
    libraryId INTEGER NOT NULL,
    path STRING NOT NULL, -- Relative to the library path
    lastModified INTEGER NOT NULL,
    itemId INTEGER NOT NULL,
    stillExists INTEGER NOT NULL, -- Indicates whether this file was present during the last scan
    UNIQUE(libraryId, path),
    FOREIGN KEY(libraryId) REFERENCES libraries(id),
    FOREIGN KEY(itemId) REFERENCES items(id)
);
CREATE INDEX `file_path_idx` ON files(path);
INSERT INTO `files` (id, libraryId, path, lastModified, itemId, stillExists)
    SELECT id, libraryId, path, lastModified, itemId, stillExists FROM files_old;
DROP TABLE files_old;
PRAGMA foreign_keys=on;