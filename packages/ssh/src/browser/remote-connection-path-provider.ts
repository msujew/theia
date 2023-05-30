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

import { WebSocketConnectionPathProvider } from '@theia/core/lib/browser';
import { injectable } from '@theia/core/shared/inversify';
import { nanoid } from 'nanoid';

@injectable()
export class RemoteWebSocketConnectionPathProvider extends WebSocketConnectionPathProvider {

    protected remoteId = this.getRemoteId();
    protected sessionId = nanoid(10);

    override getConnectionPath(connectionPath: string): string {
        if (this.remoteId) {
            return `/remote/${this.remoteId}/${this.sessionId}${connectionPath}`;
        } else {
            return super.getConnectionPath(connectionPath);
        }
    }

    protected getRemoteId(): string | undefined {
        const remoteId = new URL(window.location.href).searchParams.get('remote') || undefined;
        if (remoteId) {
            document.cookie = `remoteId=${remoteId}`;
        }
        return remoteId;
    }

}
