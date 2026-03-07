const os = require('os');
const path = require('path');

const DEFAULT_UPLOADS_DIR = path.join(os.homedir(), 'images', 'nightcompanion');

function resolveUploadsDir() {
    const configuredDir = process.env.NC_UPLOADS_DIR;
    if (configuredDir && configuredDir.trim()) {
        return path.resolve(configuredDir.trim());
    }

    return DEFAULT_UPLOADS_DIR;
}

module.exports = {
    DEFAULT_UPLOADS_DIR,
    resolveUploadsDir,
};
