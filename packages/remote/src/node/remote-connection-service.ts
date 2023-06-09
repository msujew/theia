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

import { injectable } from '@theia/core/shared/inversify';
import { RemoteConnection } from './remote-types';
import { nanoid } from 'nanoid';
import { Disposable } from '@theia/core';

@injectable()
export class RemoteConnectionService {

    protected readonly connections = new Map<string, RemoteConnection>();

    getConnection(id: string): RemoteConnection | undefined {
        return this.connections.get(id);
    }

    getConnectionId(): string {
        return nanoid(10);
    }

    register(connection: RemoteConnection): Disposable {
        this.connections.set(connection.id, connection);
        return Disposable.create(() => {
            this.connections.delete(connection.id);
        });
    }
}
