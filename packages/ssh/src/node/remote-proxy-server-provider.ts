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

import { Deferred } from '@theia/core/lib/common/promise-util';
import { injectable } from '@theia/core/shared/inversify';
import type { Client } from 'ssh2';
import * as net from 'net';

@injectable()
export class RemoteProxyServerProvider {

    async getProxyServer(client: Client): Promise<net.Server> {
        const deferred = new Deferred();

        const proxy = net.createServer(socket => {
            client.forwardOut(socket.localAddress!, socket.localPort!, '127.0.0.1', 3000, (err, stream) => {
                if (err) {
                    console.debug('Proxy message rejected', err);
                } else {
                    stream.pipe(socket).pipe(stream);
                }
            });
        }).listen(0, () => {
            deferred.resolve();
        });

        await deferred.promise;
        return proxy;
    }

}
