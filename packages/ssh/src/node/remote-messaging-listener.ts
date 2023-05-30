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

// import { MaybePromise } from '@theia/core';
// import { MessagingListenerContribution } from '@theia/core/lib/node/messaging/messaging-listeners';
// import { inject, injectable } from '@theia/core/shared/inversify';
// import { MessagingContribution } from '@theia/core/lib/node/messaging/messaging-contribution';
// import { MessagingService } from '@theia/core/lib/node/messaging/messaging-service';
// import * as http from 'http';
// import { Socket } from 'socket.io';
//
// @injectable()
// export class RemoteMessagingListenerContribution implements MessagingListenerContribution {
//
//     @inject(MessagingContribution)
//     protected readonly messagingService: MessagingService;
//
//     onDidWebSocketUpgrade(_request: http.IncomingMessage, incomingSocket: Socket): MaybePromise<void> {
//         const namespace = incomingSocket.nsp;
//         if (/x/.test(namespace.name)) {
//             this.messagingService.ws(namespace.name, (_params, socket) => {
//                 if (!proxySocket.connected) {
//                     proxySocket.connect();
//                 }
//                 proxySocket.onAny((event, ...args) => {
//                     socket.emit(event, ...args);
//                 });
//                 socket.onAny((event, ...args) => {
//                     proxySocket.emit(event, ...args);
//                 });
//             });
//         }
//
//     }
// }
