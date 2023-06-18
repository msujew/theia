const { promisify } = require('util');
const glob = promisify(require('glob'));
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

async function run() {
    const repoPath = path.resolve(__dirname, '..');
    const zipFile = path.join(__dirname, `native-dependencies-${process.platform}-${process.arch}.zip`);
    const electronAppPath = path.join(repoPath, 'examples', 'electron');
    const nativeDependencies = await glob('lib/backend/native/**', {
        cwd: electronAppPath
    });
    const buildDependencies = await glob('lib/build/Release/**', {
        cwd: electronAppPath
    });
    const archive = archiver('zip');
    const output = fs.createWriteStream(zipFile, { flags: "w" });
    archive.pipe(output);
    for (const file of [
        ...nativeDependencies,
        ...buildDependencies
    ]) {
        const filePath = path.join(electronAppPath, file);
        archive.file(filePath, {
            name: file,
            mode: (await fs.promises.stat(filePath)).mode
        });
    }
    await archive.finalize();
}

run();
