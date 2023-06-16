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

import { ApplicationPackage } from '@theia/core/shared/@theia/application-package';
import { inject, injectable, named } from '@theia/core/shared/inversify';
import { RemoteCopyContribution, RemoteCopyRegistry, RemoteFile } from '@theia/core/lib/node/remote/remote-copy-contribution';
import { RemoteConnection } from './remote-types';
import { ContributionProvider } from '@theia/core';
import * as path from 'path';

@injectable()
export class RemoteCopyService {

    @inject(ApplicationPackage)
    protected readonly applicationPackage: ApplicationPackage;

    @inject(RemoteCopyRegistry)
    protected readonly copyRegistry: RemoteCopyRegistry;

    @inject(ContributionProvider) @named(RemoteCopyContribution)
    protected readonly copyContributions: ContributionProvider<RemoteCopyContribution>;

    protected initialized = false;

    async copyToRemote(remote: RemoteConnection, destination: string): Promise<void> {
        const projectPath = this.applicationPackage.projectPath;
        const files = await this.getFiles();
        const fullFiles: RemoteFile[] = files.map(file => ({
            path: path.join(projectPath, file.path),
            target: path.join(destination, file.target),
            options: file.options
        }));
        await Promise.all(fullFiles.map(file => remote.copy(file.path, file.target, file.options)));
    }

    protected async getFiles(): Promise<RemoteFile[]> {
        if (this.initialized) {
            return this.copyRegistry.getFiles();
        }
        await Promise.all(this.copyContributions.getContributions()
            .map(copyContribution => copyContribution.copy(this.copyRegistry)));
        this.initialized = true;
        return this.copyRegistry.getFiles();
    }
}
