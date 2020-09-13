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

CREATE TABLE `files` (
    id INTEGER PRIMARY KEY,
    libraryId INTEGER NOT NULL,
    path STRING NOT NULL, -- Relative to the library path
    lastModified INTEGER NOT NULL,
    size INTEGER,
    stillExists INTEGER NOT NULL, -- Indicates whether this file was present during the last scan
    indexed INTEGER NOT NULL, -- Indicates whether this file has been processed yet
    UNIQUE(libraryId, path),
    CONSTRAINT fk_file_library FOREIGN KEY(libraryId) REFERENCES libraries(id) ON DELETE CASCADE
);
CREATE INDEX `file_path_idx` ON files(path);

CREATE TABLE `tracks` (
    id INTEGER PRIMARY KEY,
    fileId INTEGER,
    trackNumber INTEGER,
    language STRING,
    title STRING,
    UNIQUE(fileId, trackNumber),
    CONSTRAINT fk_track_file FOREIGN KEY(fileId) REFERENCES files(id) ON DELETE CASCADE
);

CREATE TABLE `conversations` (
    id INTEGER PRIMARY KEY,
    trackId INTEGER,
    indexedText TEXT,
    CONSTRAINT fk_conversation_track FOREIGN KEY(trackId) REFERENCES tracks(id) ON DELETE CASCADE
);

CREATE TABLE `lines` (
    id INTEGER PRIMARY KEY,
    conversationId INTEGER,
    startMs INTEGER,
    endMs INTEGER,
    rawText TEXT,
    displayText TEXT,
    CONSTRAINT fk_line_conversation FOREIGN KEY(conversationId) REFERENCES conversations(id) ON DELETE CASCADE
);

-- Down
DROP TABLE `lines`;
DROP TABLE `conversations`;
DROP TABLE `tracks`;
DROP INDEX `file_path_idx`;
DROP TABLE `files`;
DROP TABLE `libraries`;
DROP TABLE `settings`;