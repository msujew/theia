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
import { ConnectionInfo } from '../common/dto';
import { injectable } from '@theia/core/shared/inversify';
import { Disposable, Emitter } from '@theia/core/shared/vscode-languageserver-protocol';
import { AddressInfo, createServer } from 'net';
import { io, Socket } from 'socket.io-client';
import { WebSocketChannel } from '@theia/core/lib/common/messaging/web-socket-channel';

@injectable()
export class SSHConnectorService implements Disposable {

    private client?: Client;

    private proxyClient: Socket;

    private readonly sshConnectionEstablishedEmitter = new Emitter<Socket>();
    readonly onSSHConnectionEstablished = this.sshConnectionEstablishedEmitter.event;

    isOpen(): boolean {
        return !!this.client;
    }

    async connect(connectionInfo: ConnectionInfo): Promise<void> {
        const sshClient = new Client();
        const key = await fs.promises.readFile(os.homedir() + '/.ssh/id_rsa');
        return new Promise(async (resolve, reject) => {
            sshClient
            .on('ready', () => {
                this.client = sshClient;
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
                    const port = (proxy.address() as AddressInfo).port;
                    console.log('ssh proxy started on ' + port);
                    this.proxyClient = io(`ws://localhost:${port}${WebSocketChannel.wsPath}`, { autoConnect: false });
                    this.sshConnectionEstablishedEmitter.fire(this.proxyClient);
                    resolve();
                });
                resolve();
            }).on('keyboard-interactive', (name, instructions, lang, prompts, finish) => {
                console.log(`keybord request ${name} ${instructions} ${lang}`);
            }).on('close', () => {
                this.client = undefined;
            }).on('error', err => {
                reject(err);
            }).connect({
                debug: mes => console.log(mes),
                host: connectionInfo.host,
                username: connectionInfo.user,
                tryKeyboard: true,
                authHandler: ['publickey', 'keyboard-interactive'],
                privateKey: key,
                passphrase: await this.getPassphrase(key),
            });
        });
    }

    private async getPassphrase(key: Buffer): Promise<string | undefined> {
        const parsedKey = utils.parseKey(key);
        if (parsedKey instanceof Error && parsedKey.message.includes('no passphrase given')) {
            // somehow get the passphrase
            return '';
        }
        return undefined;
    }

    dispose(): void {
        this.client?.end();
        this.proxyClient?.close();
        this.sshConnectionEstablishedEmitter.dispose();
    }
}
