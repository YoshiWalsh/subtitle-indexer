export interface Filters {
    filePrefix?: Array<string>;
    languages?: Array<string>;
}

async function search(phrase: string, filters: Filters) {
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