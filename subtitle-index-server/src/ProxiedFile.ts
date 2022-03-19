
import { existsSync as fileExists, symlinkSync as symlink, unlinkSync as unlink } from 'fs';
import { randomBytes } from 'crypto';


/**
 * The files we are processing might have paths longer than ffmpeg can handle.
 * In this case it's possible to process them anyway by using symlinks. However
 * on Windows systems, symlinks require admin access  (or SeCreateSymbolicLinkPrivilege)
 * so this behaviour should be optional.
 */
export class ProxiedFile {
    private underlyingPath: string;
    public path: string;
    private symlinkUsed: boolean;

    constructor(path: string) {
        this.underlyingPath = path;
        this.path = path;
        this.symlinkUsed = false;

        if(process.env.SYMLINK_PREFIX) {
            let suffix = 0;
            do {
                this.path = `${process.env.SYMLINK_PREFIX}${suffix}`;
                try {
                    symlink(this.underlyingPath, this.path);
                    this.symlinkUsed = true;
                } catch (ex) {
                    if(ex?.code !== 'EEXIST') {
                        throw ex;
                    }
                    suffix++;
                }
            } while (!this.symlinkUsed)
        }
    }

    public destroy() {
        if(this.symlinkUsed) {
            unlink(this.path);
        }
    }
}