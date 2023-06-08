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

import { Command, CommandContribution, CommandRegistry, QuickInputService } from '@theia/core';
import { inject, injectable } from '@theia/core/shared/inversify';
import { RemoteSSHConnectionProvider } from '../common/remote-ssh-connection-provider';

export namespace RemoteSSHCommands {
    export const CONNECT: Command = Command.toLocalizedCommand({
        id: 'remoteSSH.connect',
        category: 'RemoteSSh',
        label: 'Connect to Host...',
    }, 'theia/remoteSSH/connect');
}

@injectable()
export class SSHFrontendContribution implements CommandContribution {

    @inject(QuickInputService)
    protected readonly quickInputService: QuickInputService;

    @inject(RemoteSSHConnectionProvider)
    protected readonly sshConnectionProvider: RemoteSSHConnectionProvider;

    registerCommands(commands: CommandRegistry): void {
        commands.registerCommand(RemoteSSHCommands.CONNECT, {
            execute: async (host?: string, user?: string) => {
                if (!host) {
                    host = await this.requestQuickInput('host');
                    if (host?.includes('@')) {
                        const split = host.split('@');
                        user = split[0];
                        host = split[1];
                    }
                }
                if (!user) {
                    user = await this.requestQuickInput('user');
                }

                const remoteId = await this.sendSSHConnect(host!, user!);
                document.cookie = `remoteId=${remoteId}`;
                window.location.reload();
            }
        });
    }

    async requestQuickInput(prompt: string): Promise<string | undefined> {
        return new Promise<string | undefined>(resolve => {
            const input = this.quickInputService.createInputBox();
            input.prompt = prompt;
            input.onDidAccept(async () => {
                resolve(input.value);
                input.hide();
            });
            input.show();
        });
    }

    async sendSSHConnect(host: string, user: string): Promise<string | undefined> {
        return this.sshConnectionProvider.establishConnection(host, user);
    }
}
