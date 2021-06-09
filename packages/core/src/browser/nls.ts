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

import { Localization } from '../common/i18n/localization-service';
import { Endpoint } from './endpoint';

interface NlsTranslation {
    plugin: string;
    bundle: string;
    key: string;
    value: string;
}

interface LocalizationInfo {
    plugin?: string;
    bundle?: string;
    key: string;
}

// interface BundleInfo {
//     plugin?: string;
//     bundle: string;
// }

class TranslationContainer {

    translations: Map<string, NlsTranslation[]> = new Map();
    bundles: Record<string, string[]> = {};

    addLocalization(localizations: Localization[]): void {
        for (const translation of localizations.flatMap(e => e.translations)) {
            const plugin = translation.id;
            for (const [bundle, item] of Object.entries(translation.contents)) {
                const bundleArray: string[] = [];
                for (const [key, value] of Object.entries(item)) {
                    bundleArray.push(value);
                    const nlsTranslation = { plugin, bundle, key, value };
                    if (!this.translations.has(key)) {
                        this.translations.set(key, []);
                    }
                    this.translations.get(key)?.push(nlsTranslation);
                }
                this.bundles[bundle] = bundleArray;
            }
        }
    }

    getBundle(): Record<string, string[]> {
        return this.bundles;
    }

    localize(id: string | LocalizationInfo, defaultValue: string, args: string[]): string {
        const info: LocalizationInfo = typeof id === 'string' ? { key: id } : id;
        const items = this.translations.get(info.key);
        if (items && items.length > 0) {
            if (items.length === 1) {
                return this.format(items[0].value, args);
            }
            if (info.bundle) {
                const itemsWithBundle = items.filter(e => e.bundle === info.bundle);
                if (itemsWithBundle.length === 1) {
                    return this.format(itemsWithBundle[0].value, args);
                } else if (itemsWithBundle.length === 0) {
                    console.error('Does not exist');
                } else if (info.plugin) {
                    const itemsWithPlugin = itemsWithBundle.filter(e => e.plugin === info.plugin);
                    if (itemsWithPlugin.length === 1) {
                        return this.format(itemsWithPlugin[0].value, args);
                    } else if (itemsWithBundle.length === 0) {
                        console.error('Does not exist');
                    } else {
                        console.error('Duplicate localization entries, please provide plugin id');
                    }
                } else {
                    console.error('Duplicate localization keys, please provide plugin id');
                }
            } else {
                console.error('Duplicate localization keys, please provide bundle id');
            }
        }
        return this.format(defaultValue, args);
    }

    format(message: string, args: string[]): string {
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
}

const container: TranslationContainer = new TranslationContainer();

export namespace nls {

    export const locale = window.localStorage.getItem('localizationId');

    export function localize(id: string | LocalizationInfo, defaultValue: string, ...args: string[]): string {
        return container.localize(id, defaultValue, args);
    }

    export function loadBundle(): Record<string, string[]> {
        return container.getBundle();
    }
}

export function loadTranslations(): void {
    const endpoint = new Endpoint({ path: '/i18n/' + nls.locale }).getRestUrl().toString();
    const request = new XMLHttpRequest();
    request.open('GET', endpoint, false);
    request.onreadystatechange = function (this: XMLHttpRequest): void {
        if (this.readyState === 4 && this.status === 200) {
            // Typical action to be performed when the document is ready:
            const responseJson = JSON.parse(this.responseText) as Localization[];
            container.addLocalization(responseJson);
        }
    };
    request.send();
}
