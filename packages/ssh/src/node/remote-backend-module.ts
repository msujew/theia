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

import { ContainerModule } from '@theia/core/shared/inversify';
import { BackendApplicationContribution } from '@theia/core/lib/node';
import { RemoteBackenApplicationContribution } from './remote-backend-application-contribution';
import { RemoteConnectionService } from './remote-connection-service';
import { RemoteProxyServerProvider } from './remote-proxy-server-provider';
import { RemoteMessagingListenerContribution } from './remote-messaging-listener';
import { MessagingListenerContribution } from '@theia/core/lib/node/messaging/messaging-listeners';
import { RemoteProxySocketProvider } from './remote-proxy-socket-provider';
import { RemoteSessionService } from './remote-session-service';

export default new ContainerModule(bind => {
    bind(RemoteProxyServerProvider).toSelf().inSingletonScope();
    bind(RemoteProxySocketProvider).toSelf().inSingletonScope();
    bind(RemoteSessionService).toSelf().inSingletonScope();
    bind(RemoteConnectionService).toSelf().inSingletonScope();
    bind(RemoteBackenApplicationContribution).toSelf().inSingletonScope();
    bind(BackendApplicationContribution).to(RemoteBackenApplicationContribution);

    bind(RemoteMessagingListenerContribution).toSelf().inSingletonScope();
    bind(MessagingListenerContribution).toService(RemoteMessagingListenerContribution);
});
