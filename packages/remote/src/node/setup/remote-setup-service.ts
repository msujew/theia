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

import { inject, injectable } from '@theia/core/shared/inversify';
import { RemoteConnection, RemoteExecResult, RemoteStatusReport } from '../remote-types';
import { ApplicationPackage } from '@theia/core/shared/@theia/application-package';
import { RemoteCopyService } from './remote-copy-service';
import { RemoteNativeDependencyService } from './remote-native-dependency-service';
import { THEIA_VERSION } from '@theia/core';
import { RemoteNodeSetupService } from './remote-node-setup-service';
import { RemotePlatform } from '@theia/core/lib/node/remote';

@injectable()
export class RemoteSetupService {

    @inject(RemoteCopyService)
    protected readonly copyService: RemoteCopyService;

    @inject(RemoteNativeDependencyService)
    protected readonly nativeDependencyService: RemoteNativeDependencyService;

    @inject(RemoteNodeSetupService)
    protected readonly nodeSetupService: RemoteNodeSetupService;

    @inject(ApplicationPackage)
    protected readonly applicationPackage: ApplicationPackage;

    async setup(connection: RemoteConnection, report: RemoteStatusReport): Promise<void> {
        report('Identifying remote system...');
        // 1. Identify remote platform
        const platform = await this.detectRemotePlatform(connection);
        // 2. Setup home directory
        const remoteHome = await this.getRemoteHomeDirectory(connection, platform);
        const applicationDirectory = RemotePlatform.joinPath(platform, remoteHome, `.${this.getRemoteAppName()}`);
        await this.mkdirRemote(connection, platform, applicationDirectory);
        // 3. Download+copy node for that platform
        const nodeFileName = this.nodeSetupService.getNodeFileName(platform);
        const nodeDirName = this.nodeSetupService.getNodeDirectoryName(platform);
        const remoteNodeDirectory = RemotePlatform.joinPath(platform, applicationDirectory, nodeDirName);
        const nodeDirExists = await this.dirExistsRemote(connection, remoteNodeDirectory);
        if (!nodeDirExists) {
            report('Downloading and installing Node.js on remote...');
            const remoteNodeInstallScript = this.nodeSetupService.generateDownloadScript(platform, applicationDirectory);
            const nodeInstallResult = await connection.exec('sh -c', [remoteNodeInstallScript]);
            if (nodeInstallResult.stderr) {
                console.log('Failed executing install script: ' + nodeInstallResult.stderr);
                // The install script has resulted in an error
                // Download the binaries locally and move it via SSH
                const nodeArchive = await this.nodeSetupService.downloadNode(platform);
                const remoteNodeZip = RemotePlatform.joinPath(platform, applicationDirectory, nodeFileName);
                await connection.copy(nodeArchive, remoteNodeZip);
                await this.unzipRemote(connection, remoteNodeZip, applicationDirectory);
            } else {
                console.log('Successfully executed install script: ' + nodeInstallResult.stdout);
            }
        }
        // 4. Copy backend to remote system
        const libDir = RemotePlatform.joinPath(platform, applicationDirectory, 'lib');
        const libDirExists = await this.dirExistsRemote(connection, libDir);
        if (!libDirExists) {
            report('Copying application to remote...');
            const applicationZipFile = RemotePlatform.joinPath(platform, applicationDirectory, `${this.getRemoteAppName()}.tar`);
            await this.copyService.copyToRemote(connection, platform, applicationZipFile);
            await this.unzipRemote(connection, applicationZipFile, applicationDirectory);
        }
        // 5. start remote backend
        report('Starting application on remote...');
        const port = await this.startApplication(connection, platform, applicationDirectory, remoteNodeDirectory);
        connection.remotePort = port;
    }

    protected async startApplication(connection: RemoteConnection, platform: RemotePlatform, remotePath: string, nodeDir: string): Promise<number> {
        const nodeExecutable = RemotePlatform.joinPath(platform, nodeDir, 'bin', platform === 'windows' ? 'node.exe' : 'node');
        const mainJsFile = RemotePlatform.joinPath(platform, remotePath, 'lib', 'backend', 'main.js');
        const localAddressRegex = /listening on http:\/\/localhost:(\d+)/;
        // Change to the remote application path and start a node process with the copied main.js file
        // This way, our current working directory is set as expected
        const result = await connection.execPartial(`cd "${remotePath}";${nodeExecutable}`,
            stdout => localAddressRegex.test(stdout),
            [mainJsFile, '--port=0', '--remote']);

        const match = localAddressRegex.exec(result.stdout);
        if (!match) {
            throw new Error('Could not start remote system: ' + result.stderr);
        } else {
            return Number(match[1]);
        }
    }

    protected async detectRemotePlatform(connection: RemoteConnection): Promise<RemotePlatform> {
        const result = await this.retry(() => connection.exec('uname -s'));

        if (result.stderr) {
            // Only Windows systems return an error output here
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
        const appName = this.applicationPackage.pck.name || 'theia';
        const appVersion = this.applicationPackage.pck.version || THEIA_VERSION;
        return `${this.cleanupDirectoryName(`${appName}-${appVersion}`)}-remote`;
    }

    protected cleanupDirectoryName(name: string): string {
        return name.replace(/[@<>:"\\|?*]/g, '').replace(/\//g, '-');
    }

    protected async mkdirRemote(connection: RemoteConnection, platform: RemotePlatform, remotePath: string): Promise<void> {
        const recursive = platform !== 'windows' ? ' -p' : '';
        const result = await this.retry(() => connection.exec(`mkdir${recursive} "${remotePath}";echo "Success"`));
        if (result.stderr) {
            throw new Error('Failed to create directory: ' + result.stderr);
        }
    }

    protected async dirExistsRemote(connection: RemoteConnection, remotePath: string): Promise<boolean> {
        const cdResult = await this.retry(() => connection.exec(`cd "${remotePath}";echo "Success"`));
        return !Boolean(cdResult.stderr);
    }

    protected async unzipRemote(connection: RemoteConnection, remoteFile: string, remoteDirectory: string): Promise<void> {
        const result = await connection.exec('tar -xf', [remoteFile, '-C', remoteDirectory]);
        if (result.stderr) {
            throw new Error('Failed to unzip: ' + result.stderr);
        }
    }

    /**
     * Sometimes, ssh2.exec will not execute and retrieve any data.
     * For this case, we just perform the exec call multiple times until we get something back.
     * See also https://github.com/mscdex/ssh2/issues/48
     */
    protected async retry(action: () => Promise<RemoteExecResult>, times = 20): Promise<RemoteExecResult> {
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
