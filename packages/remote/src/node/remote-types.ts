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

import type { Client } from 'ssh2';
import { Disposable } from '@theia/core';
import * as net from 'net';
import { Socket } from 'socket.io-client';

export interface ExpressLayer {
    name: string
    regexp: RegExp
    handle: Function
    path?: string
}

export interface RemoteConnection {
    id: string;
    client: Client;
    server: net.Server
}

export interface RemoteSessionOptions {
    id: string;
    port: number;
    onDispose: () => void;
}

export class RemoteSession implements Disposable {

    private onDispose: () => void;

    readonly id: string;
    readonly port: number;

    sockets: Socket[] = [];

    constructor(options: RemoteSessionOptions) {
        this.port = options.port;
        this.id = options.id;
        this.onDispose = this.onDispose;
    }

    dispose(): void {
        for (const socket of this.sockets) {
            socket.close();
        }
        this.onDispose();
    }
}
