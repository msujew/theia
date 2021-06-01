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

import { inject, injectable, postConstruct } from 'inversify';

export const localizationPath = '/services/i18n';
export const localeId = 'localeId';
export const locale = typeof window === 'object' && window.localStorage.getItem(localeId) || 'en';
export const LocalizationProvider = Symbol('LocalizationProvider');

export interface Localization {
    languageId: string;
    languageName?: string;
    localizedLanguageName?: string;
    translations: { [key: string]: string };
}

export interface LocalizationInfo {
    id: string;
    value: string;
    localized?: string;
    args?: (string | LocalizationInfo)[];
}

export namespace LocalizationInfo {
    export function is(arg: Object | undefined): arg is LocalizationInfo {
        return typeof arg === 'object' && 'id' in arg && 'value' in arg;
    }

    export function localize(label: string | LocalizationInfo, service?: LocalizationService): string {
        if (typeof label === 'string') {
            return label;
        } else if (label.localized) {
            return label.localized;
        } else {
            let content = service ? service.localize(label.id, label.value) : label.value;
            if (label.args) {
                content = format(content, label.args.map(arg => localize(arg, service)));
            }
            label.localized = content;
            return content;
        }
    }

    export function getDefault(label: string | LocalizationInfo): string {
        if (typeof label === 'string') {
            return label;
        } else {
            return format(label.value, label.args ? label.args.map(arg => getDefault(arg)) : []);
        }
    }

    export function format(message: string, args: string[]): string {
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

    export function equals(a: LocalizationInfo | string | undefined, b: LocalizationInfo | string | undefined): boolean {
        if (a === b) {
            return true;
        } else if (is(a) && is(b)) {
            const result = a.id === b.id && a.value === b.value;
            if (result) {
                return !a.args && !b.args ||
                    Array.isArray(a.args) &&
                    Array.isArray(b.args) &&
                    a.args.length === b.args.length &&
                    a.args.every((val, index) => equals(val, b.args![index]));
            }
            return result;
        } else {
            return false;
        }
    }
}

export interface LocalizationProvider {
    getCurrentLanguage(): Promise<string>
    setCurrentLanguage(languageId: string): Promise<void>
    getAvailableLanguages(): Promise<string[]>
    loadLocalization(languageId: string): Promise<Localization>
}

@injectable()
export class LocalizationService {

    @inject(LocalizationProvider)
    protected localizationProvider: LocalizationProvider;

    protected localization: Localization;

    @postConstruct()
    protected async init(): Promise<void> {
        this.localizationProvider.setCurrentLanguage(locale);
        this.localization = await this.localizationProvider.loadLocalization(locale);
    }

    localize(key: string, defaultValue: string, ...args: string[]): string {
        let value = defaultValue;
        const translation = this.localization.translations[key];
        if (translation) {
            // vscode's localizations often contain additional '&&' symbols, which we simply ignore
            value = translation.replaceAll('&&', '');
        }
        return LocalizationInfo.format(value, args);
    }
}
