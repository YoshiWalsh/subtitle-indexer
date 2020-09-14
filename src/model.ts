export type Existing<T extends {}> = T & {
    id: number;
};

export interface Library {
    path: string;
    searchByDefault: 0 | 1;
    stillExists: 0 | 1;
}

export interface LibraryFile {
    libraryId: number;
    path: string;
    lastModified: number;
    stillExists: number;
    indexed: 0 | 1;
    size: number;
}

export interface Track {
    fileId: number;
    trackNumber: number;
    type: 'video' | 'audio' | 'subtitle';
    language: string | null;
    title: string | null;
    subtitlePreambleJson: string | null;
    subtitleNondialogueEventsJson: string | null;
}

export interface Conversation {
    trackId: number;
    indexedText: string;
}

export interface Line {
    conversationId: number;
    startMs: number;
    endMs: number;
    subtitleEventJson: string;
    displayText: string;
}