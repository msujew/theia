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
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
// *****************************************************************************

import * as express from '@theia/core/shared/express';
// import * as http from 'http';
import { BackendApplicationContribution } from '@theia/core/lib/node';
import { inject, injectable } from '@theia/core/shared/inversify';
import { SSHConnectorService } from './ssh-connector-service';
import { ConnectionInfo } from '../common/dto';

@injectable()
export class SSHBackenApplicationContribution implements BackendApplicationContribution {

    @inject(SSHConnectorService)
    protected readonly sshConnectorService: SSHConnectorService;

    configure(app: express.Application): void {
        app.post('/ssh/connect', express.json(), async (req, resp) => {
            try {
                await this.sshConnectorService.connect(req.body as ConnectionInfo);
                resp.status(200).send('ok');
            } catch (err) {
                resp.status(500).send('could not connect to host');
            }
        });
    }
}
