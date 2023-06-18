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

import { NodeRequestOptions } from '@theia/request/lib/node-request-service';
import { isObject, THEIA_VERSION } from '../../common';

export interface FileDependencyResult {
    targetFile: string;
    mode?: number;
}

export type RemotePlatform = 'windows' | 'linux' | 'darwin';

export type DependencyDownload = FileDependencyDownload | DirectoryDependencyDownload;

export interface FileDependencyDownload {
    archive?: 'tar' | 'zip' | 'tgz'
    file: FileDependencyResult
    buffer: Buffer
}

export namespace FileDependencyResult {
    export function is(item: unknown): item is FileDependencyDownload {
        return isObject(item) && 'buffer' in item && 'file' in item;
    }
}

// Directories are expected to be in a zipped format anyway
// We always unzip them and call `files` on each contained file
export interface DirectoryDependencyDownload {
    files: (path: string) => FileDependencyResult;
    archive: 'tar' | 'zip' | 'tgz'
    buffer: Buffer
}

export namespace DirectoryDependencyDownload {
    export function is(item: unknown): item is DirectoryDependencyDownload {
        return isObject(item) && 'buffer' in item && 'files' in item;
    }
}

export interface DownloadOptions {
    remotePlatform: RemotePlatform;
    theiaVersion: string;
    download: (requestInfo: string | NodeRequestOptions) => Promise<Buffer>
}

/**
 * contribution used for downloading prebuild nativ dependency when connecting to a remote machine with a different system
 */
export interface RemoteNativeDependencyContribution {
    // used to filter out multiple contributions downloading the same package
    dependencyId: string;
    download(options: DownloadOptions): Promise<DependencyDownload>;
}

export namespace RemoteNativeDependencyContribution {
    export const Contribution = Symbol('RemoteNativeDependencyContribution');

    // TODO: For points for testing purposes to a non-theia repo
    // 'https://github.com/eclipse-theia/theia/releases/download'
    export const DEFAULT_DEPENDENCY_DOWNLOAD_URL = 'https://github.com/jonah-iden/theia-native-dependencies/releases/download';

    export function getDefaultURLForFile(dependencyName: string, remotePlatform: RemotePlatform, theiaVersion: string = THEIA_VERSION): string {
        return `${DEFAULT_DEPENDENCY_DOWNLOAD_URL}/${theiaVersion}/${dependencyName}-${remotePlatform}-x64.zip`;
    }
}

export const DependencyDownloadService = Symbol('DependencyDownloadService');

/**
 * used by the "@theia/remote" package to download nativ dependencies for the remote system;
 */
export interface DependencyDownloadService {

    /**
     * downloads natvie dependencies for copying on a remote machine
     * @param remoteSystem the operating system of the remote machine in format "{platform}-{architecure}"" e.g. "win32-x64"
     */
    downloadDependencies(remoteSystem: string): Promise<DependencyDownload[]>;
}
