import * as crypto from 'crypto';
import { promises as fs, createReadStream } from 'fs';
import * as path from 'path';
import { Stream } from 'stream';
import { demand } from 'ts-demand';

import { db } from './initialiseDb';
import { Existing, Item, Library, LibraryFile } from './model';

const libraryRoot = process.env.ROOT_DIRECTORY || ".";

export async function performScans() {
    if(process.env.DEFAULT_LIBRARIES || process.env.NONDEFAULT_LIBRARIES) {
        const defaultLibraries = (process.env.DEFAULT_LIBRARIES || "").split(",").filter(l => l.length > 0);
        const nondefaultLibraries = (process.env.NONDEFAULT_LIBRARIES || "").split(",").filter(l => l.length > 0);
        const allLibraries = [...defaultLibraries, ...nondefaultLibraries];

        const existingLibraries = db.query<Existing<Library>>("SELECT * FROM libraries");
        for(const existingLibrary of existingLibraries) {
            if(allLibraries.indexOf(existingLibrary.path) === -1) {
                db.delete('files', {
                    libraryId: existingLibrary.id,
                });
                db.delete('libraries', {
                    id: existingLibrary.id,
                });
            }
        }

        for(const libraryPath of defaultLibraries) {
            db.replace('libraries', demand<Library>({
                path: libraryPath,
                searchByDefault: 1,
                stillExists: 1
            }));
        }

        for(const libraryPath of nondefaultLibraries) {
            db.replace('libraries', demand<Library>({
                path: libraryPath,
                searchByDefault: 0,
                stillExists: 1
            }));
        }
    }
    else if(!process.env.SKIP_SETUP && !db.queryFirstCell("SELECT value FROM settings WHERE setting=?", 'setupComplete')) {
        console.log("Performing first-time setup. You can disable this with the SKIP_SETUP environment variable, or use DEFAULT_LIBRARIES and NONDEFAULT_LIBRARIES to specify comma-separated lists of library locations.");
        await scanForDefaultLibraries();
    }

    await checkLibraryExistence();
    await scanFiles();
}

export async function scanForDefaultLibraries() {
    const rootNodes = await fs.readdir(libraryRoot, {withFileTypes: true}).catch(err => {
        throw new Error(`Failed to scan for libraries, received error code ${err.code} while scanning ${libraryRoot}`);
    });
    const folders = rootNodes.filter(n => n.isDirectory());
    folders.forEach(f => {
        db.replace('libraries', {
            path: f.name,
            searchByDefault: 1,
            stillExists: 1,
        });
    });
}

export async function checkLibraryExistence() {
    const libraries = db.query<Existing<Library>>("SELECT id, path, stillExists FROM libraries");

    await Promise.all(libraries.map(async library => {
        const libraryPath = path.resolve(libraryRoot, library.path);
        const exists = await fs.stat(libraryPath).then(() => true, () => false) ? 1 : 0;
        if(exists != library.stillExists) {
            db.update('libraries', {
                stillExists: exists,
            }, {
                id: library.id,
            });
        }
    }));
}

export async function scanFiles() {
    const libraries = db.query<Existing<Library>>("SELECT * FROM libraries WHERE stillExists");
    for (const library of libraries) {
        const libraryPath = path.resolve(libraryRoot, library.path);
        const files = await getFilesRecursive(libraryPath);
        const existingFiles = await db.query<Existing<LibraryFile>>("SELECT * FROM files WHERE libraryId=?", library.id);

        // Remove files that no longer exist
        for(const existingFile of existingFiles) {
            if(files.indexOf(existingFile.path) === -1) {
                db.update<LibraryFile>('files', {
                    stillExists: 0,
                }, {
                    id: existingFile.id,
                });
            }
        }

        for (const relativePath of files) {
            const fullPath = path.resolve(libraryPath, relativePath);

            try {
                const fileDetails = await fs.stat(fullPath);
                console.log("Hashing file", fullPath, "of size", fileDetails.size);
                const hash = await getFileHash(fullPath);

                let itemId = db.queryFirstCell<number>("SELECT id FROM items WHERE hash=?", hash);
                if(itemId === undefined) {
                    itemId = db.insert('items', demand<Item>({
                        hash,
                        indexed: 0,
                    }));
                }
                db.replace('files', demand<LibraryFile>({
                    libraryId: library.id,
                    path: relativePath,
                    lastModified: fileDetails.mtime.getTime() / 1000,
                    itemId,
                    stillExists: 1,
                    size: fileDetails.size,
                }));
            } catch (err) {
                console.warn("Error while scanning file", fullPath, err);
            }
        }
    }
}

async function getFilesRecursive(directory: string): Promise<Array<string>> {
    const children = await fs.readdir(directory, {withFileTypes: true});
    let files = children.filter(c => c.isFile()).map(f => f.name);
    const folders = children.filter(c => c.isDirectory());

    for (const folder of folders) {
        const subFiles = await getFilesRecursive(path.resolve(directory, folder.name));
        const relativePaths = subFiles.map(name => `${directory}/${name}`);
        files = files.concat(relativePaths);
    }

    return files;
}

async function getFileHash(path: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const hasher = crypto.createHash('sha1');
        const readStream = createReadStream(path);
        readStream.on('data', chunk => {
            hasher.update(chunk);
        });
        readStream.on('err', err => {
            readStream.close();
            hasher.destroy();
            reject(err);
        });
        readStream.on('end', () => {
            resolve(hasher.digest('base64'));
        });
    });
}