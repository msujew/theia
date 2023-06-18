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

import { CliContribution } from '@theia/core/lib/node';
import { injectable, inject } from '@theia/core/shared/inversify';
import { Arguments, Argv } from '@theia/core/shared/yargs';
import { ElectronWsOriginValidator } from '@theia/core/lib/electron-node/hosting/electron-ws-origin-validator';

export const REMOTE_START = 'remote';

@injectable()
export class RemoteCliContribution implements CliContribution {

    @inject(ElectronWsOriginValidator)
    protected readonly wsOriginValidator: ElectronWsOriginValidator;

    configure(conf: Argv): void {
        conf.option(REMOTE_START, {
            description: 'Starts the server as an endpoint for a remote connection (i.e. through SSH)',
            type: 'boolean',
            default: false
        });
    }

    setArguments(args: Arguments): void {
        const remote = args[REMOTE_START];
        if (remote) {
            this.wsOriginValidator.enabled = false;
        }
    }

}
