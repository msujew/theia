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

import * as fs from 'fs';

const nlsJson = process.env['VSCODE_NLS_CONFIG']!;
export const languageId: string = JSON.parse(nlsJson).locale;

/**
 *
 */
export function loadMessageBundle(fileName: string): (index: number, value: null, ...args: string[]) => string {
    const nlsFileName = getNlsFileName(fileName);
    let nlsFile: string;
    try {
        nlsFile = fs.readFileSync(nlsFileName.file, { encoding: 'utf8' });
    } catch {
        nlsFile = fs.readFileSync(nlsFileName.defaultFile, { encoding: 'utf8' });
    }

    const messages = JSON.parse(nlsFile) as string[];
    return (index, _, ...args) => localize(messages, index, args);
}

export function config(): (fileName: string) => (index: number, value: null, ...args: string[]) => string {
    return loadMessageBundle;
}

export enum MessageFormat {
    file = 'file',
    bundle = 'bundle',
    both = 'both'
}

function localize(messages: string[], index: number, args: string[]): string {
    return format(messages[index], args);
}

function format(message: string, args: string[]): string {
    let result = message;
    if (args.length > 0) {
        result = message.replace(/\{(\d+)\}/g, (match, rest) => {
            const index = rest[0];
            const arg = args[index];
            let replacement = match;
            if (typeof arg === 'string') {
                replacement = arg;
            } else if (typeof arg === 'number' || typeof arg === 'boolean' || !arg) {
                replacement = String(arg);
            }
            return replacement;
        });
    }
    return result;
}

function getNlsFileName(fileName: string): { file: string, defaultFile: string } {
    let suffix = '';
    if (languageId && languageId !== 'en') {
        suffix = '.' + languageId;
    }
    const fileWithoutExtension = fileName.substring(0, fileName.lastIndexOf('.'));
    const file = fileWithoutExtension + '.nls' + suffix + '.json';
    const defaultFile = fileWithoutExtension + '.nls.json';
    return { file, defaultFile };
}
