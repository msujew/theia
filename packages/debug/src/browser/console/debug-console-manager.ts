/********************************************************************************
 * Copyright (C) 2021 TypeFox and others.
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

import { inject, injectable, postConstruct } from '@theia/core/shared/inversify';
import { Emitter, Disposable, DisposableCollection } from '@theia/core';
import { DebugSession } from '../debug-session';
import { DebugSessionManager } from '../debug-session-manager';

@injectable()
export class DebugConsoleManager implements Disposable {

    @inject(DebugSessionManager)
    protected readonly debugSessionManager: DebugSessionManager;

    protected readonly sessions = new Map<string, DebugSession>();
    protected _selectedSession: DebugSession | undefined;

    protected readonly sessionAddedEmitter = new Emitter<DebugSession>();
    protected readonly sessionDeletedEmitter = new Emitter<DebugSession>();
    protected readonly sessionWasShownEmitter = new Emitter<DebugSession>();
    protected readonly sessionWasHiddenEmitter = new Emitter<DebugSession>();
    protected readonly selectedSessionChangedEmitter = new Emitter<DebugSession | undefined>();

    readonly onSessionAdded = this.sessionAddedEmitter.event;
    readonly onSessionDeleted = this.sessionDeletedEmitter.event;
    readonly onSessionWasShown = this.sessionWasShownEmitter.event;
    readonly onSessionWasHidden = this.sessionWasHiddenEmitter.event;
    readonly onSelectedSessionChanged = this.selectedSessionChangedEmitter.event;

    protected readonly toDispose = new DisposableCollection();
    protected readonly toDisposeOnSessionDeletion = new Map<string, Disposable>();

    @postConstruct()
    protected init(): void {
        this.toDispose.pushAll([
            this.debugSessionManager.onDidCreateDebugSession(session => {
                this.add(session);
            }),
            this.debugSessionManager.onDidDestroyDebugSession(session => {
                this.delete(session);
            })
        ]);
    }

    dispose(): void {
        this.toDispose.dispose();
    }

    get all(): DebugSession[] {
        return Array.from(this.sessions.values());
    }

    get selectedSession(): DebugSession | undefined {
        return this._selectedSession;
    }

    set selectedSession(session: DebugSession | undefined) {
        this._selectedSession = session;
        if (this._selectedSession) {
            this.selectedSessionChangedEmitter.fire(session);
        } else {
            this.selectedSessionChangedEmitter.fire(undefined);
        }
    }

    get(id: string): DebugSession | undefined {
        return this.sessions.get(id);
    }

    add(session: DebugSession): void {
        this.sessions.set(session.id, session);
        this.sessionAddedEmitter.fire(session);
    }

    delete(session: DebugSession): void {
        if (this.sessions.delete(session.id)) {
            this.sessionDeletedEmitter.fire(session);
        }
    }

}
