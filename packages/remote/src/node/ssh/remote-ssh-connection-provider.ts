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

import * as fs from '@theia/core/shared/fs-extra';
import { Emitter, Event, QuickInputService } from '@theia/core';
import { inject, injectable } from '@theia/core/shared/inversify';
import { RemoteSSHConnectionProvider } from '../../common/remote-ssh-connection-provider';
import { RemoteExpressProxyContribution } from '../remote-express-proxy-contribution';
import { RemoteConnectionService } from '../remote-connection-service';
import { RemoteProxyServerProvider } from '../remote-proxy-server-provider';
import { RemoteConnection } from '../remote-types';
import * as ssh2 from 'ssh2';
import * as net from 'net';
import { Deferred } from '@theia/core/lib/common/promise-util';
import { SSHIdentityFileCollector, SSHKey } from './ssh-identity-file-collector';

@injectable()
export class RemoteSSHConnectionProviderImpl implements RemoteSSHConnectionProvider {

    @inject(RemoteConnectionService)
    protected readonly remoteConnectionService: RemoteConnectionService;

    @inject(RemoteProxyServerProvider)
    protected readonly serverProvider: RemoteProxyServerProvider;

    @inject(SSHIdentityFileCollector)
    protected readonly identityFileCollector: SSHIdentityFileCollector;

    @inject(RemoteExpressProxyContribution)
    protected readonly remoteBackenApplicationContribution: RemoteExpressProxyContribution;

    @inject(QuickInputService)
    protected readonly quickInputService: QuickInputService;

    protected passwordRetryCount = 3;
    protected passphraseRetryCount = 3;

    async establishConnection(host: string, user: string): Promise<string> {
        const remote = await this.establishSSHConnection(host, user);
        this.remoteConnectionService.register(remote);
        this.remoteBackenApplicationContribution.setupProxyRouter(remote);
        return remote.id;
    }

    async establishSSHConnection(host: string, user: string): Promise<RemoteConnection> {
        const deferred = new Deferred<RemoteConnection>();
        const sessionId = this.remoteConnectionService.getConnectionId();
        const sshClient = new ssh2.Client();
        const identityFiles = await this.identityFileCollector.gatherIdentityFiles();
        const sshAuthHandler = this.getAuthHandler(user, host, identityFiles);
        sshClient
            .on('ready', async () => {
                console.log('Connected to ssh host');
                const server = await this.serverProvider.getProxyServer(socket => {
                    connection.forwardOut(socket);
                });
                const connection = new RemoteSSHConnection({
                    client: sshClient,
                    id: sessionId,
                    server
                });
                deferred.resolve(connection);
            }).on('error', err => {
                deferred.reject(err);
            }).connect({
                debug: mes => console.log(mes),
                host: host,
                username: user,
                authHandler: (methodsLeft, successes, callback) => (sshAuthHandler(methodsLeft, successes, callback), undefined)
            });
        return deferred.promise;
    }

    protected getAuthHandler(user: string, host: string, identityKeys: SSHKey[]): ssh2.AuthHandlerMiddleware {
        let passwordRetryCount = this.passwordRetryCount;
        let keyboardRetryCount = this.passphraseRetryCount;
        // `false` is a valid return value, indicating that the authentication has failed
        const END_AUTH = false as unknown as ssh2.AuthenticationType;
        // `null` indicates that we just want to continue with the next auth type
        // eslint-disable-next-line no-null/no-null
        const NEXT_AUTH = null as unknown as ssh2.AuthenticationType;
        return async (methodsLeft: string[] | null, _partialSuccess: boolean | null, callback: ssh2.NextAuthHandler) => {
            if (!methodsLeft) {
                console.log('Trying no-auth authentication');

                return callback({
                    type: 'none',
                    username: user,
                });
            }
            if (methodsLeft && methodsLeft.includes('publickey') && identityKeys.length) {
                const identityKey = identityKeys.shift()!;
                console.log(`Trying publickey authentication: ${identityKey.filename} ${identityKey.parsedKey.type} SHA256:${identityKey.fingerprint}`);

                if (identityKey.isPrivate) {
                    return callback({
                        type: 'publickey',
                        username: user,
                        key: identityKey.parsedKey
                    });
                }
                if (!await fs.pathExists(identityKey.filename)) {
                    // Try next identity file
                    return callback(NEXT_AUTH);
                }

                const keyBuffer = await fs.promises.readFile(identityKey.filename);
                let result = ssh2.utils.parseKey(keyBuffer); // First try without passphrase
                if (result instanceof Error && result.message === 'Encrypted private OpenSSH key detected, but no passphrase given') {
                    let passphraseRetryCount = this.passphraseRetryCount;
                    while (result instanceof Error && passphraseRetryCount > 0) {
                        const passphrase = await this.quickInputService.input({
                            title: `Enter passphrase for ${identityKey.filename}`,
                            password: true
                        });
                        if (!passphrase) {
                            break;
                        }
                        result = ssh2.utils.parseKey(keyBuffer, passphrase);
                        passphraseRetryCount--;
                    }
                }
                if (!result || result instanceof Error) {
                    // Try next identity file
                    return callback(NEXT_AUTH);
                }

                const key = Array.isArray(result) ? result[0] : result;
                return callback({
                    type: 'publickey',
                    username: user,
                    key
                });
            }
            if (methodsLeft && methodsLeft.includes('password') && passwordRetryCount > 0) {
                if (passwordRetryCount === this.passwordRetryCount) {
                    console.log('Trying password authentication');
                }

                const password = await this.quickInputService.input({
                    title: `Enter password for ${user}@${host}`,
                    password: true
                });
                passwordRetryCount--;

                return callback(password
                    ? {
                        type: 'password',
                        username: user,
                        password
                    }
                    : END_AUTH);
            }
            if (methodsLeft && methodsLeft.includes('keyboard-interactive') && keyboardRetryCount > 0) {
                if (keyboardRetryCount === this.passwordRetryCount) {
                    console.log('Trying keyboard-interactive authentication');
                }

                return callback({
                    type: 'keyboard-interactive',
                    username: user,
                    prompt: async (_name, _instructions, _instructionsLang, prompts, finish) => {
                        const responses: string[] = [];
                        for (const prompt of prompts) {
                            const response = await this.quickInputService.input({
                                title: `(${user}@${host}) ${prompt.prompt}`,
                                password: !prompt.echo
                            });
                            if (response === undefined) {
                                keyboardRetryCount = 0;
                                break;
                            }
                            responses.push(response);
                        }
                        keyboardRetryCount--;
                        finish(responses);
                    }
                });
            }

            callback(END_AUTH);
        };
    }

    isConnectionAlive(remoteId: string): Promise<boolean> {
        return Promise.resolve(Boolean(this.remoteConnectionService.getConnection(remoteId)));
    }

}

export interface RemoteSSHConnectionOptions {
    id: string;
    client: ssh2.Client;
    server: net.Server;
}

export class RemoteSSHConnection implements RemoteConnection {

    id: string;
    client: ssh2.Client;
    server: net.Server;

    private readonly onDidDisconnectEmitter = new Emitter<void>();

    get onDidDisconnect(): Event<void> {
        return this.onDidDisconnectEmitter.event;
    }

    constructor(options: RemoteSSHConnectionOptions) {
        this.id = options.id;
        this.client = options.client;
        this.server = options.server;
        this.onDidDisconnect(() => this.dispose());
        this.client.on('end', () => {
            this.onDidDisconnectEmitter.fire();
        });
    }

    forwardOut(socket: net.Socket): void {
        this.client.forwardOut(socket.localAddress!, socket.localPort!, '127.0.0.1', 3000, (err, stream) => {
            if (err) {
                console.debug('Proxy message rejected', err);
            } else {
                stream.pipe(socket).pipe(stream);
            }
        });
    }

    dispose(): void {
        this.server.close();
        this.client.destroy();
    }

}