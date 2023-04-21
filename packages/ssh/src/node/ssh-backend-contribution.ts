import { Command, CommandContribution, CommandRegistry } from '@theia/core';
import { injectable } from '@theia/core/shared/inversify';

export namespace RemoteSSHCommands {
    export const CONNECT: Command = Command.toLocalizedCommand({
        id: 'remoteSSH.connect',
        category: 'RemoteSSh',
        label: 'Connect to Host...',
    }, 'theia/remoteSSH/connect');
}

@injectable()
export class SSHBackendContribution implements CommandContribution {

    registerCommands(commands: CommandRegistry): void {
        commands.registerCommand(RemoteSSHCommands.CONNECT, { execute: (host: string) => { } });
    }

}
