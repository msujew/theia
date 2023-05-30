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

import { MessagingListenerContribution } from '@theia/core/lib/node/messaging/messaging-listeners';
import { inject, injectable } from '@theia/core/shared/inversify';
import { MessagingContribution } from '@theia/core/lib/node/messaging/messaging-contribution';
import { MessagingService } from '@theia/core/lib/node/messaging/messaging-service';
import * as http from 'http';
import { Socket } from 'socket.io';
import { RemoteSessionService } from './remote-session-service';
import { RemoteProxySocketProvider } from './remote-proxy-socket-provider';

@injectable()
export class RemoteMessagingListenerContribution implements MessagingListenerContribution {

    @inject(RemoteSessionService)
    protected readonly sessionService: RemoteSessionService;

    @inject(RemoteProxySocketProvider)
    protected readonly socketProvider: RemoteProxySocketProvider;

    @inject(MessagingContribution)
    protected readonly messagingService: MessagingService;

    protected namespaceRegex = /^\/remote\/([^/]+)\/([^/]+)(\/.*)$/;

    async onDidWebSocketUpgrade(_request: http.IncomingMessage, incomingSocket: Socket): Promise<void> {
        const namespace = incomingSocket.nsp.name;
        const regexMatches = this.namespaceRegex.exec(namespace);
        if (regexMatches) {
            const remoteId = regexMatches[1];
            const sessionId = regexMatches[2];
            const path = regexMatches[3];
            const proxySession = await this.sessionService.getOrCreateProxySession({
                remote: remoteId,
                session: sessionId
            });
            const proxySocket = this.socketProvider.getProxySocket({
                port: proxySession.port,
                path
            });
            incomingSocket.addListener('disconnect', () => {
                proxySocket.close();
            });
            this.messagingService.ws(namespace, (_params, socket) => {
                if (!proxySocket.connected) {
                    proxySocket.connect();
                }
                proxySocket.onAny((event, ...args) => {
                    socket.emit(event, ...args);
                });
                socket.onAny((event, ...args) => {
                    proxySocket.emit(event, ...args);
                });
            });
        }

    }
}
