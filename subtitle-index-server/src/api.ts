import { ParsedASSEvent, ParsedASSStyles, ScriptInfo, stringify as stringifyAss, parse as parseAss } from 'ass-compiler';
import { promises as fs } from 'fs';
import { file as createTempFile } from 'tmp-promise';
import * as path from 'path';
import { Converter as FFMPEG } from 'ffmpeg-stream';
import { default as ffmpegStatic } from 'ffmpeg-static';

import { db } from './initialiseDb';
import { Existing, Library, LibraryFile, Line, Track } from './model';
import { app } from './server';
import { Stream } from 'stream';
import { createHash } from 'crypto';
import { SourceMapPayload } from 'module';
import { ProxiedFile } from './ProxiedFile';

const libraryRoot = process.env.ROOT_DIRECTORY || "./data/library";
const outputDirectory = process.env.OUTPUT_DIRECTORY || "./data/output";
process.env.FFMPEG_PATH = ffmpegStatic;

interface Filters {
    file?: Array<{libraryId: number, filePath: string | null}>;
    language?: Array<string | null>;
}

interface Folder {
    name: string;
    path: string;
    children: Array<Folder>;
}

app.get('/api/libraries', (req, res) => {
    res.send(db.query<Existing<Library>>('SELECT * FROM libraries'));
});

app.get('/api/folders', (req, res) => {
    const folderPaths = db.query<{libraryId: number, folderPath: string}>(`
    SELECT DISTINCT
        libraryId,
        rtrim(files.path, replace(files.path, '/', '')) AS folderPath -- Clever solution: https://stackoverflow.com/a/38330814/674675
    FROM files`);

    const folders: {[libraryId: number]: Array<Folder>} = {};
    for(const folder of folderPaths) {
        const folderPath = folder.folderPath;
        const components = folderPath.substr(0, folderPath.length - 1).split("/");

        let currentLevelFolders = folders[folder.libraryId] = folders[folder.libraryId] || [];

        for(let i = 0; i < components.length; i++) {
            const currentComponent = components[i];
            const existingFolder = currentLevelFolders.find(f => f.name === currentComponent);
            if(existingFolder) {
                currentLevelFolders = existingFolder.children;
            } else {
                const newFolder: Folder = {
                    name: currentComponent,
                    path: components.slice(0, i+1).join("/") + "/",
                    children: [],
                }
                currentLevelFolders.push(newFolder);
                currentLevelFolders = newFolder.children;
            }
        }
    }
    res.send(folders);
});

app.get('/api/search', (req, res) => {
    const filters: Filters = {};
    if(typeof(req.query['files']) === 'string') {
        filters.file = (req.query['files']).split(",").map(f => {
            const slashIndex = f.indexOf('/');
            return {
                libraryId: parseInt(f.substring(0, slashIndex === -1 ? f.length : slashIndex), 10),
                filePath: slashIndex === -1 ? null : f.substring(slashIndex + 1, f.length),
            };
        });
    }
    if(req.query['languages']) {
        filters.language = (req.query['libraries'] as string).split(",");
    }

    search(req.query['phrase'] as string, filters).then(result => res.send(result));
});

async function search(phrase: string, filters: Filters) {
    let conditions = "";
    let parameters: Array<string | number> = [];

    if(filters.file) {
        let filePrefixCondition = "FALSE";
        for(const fileDetails of filters.file) {
            filePrefixCondition += " OR (files.libraryId = ?";
            parameters.push(fileDetails.libraryId);
            if(fileDetails.filePath) {
                filePrefixCondition += " AND ";
                if(fileDetails.filePath.substr(-1) === "/") {
                    // Searching for a directory
                    filePrefixCondition += "files.path LIKE ?";
                    parameters.push(fileDetails.filePath + "%");
                } else {
                    // Searching for a file
                    filePrefixCondition += "files.path = ?";
                    parameters.push(fileDetails.filePath);
                }
            }
            filePrefixCondition += ")";
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
            conversations.id AS conversationId,
            files.path AS filePath,
            tracks.language AS language,
            tracks.title AS trackTitle,
            snippet(conversations_fts, 0, '{\\start}', '{\\end}', '…', 64) AS preview,
            bm25(conversations_fts) AS relevance
        FROM conversations_fts
            INNER JOIN conversations ON (conversations_fts.rowid = conversations.id)
            INNER JOIN tracks ON (conversations.trackId = tracks.id)
            INNER JOIN files ON (tracks.fileId = files.id AND files.stillExists)
            INNER JOIN libraries ON (files.libraryId = libraries.id AND libraries.stillExists AND libraries.searchByDefault)
        WHERE conversations_fts.indexedText MATCH ?
            ${conditions}
        ORDER BY relevance;
    `;

    const searchResults = db.query(query, phrase, ...parameters);
    return searchResults;
}

app.get('/api/files/:fileId', async (req, res) => {
    if(typeof(req.params['fileId']) !== 'string') {
        throw new Error("fileId not specified");
    }
    const fileId = parseInt(req.params['fileId'], 10);

    const file = db.queryFirstRow<Existing<LibraryFile>>('SELECT * FROM files WHERE id=?', fileId);
    const tracks = db.query<Existing<Track>>('SELECT * FROM tracks WHERE fileId=?', fileId);

    res.send({
        file,
        tracks
    });
});

app.get('/api/tracks/:trackId', async (req, res) => {
    if(typeof(req.params['trackId']) !== 'string') {
        throw new Error("trackId not specified");
    }
    const trackId = parseInt(req.params['trackId'], 10);

    const track = db.queryFirstRow<Existing<Track>>('SELECT * FROM tracks WHERE id=?', trackId);
    if(!track) {
        throw new Error("Track not found");
    }
    const lines = db.query<Existing<Line>>(`
        SELECT
            lines.conversationId AS conversationId,
            lines.startMs AS startMs,
            lines.endMs AS endMs,
            lines.subtitleEventJson AS subtitleEventJson,
            lines.displayText AS displayText
        FROM lines
        INNER JOIN conversations ON (conversations.id = lines.conversationId)
        WHERE conversations.trackId = ?
    `, trackId);

    res.send({
        track: {
            id: track.id,
            type: track.type,
            title: track.title,
            language: track.language,
            streamIndex: track.trackNumber,
            preamble: track.subtitlePreambleJson ? JSON.parse(track.subtitlePreambleJson) : null,
            nondialogueEvents: track.subtitleNondialogueEventsJson ? JSON.parse(track.subtitleNondialogueEventsJson) : null,
        },
        lines: lines.map(l => ({
            conversationId: l.conversationId,
            displayText: l.displayText,
            event: JSON.parse(l.subtitleEventJson),
        }))
    });
});

interface RenderRequestBase {
    startSeconds: number,
    preamble: {
        info: ScriptInfo,
        styles: ParsedASSStyles,
    },
    nondialogueEvents: {
        comment: Array<ParsedASSEvent>,
        format: Array<string>,
    },
    dialogueEvents: Array<ParsedASSEvent>,
    videoTrackId: number,
    audioTrackId?: number,
};

interface RenderRequestVideo extends RenderRequestBase {
    outputFormat: 'mp4' | 'webm' | 'gif',
    endSeconds: number,
}

interface RenderRequestStill extends RenderRequestBase {
    outputFormat: 'png',
}

type RenderRequest = RenderRequestVideo | RenderRequestStill;

function isStill(request: RenderRequest): request is RenderRequestStill {
    return ["png"].includes(request.outputFormat);
}

interface StreamDetails {
    trackId: number,
    libraryPath: string,
    filePath: string,
    streamIndex: number,
};

// Annoyingly, ass-compiler won't allow us to re-compile ASS using raw text, we have to use the parsed text format.
// So this function converts raw text into parsed text, so that we can then stringify the subtitles.
function parseAssText(text: string) {
    const dummyText = `
    [Events]
    Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
    Dialogue: 0,0:00:00.00,0:00:05.00,Default,,0000,0000,0000,,${text}
    `;

    const parsed = parseAss(dummyText);

    return parsed.events.dialogue[0].Text.parsed;
} 

app.post('/api/render', async (req, res) => {
    req.setTimeout(1000*60*60*10);
    const payload: RenderRequest = req.body;

    const payloadHash = createHash('sha256')
        .update(JSON.stringify(payload))
        .digest('base64')
        // Need to make it filename- and URL-safe, we'll go with the base64url format from RFC 4648 §5
        .replace(/\+/g, "-")
        .replace(/\//g, "_");

    const hasAudio = typeof(payload.audioTrackId) === 'number';
    const streams: Array<StreamDetails> = db.query(`
        SELECT
            tracks.id AS trackId,
            libraries.path AS libraryPath,
            files.path AS filePath,
            tracks.trackNumber AS streamIndex
        FROM tracks
        LEFT JOIN files ON (files.id = tracks.fileId)
        LEFT JOIN libraries ON (libraries.id = files.libraryId)
        WHERE tracks.id IN (?, ?)
    `, payload.videoTrackId, hasAudio ? payload.audioTrackId : null);

    const videoStream = streams.find(s => s.trackId === payload.videoTrackId);
    const audioStream = hasAudio ? streams.find(s => s.trackId === payload.audioTrackId) : null;
    if(!videoStream) {
        throw new Error("Specified video stream not found");
    }
    if(hasAudio && !audioStream) {
        throw new Error("Specified audio stream not found");
    }

    const assString = stringifyAss({
        ...payload.preamble,
        events: {
            ...payload.nondialogueEvents,
            dialogue: payload.dialogueEvents.map(l => ({
                ...l,
                Text: {
                    raw: l.Text.raw, // I wish this worked
                    parsed: parseAssText(l.Text.raw), // Because then we wouldn't have to do this,
                    combined: "", // This is pointless
                },
                Start: Math.max(l.Start - payload.startSeconds, 0),
                End: Math.max(l.End - payload.startSeconds, 0),
            }))
        },
    });

    const tempFile = await createTempFile({ postfix: '.ass', discardDescriptor: true });

    try {
        await fs.writeFile(tempFile.path, assString);

        const includeAudio = audioStream && !isStill(payload);

        const proxiedVideoFile = new ProxiedFile(path.resolve(libraryRoot, videoStream.libraryPath, videoStream.filePath));
        const proxiedAudioFile = includeAudio ? new ProxiedFile(path.resolve(libraryRoot, audioStream!.libraryPath, audioStream!.filePath)) : null;

        const ffmpeg = new FFMPEG();

        ffmpeg.createInputFromFile(proxiedVideoFile.path, {
            nostdin: true,
            y: true,
            ss: payload.startSeconds,
            ...(isStill(payload) ? {} : { t: payload.endSeconds - payload.startSeconds }),
        });

        if(includeAudio) {
            ffmpeg.createInputFromFile(proxiedAudioFile!.path, {
                ss: payload.startSeconds,
                t: (payload as RenderRequestVideo).endSeconds - payload.startSeconds,
            });
        }

        const escapedSubtitlePath = tempFile.path
            .replace(/\\/g, "\\\\") // Escape directory slashes
            .replace(/:/g, "\\:") // Escape filter argument separators
            .replace(/\\/g, "\\\\"); // Escape filter_complex argument

        let encoderParameters: Record<string, string | number | boolean | null | undefined | Array<string | null | undefined>> = {};
        switch(payload.outputFormat) {
            case "mp4":
                encoderParameters = {
                    ...encoderParameters,
                    'c:v': 'libx264',
                    tune: 'animation',
                    crf: 16,
                };
                break;
            case "webm":
                encoderParameters = {
                    ...encoderParameters,
                    'c:v': 'libvpx',
                    crf: 6,
                    'b:v': '1M'
                };
                break;
            default:
                break;
        }

        if(isStill(payload)) {
            encoderParameters['frames:v'] = 1;
        }

        ffmpeg.createOutputToFile(path.resolve(outputDirectory, payloadHash + "." + payload.outputFormat), {
            filter_complex: `[0:${videoStream.streamIndex}]ass=${escapedSubtitlePath}[v]`,
            ...encoderParameters,
            ac: 2,
            map: [
                '[v]',
                ...(audioStream && !isStill(payload) ? [`1:${audioStream.streamIndex}`] : []),
            ],
            map_metadata: -1,
            map_chapters: -1,
        });

        await ffmpeg.run();

        tempFile.cleanup();

        // TODO: Run a scheduled task to delete outdated output files

        res.send({
            "outputFile": "/output/" + payloadHash + "." + payload.outputFormat,
        });

        proxiedVideoFile.destroy();
        proxiedAudioFile?.destroy();
    } catch (ex) {

        tempFile.cleanup();

        res.status(500).send({
            message: "Encountered an error while rendering video",
            details: ex,
        });
    } finally {
    }
});