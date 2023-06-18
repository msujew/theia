// *****************************************************************************
// Copyright (C) 2023 TypeFox and others.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0 which is available at
// http://www.eclipse.org/legal/epl-2.0.
//
// This Source Code may also be made available under the following Secondary
// Licenses when the conditions for such availability set forth in the Eclipse
// Public License v. 2.0 are satisfied: GNU General Public License, version 2
// with the GNU Classpath Exception which is available at
// https://www.gnu.org/software/classpath/license.html.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import * as path from 'path';
import * as fs from '@theia/core/shared/fs-extra';
import * as os from 'os';
import { inject, injectable } from '@theia/core/shared/inversify';
import { RequestService } from '@theia/core/shared/@theia/request';
import { RemoteConnection, RemoteExecResult, RemotePlatform } from './remote-types';
import { ApplicationPackage } from '@theia/core/shared/@theia/application-package';
import { RemoteCopyService } from './remote-copy-service';
import { RemoteNativeDependencyService } from './remote-native-dependency-service';

/**
 * The Node.js version that the current Electron version uses.
 * All native dependencies will be compiled against this version, so we need to use it on the remote system.
 */
export const REMOTE_NODE_VERSION = '18.12.1';

@injectable()
export class RemoteSetupService {

    @inject(RequestService)
    protected readonly requestService: RequestService;

    @inject(RemoteCopyService)
    protected readonly copyService: RemoteCopyService;

    @inject(RemoteNativeDependencyService)
    protected readonly nativeDependencyService: RemoteNativeDependencyService;

    @inject(ApplicationPackage)
    protected readonly applicationPackage: ApplicationPackage;

    async setup(connection: RemoteConnection): Promise<void> {
        // 1. Identify remote platform
        const platform = await this.detectRemotePlatform(connection);
        // Build a few remote system paths
        const remoteHome = await this.getRemoteHomeDirectory(connection, platform);
        const applicationDirectory = this.joinRemotePath(platform, remoteHome, `.${this.getRemoteAppName()}`);
        await this.mkdirRemote(connection, platform, applicationDirectory);
        const nodeFileName = this.getNodeFileName(platform);
        const nodeDirName = this.getNodeDirectoryName(platform);
        const remoteNodeDirectory = this.joinRemotePath(platform, applicationDirectory, nodeDirName);
        // 2. Download+copy node for that platform
        const nodeDirExists = await this.dirExistsRemote(connection, remoteNodeDirectory);
        if (!nodeDirExists) {
            const nodeArchive = await this.downloadNode(nodeFileName);
            const remoteNodeZip = this.joinRemotePath(platform, applicationDirectory, nodeFileName);
            await connection.copy(nodeArchive, remoteNodeZip);
            await this.unzipRemote(connection, remoteNodeZip, applicationDirectory);
        }
        // 3. Copy backend to remote system
        const applicationZipFile = this.joinRemotePath(platform, applicationDirectory, `${this.getRemoteAppName()}.tar`);
        await this.copyService.copyToRemote(connection, platform, applicationZipFile);
        await this.unzipRemote(connection, applicationZipFile, applicationDirectory);
        // 4. Download and copy native dependencies
        // 5. start remote backend
        const port = await this.startApplication(connection, platform, applicationDirectory, remoteNodeDirectory);
        connection.remotePort = port;
        throw new Error('Do nothing');
    }

    protected async startApplication(connection: RemoteConnection, platform: RemotePlatform, remotePath: string, nodeDir: string): Promise<number> {
        const nodeExecutable = this.joinRemotePath(platform, nodeDir, 'bin', platform === 'windows' ? 'node.exe' : 'node');
        const mainJsFile = this.joinRemotePath(platform, remotePath, 'lib', 'backend', 'main.js');
        const localAddressRegex = /listening on http:\/\/localhost:(\d+)/;
        const result = await connection.execPartial(nodeExecutable,
            stdout => localAddressRegex.test(stdout),
            [mainJsFile, '--port=0', '--remote']);

        const match = localAddressRegex.exec(result.stdout);
        if (result.stderr || !match) {
            throw new Error('Could not start remote system: ' + result.stderr);
        } else {
            return Number(match[1]);
        }
    }

    protected async detectRemotePlatform(connection: RemoteConnection): Promise<RemotePlatform> {
        const result = await this.retry(() => connection.exec('uname -s'));

        if (result.stderr) {
            // Only Windows systems can error out here
            return 'windows';
        } else if (result.stdout) {
            if (result.stdout.includes('windows32') || result.stdout.includes('MINGW64')) {
                return 'windows';
            } else if (result.stdout.includes('Linux')) {
                return 'linux';
            } else if (result.stdout.includes('Darwin')) {
                return 'darwin';
            }
        }
        throw new Error('Failed to identify remote system: ' + result.stdout + '\n' + result.stderr);
    }

    protected getNodeDirectoryName(platform: RemotePlatform): string {
        const platformId = platform === 'windows' ? 'win' : platform;
        // Always use x64 architecture for now
        const arch = 'x64';
        const dirName = `node-v${REMOTE_NODE_VERSION}-${platformId}-${arch}`;
        return dirName;
    }

    protected getNodeFileName(platform: RemotePlatform): string {
        let fileExtension = '';
        if (platform === 'windows') {
            fileExtension = 'zip';
        } else if (platform === 'darwin') {
            fileExtension = 'tar.gz';
        } else {
            fileExtension = 'tar.xz';
        }
        return `${this.getNodeDirectoryName(platform)}.${fileExtension}`;
    }

    protected async downloadNode(fileName: string): Promise<string> {
        const tmpdir = os.tmpdir();
        const localPath = path.join(tmpdir, fileName);
        if (!await fs.pathExists(localPath)) {
            const downloadPath = `https://nodejs.org/dist/v${REMOTE_NODE_VERSION}/${fileName}`;
            const downloadResult = await this.requestService.request({
                url: downloadPath
            });
            await fs.writeFile(localPath, downloadResult.buffer);
        }
        return localPath;
    }

    protected async getRemoteHomeDirectory(connection: RemoteConnection, platform: RemotePlatform): Promise<string> {
        if (platform === 'windows') {
            const powershellHome = (await this.retry(() => connection.exec('echo $HOME'))).stdout;
            if (powershellHome === '$HOME') {
                // We are not in powershell, but another shell
                const userprofile = (await this.retry(() => connection.exec('echo %userprofile%'))).stdout;
                return userprofile.trim();
            }
            return powershellHome.trim();
        } else {
            const result = await this.retry(() => connection.exec('eval echo ~'));
            return result.stdout.trim();
        }
    }

    protected getRemoteAppName(): string {
        return `${this.cleanupDirectoryName(this.applicationPackage.pck.name || 'theia')}-remote`;
    }

    protected cleanupDirectoryName(name: string): string {
        return name.replace(/[@<>:"\\|?*]/g, '').replace(/\//g, '-');
    }

    protected joinRemotePath(platform: RemotePlatform, ...segments: string[]): string {
        const separator = platform === 'windows' ? '\\' : '/';
        return segments.join(separator);
    }

    protected async mkdirRemote(connection: RemoteConnection, platform: RemotePlatform, remotePath: string): Promise<void> {
        const recursive = platform !== 'windows' ? ' -p' : '';
        const result = await connection.exec(`mkdir${recursive}`, [remotePath]);
        if (result.stderr) {
            throw new Error('Failed to create directory: ' + result.stderr);
        }
    }

    protected async dirExistsRemote(connection: RemoteConnection, remotePath: string): Promise<boolean> {
        const cdResult = await connection.exec('cd', [remotePath]);
        const result = !Boolean(cdResult.stderr);
        console.log('Result direxists: ' + remotePath + ' :: ' + result);
        return result;
    }

    protected async unzipRemote(connection: RemoteConnection, remoteFile: string, remoteDirectory: string): Promise<void> {
        const result = await connection.exec('tar -xf', [remoteFile, '-C', remoteDirectory]);
        if (result.stderr) {
            throw new Error('Failed to unzip: ' + result.stderr);
        }
    }

    protected async retry(action: () => Promise<RemoteExecResult>, times = 10): Promise<RemoteExecResult> {
        let result: RemoteExecResult = { stderr: '', stdout: '' };
        while (times-- > 0) {
            result = await action();
            if (result.stderr || result.stdout) {
                return result;
            }
        }
        return result;
    }
}
