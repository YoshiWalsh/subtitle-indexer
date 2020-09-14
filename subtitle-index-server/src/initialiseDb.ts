import DB from 'better-sqlite3-helper';

export const db = DB({
    migrate: {
        force: process.env.NODE_ENV === 'development' ? 'last' : false,
    },
});