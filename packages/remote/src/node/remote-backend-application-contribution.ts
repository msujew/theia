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
import { ExpressLayer, RemoteConnection } from './remote-types';
import { AddressInfo } from 'net';
import expressHttpProxy = require('express-http-proxy');

@injectable()
export class RemoteBackenApplicationContribution implements BackendApplicationContribution {

    @inject(RemoteConnectionService)
    protected readonly remoteConnectionService: RemoteConnectionService;

    @inject(MessagingContribution)
    protected readonly messagingService: MessagingService;

    configure(app: express.Application): void {
        app.post('/ssh/connect', express.json(), async (req, res) => {
            try {
                const remote = await this.remoteConnectionService.connect(req.body as RemoteConnectionInfo);
                await this.setupProxyRouter(app, remote);
                res.status(200).send(remote.id);
            } catch (err) {
                res.status(500).send('could not connect to host');
            }
        });
        this.spliceRouter(app, router => router.name === 'serveStatic', router => router.path === '/ssh/connect');
    }

    protected async setupProxyRouter(app: express.Application, remote: RemoteConnection): Promise<void> {
        const port = (remote.server.address() as AddressInfo).port.toString();
        const handleProxy = expressHttpProxy(`http://localhost:${port}`, {
            filter: req => {
                const cookies = this.getCookies(req);
                const remoteId = cookies.remoteId;
                return remoteId === remote.id;
            }
        });
        app.use(handleProxy);
        this.spliceRouter(app, router => router.path === '/ssh/connect', router => router.handle === handleProxy);
        console.log('Routes!!!', app._router);
    }

    protected spliceRouter(app: express.Application, after: (router: ExpressLayer) => boolean, predicate: (router: ExpressLayer) => boolean): void {
        const routerStack: ExpressLayer[] = app._router.stack;
        const routerIndex = routerStack.findIndex(predicate);
        if (routerIndex >= 0) {
            const index = routerStack.findIndex(after);
            routerStack.splice(index + 1, 0, routerStack[routerIndex]);
            routerStack.splice(routerIndex + 1, 1);
        }
    }

    protected getCookies(request: express.Request): Record<string, string> {
        const cookieHeader = request.headers.cookie;
        const record: Record<string, string> = {};
        if (cookieHeader) {
            const cookies = cookieHeader.split('; ');
            for (const cookie of cookies) {
                const index = cookie.indexOf('=');
                const name = cookie.substring(0, index);
                const value = cookie.substring(index + 1);
                record[name] = value;
            }
        }
        return record;
    }
}
