-- Up
CREATE TABLE `settings` (
    setting TEXT NOT NULL,
    value TEXT NOT NULL
);
CREATE INDEX `settings_setting_idx` ON settings(setting);

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
CREATE INDEX `file_library_idx` ON files(libraryId);
CREATE INDEX `file_stillExists_idx` ON files(stillExists);
CREATE INDEX `file_indexed_idx` ON files(indexed);

CREATE TABLE `tracks` (
    id INTEGER PRIMARY KEY,
    fileId INTEGER NOT NULL,
    trackNumber INTEGER NOT NULL,
    type STRING NOT NULL,
    language STRING,
    title STRING,
    subtitlePreambleJson STRING,
    subtitleNondialogueEventsJson STRING,
    UNIQUE(fileId, trackNumber),
    CONSTRAINT fk_track_file FOREIGN KEY(fileId) REFERENCES files(id) ON DELETE CASCADE
);
CREATE INDEX `tracks_file_idx` ON tracks(fileId);

CREATE TABLE `conversations` (
    id INTEGER PRIMARY KEY,
    trackId INTEGER NOT NULL,
    indexedText TEXT,
    CONSTRAINT fk_conversation_track FOREIGN KEY(trackId) REFERENCES tracks(id) ON DELETE CASCADE
);
CREATE INDEX `conversations_track_idx` ON conversations(trackId);

CREATE TABLE `lines` (
    id INTEGER PRIMARY KEY,
    conversationId INTEGER NOT NULL,
    startMs INTEGER,
    endMs INTEGER,
    subtitleEventJson TEXT,
    displayText TEXT,
    CONSTRAINT fk_line_conversation FOREIGN KEY(conversationId) REFERENCES conversations(id) ON DELETE CASCADE
);
CREATE INDEX `lines_conversation_idx` ON lines(conversationId);

-- Down
DROP TABLE `lines`;
DROP TABLE `conversations`;
DROP TABLE `tracks`;
DROP INDEX `lines_conversation_idx`;
DROP INDEX `conversations_track_idx`;
DROP INDEX `tracks_file_idx`;
DROP INDEX `file_indexed_idx`;
DROP INDEX `file_stillExists_idx`;
DROP INDEX `file_library_idx`;
DROP INDEX `file_path_idx`;
DROP TABLE `files`;
DROP TABLE `libraries`;
DROP TABLE `settings`;
DROP INDEX `settings_setting_idx`;