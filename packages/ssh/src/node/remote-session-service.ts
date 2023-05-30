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

import * as fs from 'fs';
import * as os from 'os';
import { Client, utils } from 'ssh2';
import { RemoteConnectionInfo } from '../common/remote-types';
import { injectable } from '@theia/core/shared/inversify';
import { Disposable, DisposableCollection } from '@theia/core';
import { AddressInfo, createServer } from 'net';
import { io, Socket } from 'socket.io-client';
import { WebSocketChannel } from '@theia/core/lib/common/messaging/web-socket-channel';

@injectable()
export class RemoteSessionService implements Disposable {

    protected readonly disposables = new DisposableCollection();

    async connect(connectionInfo: RemoteConnectionInfo): Promise<Socket> {
        const sshClient = new Client();

        this.disposables.push(Disposable.create(() => sshClient.end()));
        const key = await fs.promises.readFile(os.homedir() + '/.ssh/id_rsa');
        return new Promise(async (resolve, reject) => {
            sshClient
                .on('ready', () => {
                    const proxy = createServer(socket => {
                        sshClient.forwardOut('127.0.0.1', socket.localPort!, '127.0.0.1', 3000, (err, stream) => {
                            if (err) {
                                console.error(err);
                                reject(err);
                            } else {
                                stream.pipe(socket).pipe(stream);
                            }
                        });
                    }).listen(0, () => {
                        const localPort = (proxy.address() as AddressInfo).port;
                        console.log('ssh proxy started on ' + localPort);
                        const proxySocket = io(`ws://localhost:${localPort}${WebSocketChannel.wsPath}`, { autoConnect: false });
                        this.disposables.push(Disposable.create(() => proxySocket.close()));
                        resolve(proxySocket);
                    });
                    /* .on('keyboard-interactive', (name, instructions, lang, prompts, finish) => {
                   console.log(`keybord request ${name} ${instructions} ${lang}`);
                   }) */
                }).on('error', err => {
                    reject(err);
                }).connect({
                    debug: mes => console.debug(mes),
                    host: connectionInfo.host,
                    username: connectionInfo.user,
                    tryKeyboard: true,
                    authHandler: ['publickey', 'keyboard-interactive'],
                    privateKey: key,
                    passphrase: await this.getPassphrase(key),
                });
        });
    }

    protected async getPassphrase(key: Buffer): Promise<string | undefined> {
        const parsedKey = utils.parseKey(key);
        if (parsedKey instanceof Error && parsedKey.message.includes('no passphrase given')) {
            // somehow get the passphrase
            return '';
        }
        return undefined;
    }

    dispose(): void {
        this.disposables.dispose();
    }
}
