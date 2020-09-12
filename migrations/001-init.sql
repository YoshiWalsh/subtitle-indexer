-- Up
CREATE TABLE `settings` (
    setting TEXT NOT NULL,
    value TEXT NOT NULL
);

CREATE TABLE `libraries` (
    id INTEGER PRIMARY KEY,
    path TEXT NOT NULL,
    searchByDefault INTEGER NOT NULL,
    stillExists INTEGER NOT NULL,
    UNIQUE(path)
);

CREATE TABLE `items` (
    id INTEGER PRIMARY KEY,
    hash TEXT NOT NULL,
    indexed INTEGER NOT NULL, -- Indicates whether this file has had its subtitles indexed
    UNIQUE(hash)
);

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

CREATE TABLE `tracks` (
    id INTEGER PRIMARY KEY,
    itemId INTEGER,
    trackNumber INTEGER,
    name STRING,
    UNIQUE(itemId, trackNumber),
    FOREIGN KEY(itemId) REFERENCES items(id)
);

CREATE TABLE `conversations` (
    id INTEGER PRIMARY KEY,
    trackId INTEGER,
    indexedText TEXT,
    FOREIGN KEY(trackId) REFERENCES tracks(id)
);

CREATE TABLE `lines` (
    id INTEGER PRIMARY KEY,
    conversationId INTEGER,
    timeMilliseconds INTEGER,
    sourceText TEXT,
    displayText TEXT,
    FOREIGN KEY(conversationId) REFERENCES conversations(id)
);

-- Down
DROP TABLE `lines`;
DROP TABLE `conversations`;
DROP TABLE `tracks`;
DROP INDEX `file_path_idx`;
DROP TABLE `files`;
DROP TABLE `items`;
DROP TABLE `libraries`;
DROP TABLE `settings`;