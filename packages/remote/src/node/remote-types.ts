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

import { Disposable, Emitter, Event } from '@theia/core';
import * as net from 'net';

export interface ExpressLayer {
    name: string
    regexp: RegExp
    handle: Function
    path?: string
}

export interface RemoteConnection extends Disposable {
    id: string;
    server: net.Server;
    onDidDisconnect: Event<void>;
    forwardOut(socket: net.Socket): void;
}

export interface RemoteSessionOptions {
    id: string;
    port: number;
}

export class RemoteSession implements Disposable {

    readonly id: string;
    readonly port: number;

    private readonly onDidRemoteDisconnectEmitter = new Emitter<void>();
    private readonly onDidSocketDisconnectEmitter = new Emitter<void>();

    get onDidRemoteDisconnect(): Event<void> {
        return this.onDidRemoteDisconnectEmitter.event;
    }

    get onDidSocketDisconnect(): Event<void> {
        return this.onDidSocketDisconnectEmitter.event;
    }

    constructor(options: RemoteSessionOptions) {
        this.port = options.port;
        this.id = options.id;
    }

    disconnect(): void {
        this.onDidRemoteDisconnectEmitter.fire();
    }

    dispose(): void {
        this.onDidSocketDisconnectEmitter.fire();
    }
}