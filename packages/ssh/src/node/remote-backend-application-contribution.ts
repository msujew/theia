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
import { BackendApplicationContribution, MessagingService } from '@theia/core/lib/node';
import { MessagingContribution } from '@theia/core/lib/node/messaging/messaging-contribution';
import { inject, injectable } from '@theia/core/shared/inversify';
import { RemoteConnectionService } from './remote-connection-service';
import { RemoteConnectionInfo } from '../common/remote-types';

@injectable()
export class RemoteBackenApplicationContribution implements BackendApplicationContribution {

    @inject(RemoteConnectionService)
    protected readonly remoteConnectionService: RemoteConnectionService;

    @inject(MessagingContribution)
    protected readonly messagingService: MessagingService;

    configure(app: express.Application): void {
        app.post('/ssh/connect', express.json(), async (req, resp) => {
            try {
                // TODO: return a string here that gets associated to the proxy
                // When a frontend requests a ssh connection for this proxy, generate a new websocket channel (+proxy server) that proxies all the data
                // The websocket channel only lives in the scope of the user connection and gets deleted afterwards
                const remoteId = await this.remoteConnectionService.connect(req.body as RemoteConnectionInfo);
                resp.status(200).send(remoteId);
            } catch (err) {
                resp.status(500).send('could not connect to host');
            }
        });
    }
}
