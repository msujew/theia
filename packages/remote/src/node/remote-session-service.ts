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

import { inject, injectable } from '@theia/core/shared/inversify';
import * as net from 'net';
import { v4 } from 'uuid';
import { RemoteConnectionService } from './remote-connection-service';
import { RemoteProxyServerProvider } from './remote-proxy-server-provider';
import { RemoteSession } from './remote-types';

export interface RemoteProxySessionOptions {
    remote: string;
}

@injectable()
export class RemoteSessionService {

    @inject(RemoteConnectionService)
    protected readonly connectionService: RemoteConnectionService;

    @inject(RemoteProxyServerProvider)
    protected readonly serverProvider: RemoteProxyServerProvider;

    protected readonly sessions = new Map<string, RemoteSession>();

    async getOrCreateProxySession(options: RemoteProxySessionOptions): Promise<RemoteSession> {
        const connection = this.connectionService.getConnection(options.remote);
        if (!connection) {
            throw new Error('No remote connection found for id ' + options.remote);
        }
        const server = await this.serverProvider.getProxyServer(socket => connection.forwardOut(socket));
        const port = (server.address() as net.AddressInfo).port;
        const sessionId = v4();
        const session = new RemoteSession({
            id: sessionId,
            port
        });
        // When the frontend socket disconnects, close the server and delete the session
        session.onDidSocketDisconnect(() => {
            server.close();
            this.sessions.delete(sessionId);
        });
        connection.onDidDisconnect(() => {
            session?.disconnect();
        });
        this.sessions.set(sessionId, session);
        return session;
    }

}
