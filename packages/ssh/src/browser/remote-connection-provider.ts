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

import { WebSocketConnectionProvider } from '@theia/core/lib/browser';
import { injectable } from '@theia/core/shared/inversify';

@injectable()
export class RemoteWebSocketConnectionProvider extends WebSocketConnectionProvider {

    protected override init(): void {
        const remoteId = new URL(window.location.href).searchParams.get('remote');
        if (remoteId) {
            document.cookie = `remoteId=${remoteId}`;
            this.connect('/' + remoteId);
        } else {
            super.init();
        }
    }

}
