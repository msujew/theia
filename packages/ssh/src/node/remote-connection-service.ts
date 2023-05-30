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
import { inject, injectable } from '@theia/core/shared/inversify';
import { RemoteConnection } from './remote-types';
import { v4 } from 'uuid';
import { RemoteProxyServerProvider } from './remote-proxy-server-provider';

@injectable()
export class RemoteConnectionService {

    @inject(RemoteProxyServerProvider)
    protected readonly serverProvider: RemoteProxyServerProvider;

    protected readonly connections = new Map<string, RemoteConnection>();

    getConnection(id: string): RemoteConnection | undefined {
        return this.connections.get(id);
    }

    async connect(connectionInfo: RemoteConnectionInfo): Promise<string> {
        const sessionId = v4();
        const sshClient = new Client();
        const key = await fs.promises.readFile(os.homedir() + '/.ssh/id_rsa');
        return new Promise(async (resolve, reject) => {
            sshClient
                .on('ready', async () => {
                    const server = await this.serverProvider.getProxyServer(sshClient);
                    this.connections.set(sessionId, {
                        client: sshClient,
                        id: sessionId,
                        server
                    });
                    resolve(sessionId);
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
}
