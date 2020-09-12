export type Existing<T extends {}> = T & {
    id: number;
};

export interface Library {
    path: string;
    searchByDefault: 0 | 1;
    stillExists: 0 | 1;
}

export interface Item {
    hash: string;
    indexed: 0 | 1;
}

export interface LibraryFile {
    libraryId: number;
    path: string;
    lastModified: number;
    itemId: number;
    stillExists: number;
    size: number;
}

export interface Tracks {
    itemId: number;
    trackNumber: number;
    name: string;
    indexedTest: string;
}

export interface Conversation {
    conversationId: number;
    timeMilliseconds: number;
    sourceText: string;
    displayText: string;
}