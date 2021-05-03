/********************************************************************************
 * Copyright (C) 2017 Ericsson and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * This Source Code may also be made available under the following Secondary
 * Licenses when the conditions for such availability set forth in the Eclipse
 * Public License v. 2.0 are satisfied: GNU General Public License, version 2
 * with the GNU Classpath Exception which is available at
 * https://www.gnu.org/software/classpath/license.html.
 *
 * SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
 ********************************************************************************/
import * as chai from 'chai';
import { createTerminalTestContainer } from './test/terminal-test-container';
import { IShellTerminalEnvironment, IShellTerminalServer } from '../common/shell-terminal-protocol';
import { EnvironmentVariableMutatorType, ExtensionOwnedEnvironmentVariableMutator } from '../common/base-terminal-protocol';

/**
 * Globals
 */

const expect = chai.expect;

describe('ShellServer', function (): void {

    this.timeout(5000);
    let shellTerminalServer: IShellTerminalServer;

    beforeEach(() => {
        shellTerminalServer = createTerminalTestContainer().get(IShellTerminalServer);
    });

    it('test shell terminal create', async function (): Promise<void> {
        const createResult = shellTerminalServer.create({});

        expect(await createResult).to.be.greaterThan(-1);
    });

    it('test shell terminal create with merged passed env', async function (): Promise<void> {
        const env = { modified: 'y', replace: 'x' };
        const map = <Map<string, ExtensionOwnedEnvironmentVariableMutator[]>>shellTerminalServer.mergedCollection.map;
        map.set('modified', [
            {
                extensionIdentifier: 'test',
                type: EnvironmentVariableMutatorType.Prepend,
                value: 'x:'
            },
            {
                extensionIdentifier: 'test',
                type: EnvironmentVariableMutatorType.Append,
                value: ':z'
            }
        ]);
        map.set('replace', [{
            extensionIdentifier: 'test',
            type: EnvironmentVariableMutatorType.Replace,
            value: 'y'
        }]);
        await shellTerminalServer.create({ env });
        expect(env.modified).to.equal('x:y:z');
        expect(env.replace).to.equal('y');
    });

    it('test shell terminal create with merged process env', async function (): Promise<void> {
        const path = process.env['PATH']!;
        const env: IShellTerminalEnvironment = {};
        const prepend = 'prepend:';
        const map = <Map<string, ExtensionOwnedEnvironmentVariableMutator[]>>shellTerminalServer.mergedCollection.map;
        map.set('PATH', [{
            extensionIdentifier: 'test',
            type: EnvironmentVariableMutatorType.Prepend,
            value: prepend
        }]);
        await shellTerminalServer.create({ env });
        expect(env.PATH).to.satisfy((p: string) => p.startsWith(prepend));
        expect(env.PATH?.substring(prepend.length)).to.equal(path);
    });
});
