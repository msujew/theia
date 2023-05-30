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
import { Endpoint, WebSocketConnectionProvider } from '@theia/core/lib/browser';
import { inject, injectable } from '@theia/core/shared/inversify';

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

    @inject(WebSocketConnectionProvider)
    protected readonly webSocketConnectionProvider: WebSocketConnectionProvider;

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

                const channel = await this.sendSSHConnect(host!, user!);

                window.location.replace(`http://localhost:3000/?remote=${channel}`);
            }
        });
    }

    async requestQuickInput(prompt: string): Promise<string | undefined> {
        return new Promise<string | undefined>((resolve, reject) => {
            const input = this.quickInputService.createInputBox();
            input.prompt = prompt;
            input.onDidAccept(async () => {
                resolve(input.value);
            });
            input.show();
        });
    }

    async sendSSHConnect(host: string, user: string): Promise<string | undefined> {
        const response = await fetch(new Endpoint({ path: '/ssh/connect' }).getRestUrl().toString(), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ host, user })
        });
        if (response.status === 200) {
            return response.text();
        } else {
            return undefined;
        }
    }
}
