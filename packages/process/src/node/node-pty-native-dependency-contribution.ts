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

import { DependencyDownload, DownloadOptions, RemoteNativeDependencyContribution } from '@theia/core/lib/node/remote';
import { injectable } from '@theia/core/shared/inversify';
import path = require('path');

@injectable()
export class NodePtyNativeDependencyContribution implements RemoteNativeDependencyContribution {
    dependencyId = 'node-pty';

    async download(options: DownloadOptions): Promise<DependencyDownload> {
        return {
            files: filePath => ({
                targetFile: filePath.endsWith('pty.node') ? 'lib/backend/native/pty.node' : `lib/build/Release/${path.basename(filePath)}`,
                mode: filePath.endsWith('.node') ? undefined : 0o777
            }),
            buffer: await options.download(RemoteNativeDependencyContribution.getDefaultURLForFile('node-pty', options.remotePlatform, options.theiaVersion)),
            archive: 'zip'
        };
    }
}
