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

import { MessagingService } from '@theia/core/lib/node';
import { inject, injectable } from '@theia/core/shared/inversify';
import { Socket } from 'socket.io-client';
import { SSHConnectorService } from './ssh-connector-service';

@injectable()
export class SSHProxyChannel implements MessagingService.Contribution {

    @inject(SSHConnectorService)
    protected readonly sshConnectorService: SSHConnectorService;

    private proxySocket: Socket;

    configure(service: MessagingService): void {
        this.sshConnectorService.onSSHConnectionEstablished(proxySocket => {
            this.proxySocket = proxySocket;
        });
        service.ws('/ssh-services', (params, socket) => {
            if (this.proxySocket) {
                if (!this.proxySocket.connected) {
                    this.proxySocket.connect();
                }
                this.proxySocket.onAny((event, ...args) => {
                    socket.emit(event, ...args);
                });
                socket.onAny((event, ...args) => {
                    this.proxySocket.emit(event, ...args);
                });
            }
        });
    }

}
