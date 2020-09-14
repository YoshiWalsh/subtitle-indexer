import { db } from './initialiseDb';

export interface Filters {
    libraryId?: Array<number>;
    file?: Array<{libraryId: number, filePath: string}>;
    language?: Array<string | null>;
}

export interface Folder {
    name: string;
    path: string;
    children: Array<Folder>;
}

export async function getFolders() {
    const folders = db.query<{libraryId: number, folderPath: string}>(`
    SELECT DISTINCT
        libraries.id,
        rtrim(files.path, replace(files.path, '/', '')) AS folderPath -- Clever solution: https://stackoverflow.com/a/38330814/674675
    FROM files
    LEFT JOIN libraries ON (libraries.id = files.libraryId)`);
    console.log(folders);
}

export async function search(phrase: string, filters: Filters) {
    let conditions = "";
    let parameters: Array<string | number> = [];

    if(filters.libraryId) {
        let libraryIdCondition = "FALSE";
        for(const libraryId of filters.libraryId) {
            libraryIdCondition += " OR files.libraryId = ?";
            parameters.push(libraryId);
        }
        conditions += ` AND (${libraryIdCondition})`;
    }
    if(filters.file) {
        let filePrefixCondition = "FALSE";
        for(const fileDetails of filters.file) {
            filePrefixCondition += " OR (files.libraryId = ? AND ";
            parameters.push(fileDetails.libraryId);
            if(fileDetails.filePath.substr(-1) === "/") {
                // Searching for a directory
                filePrefixCondition += "files.path LIKE ?)";
                parameters.push(fileDetails.filePath + "%");
            } else {
                // Searching for a file
                filePrefixCondition += "files.path = ?)";
                parameters.push(fileDetails.filePath);
            }
        }
        conditions += ` AND (${filePrefixCondition})`;
    }
    if(filters.language) {
        let languageCondition = "FALSE";
        for(const language of filters.language) {
            if(language === null) {
                languageCondition += " OR tracks.language IS NULL";
            } else {
                languageCondition += " OR tracks.language = ?";
                parameters.push(language);
            }
        }
        conditions += ` AND (${languageCondition})`;
    }

    const query = `
        SELECT
            files.id AS fileId,
            tracks.id AS trackId,
            files.path AS filePath,
            tracks.language AS language,
            tracks.title AS trackTitle,
            snippet(conversations_fts, 0, '{\\start}', '{\\end}', '…', 64) AS preview,
            bm25(conversations_fts) AS relevance
        FROM conversations_fts
            INNER JOIN conversations ON (conversations_fts.rowid = conversations.id)
            INNER JOIN tracks ON (conversations.trackId = tracks.id)
            INNER JOIN files ON (tracks.fileId = files.id)
        WHERE conversations_fts.indexedText MATCH ?
            ${conditions}
        ORDER BY relevance;
    `;

    const searchResults = db.query(query, phrase, ...parameters);
    return searchResults;
    /*
    SELECT files.id, conversations.indexedText, conversations.trackId, bm25(conversations_fts)
    FROM conversations_fts
    INNER JOIN conversations ON (conversations_fts.rowid = conversations.id)
    INNER JOIN tracks ON (conversations.trackId = tracks.id)
    INNER JOIN files ON (tracks.fileId = files.id)
    WHERE conversations_fts.indexedText MATCH "everything I only know what I know"
        AND files.id = 3787
    ORDER BY bm25(conversations_fts);
    */
}