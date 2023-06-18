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

import { ContributionProvider, THEIA_VERSION } from '@theia/core';
import { inject, injectable, named } from '@theia/core/shared/inversify';
import { DependencyDownload, DirectoryDependencyDownload, FileDependencyResult, RemoteNativeDependencyContribution, RemotePlatform } from '@theia/core/lib/node/remote';
import { RequestContext, RequestService, RequestOptions } from '@theia/core/shared/@theia/request';
import * as decompress from 'decompress';
import * as path from 'path';
import * as fs from 'fs/promises';

const decompressTar = require('decompress-tar');
const decompressTargz = require('decompress-targz');
const decompressUnzip = require('decompress-unzip');

export const DEFAULT_HTTP_OPTIONS = {
    method: 'GET',
    headers: {
        Accept: 'application/octet-stream'
    },
};

export interface NativeDependencyFile {
    path: string;
    target: string;
    mode?: number;
}

@injectable()
export class RemoteNativeDependencyService {

    @inject(ContributionProvider) @named(RemoteNativeDependencyContribution.Contribution)
    protected nativeDependencyContributions: ContributionProvider<RemoteNativeDependencyContribution>;

    @inject(RequestService)
    protected requestService: RequestService;

    async downloadDependencies(remotePlatform: RemotePlatform, directory: string): Promise<NativeDependencyFile[]> {
        const contributionResults = await Promise.all(this.nativeDependencyContributions.getContributions()
            .map(async contribution => {
                try {
                    const result = await contribution.download({
                        remotePlatform,
                        theiaVersion: THEIA_VERSION,
                        download: requestInfo => this.downloadDependency(requestInfo)
                    });
                    const dependency = await this.storeDependency(result, directory);
                    return dependency;
                } catch (err) {
                    console.error('Failed to download dependency ' + contribution.dependencyId);
                    throw err;
                }
            }));
        return contributionResults.flat();
    }

    protected async downloadDependency(downloadURI: string | RequestOptions): Promise<Buffer> {
        const options = typeof downloadURI === 'string'
            ? { url: downloadURI, ...DEFAULT_HTTP_OPTIONS }
            : { ...DEFAULT_HTTP_OPTIONS, ...downloadURI };
        console.log('Download dependency from ' + options.url);
        const req = await this.requestService.request(options);
        if (RequestContext.isSuccess(req)) {
            return Buffer.from(req.buffer);
        } else {
            throw new Error('Server error while downloading native dependency from: ' + options.url);
        }
    }

    protected async storeDependency(dependency: DependencyDownload, directory: string): Promise<NativeDependencyFile[]> {
        if (DirectoryDependencyDownload.is(dependency) || dependency.archive) {
            const archiveBuffer = dependency.buffer;
            const plugins: unknown[] = [];
            if (dependency.archive === 'tar') {
                plugins.push(decompressTar());
            } else if (dependency.archive === 'tgz') {
                plugins.push(decompressTargz());
            } else if (dependency.archive === 'zip') {
                plugins.push(decompressUnzip());
            }
            const files = await decompress(archiveBuffer, directory, { plugins });
            if (FileDependencyResult.is(dependency)) {
                const file = files[0];
                const localPath = path.join(directory, file.path);
                return [{
                    path: localPath,
                    target: dependency.file.targetFile,
                    mode: dependency.file.mode
                }];
            } else {
                const result: NativeDependencyFile[] = await Promise.all(files.map(async file => {
                    const fileResult = dependency.files(file.path);
                    const localPath = path.join(directory, file.path);
                    return {
                        path: localPath,
                        target: fileResult.targetFile,
                        mode: fileResult.mode
                    };
                }));
                return result;
            }
        } else {
            const fileName = path.basename(dependency.file.targetFile);
            const localPath = path.join(directory, fileName);
            await fs.writeFile(localPath, dependency.buffer);
            return [{
                path: localPath,
                target: dependency.file.targetFile,
                mode: dependency.file.mode
            }];
        }
    }

}
