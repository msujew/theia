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

import { injectable } from 'inversify';
import { RemoteNativeDependencyContribution, DownloadOptions, DependencyDownload, RemotePlatform } from './remote-native-dependency-contribution';

@injectable()
export class DrivelistNativeDependencyContribution implements RemoteNativeDependencyContribution {
    dependencyId = 'drivelist';

    async download(options: DownloadOptions): Promise<DependencyDownload> {
        return {
            file: {
                targetFile: 'lib/backend/native/drivelist.node'
            },
            buffer: await options.download(RemoteNativeDependencyContribution.getDefaultURLForFile('drivelist', options.remotePlatform, options.theiaVersion)),
            archive: 'zip'
        };
    }
}

@injectable()
export class KeytarNativeDependencyContribution implements RemoteNativeDependencyContribution {
    dependencyId = 'keytar';

    async download(options: DownloadOptions): Promise<DependencyDownload> {
        return {
            file: {
                targetFile: 'lib/backend/native/keytar.node'
            },
            buffer: await options.download(RemoteNativeDependencyContribution.getDefaultURLForFile('keytar', options.remotePlatform, options.theiaVersion)),
            archive: 'zip'
        };
    }
}

@injectable()
export class NSFWNativeDependencyContribution implements RemoteNativeDependencyContribution {
    dependencyId = 'nsfw';

    async download(options: DownloadOptions): Promise<DependencyDownload> {
        return {
            file: {
                targetFile: 'lib/backend/native/nsfw.node'
            },
            buffer: await options.download(RemoteNativeDependencyContribution.getDefaultURLForFile('nsfw', options.remotePlatform, options.theiaVersion)),
            archive: 'zip'
        };
    }
}

const RIPGRE_BASE_URL = 'https://github.com/microsoft/ripgrep-prebuilt/releases/download/v13.0.0-8/ripgrep-v13.0.0-8';
@injectable()
export class RigrepNativeDependencyContribution implements RemoteNativeDependencyContribution {
    dependencyId = 'rigrep';
    async download(options: DownloadOptions): Promise<DependencyDownload> {
        return {
            file: {
                targetFile: `lib/backend/native/rg${options.remotePlatform === 'windows' ? '.exe' : ''}`,
                mode: 0o777
            },
            buffer: await options.download(this.getDownloadUrl(options.remotePlatform)),
            archive: options.remotePlatform === 'windows' ? 'zip' : 'tgz'
        };
    }

    getDownloadUrl(remotePlatform: RemotePlatform): string {
        let suffix: string;
        if (remotePlatform === 'darwin') {
            suffix = 'x86_64-apple-darwin.tar.gz';
        } else if (remotePlatform === 'windows') {
            suffix = 'i686-pc-windows-msvc.zip';
        } else {
            suffix = 'aarch64-unknown-linux-gnu.tar.gz';
        }
        return `${RIPGRE_BASE_URL}-${suffix}`;
    }
}
