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
import { Localization, SmartTranslation } from './localization';

export const localizationPath = '/services/i18n';
export const localizationId = 'localizationId';

export const LocalizationProvider = Symbol('LocalizationProvider');

export interface LocalizationProvider {
    getAvailableLanguages(): Promise<string[]>
    addLocalizations(...localization: Localization[]): void
    loadLocalizations(languageId: string): Promise<Localization[]>
}

@injectable()
export class LocalizationService {

    static languageId: string = '';

    @inject(LocalizationProvider)
    protected localizationProvider: LocalizationProvider;

    protected translations = new Map<string, SmartTranslation>();

    @postConstruct()
    protected async init(): Promise<void> {
        const localizations = await this.localizationProvider.loadLocalizations(LocalizationService.languageId);
        this.translations = this.buildSmartTranslations(localizations);
    }

    protected buildSmartTranslations(localizations: Localization[]): Map<string, SmartTranslation> {
        const map = new Map<string, SmartTranslation>();
        localizations.flatMap(e => e.translations || []).forEach(e => {
            const translation: SmartTranslation = {
                id: e.id,
                contents: {}
            };
            for (const [scope, item] of Object.entries(e.contents)) {
                let shortScope = scope;
                const slashIndex = shortScope.lastIndexOf('/');
                if (slashIndex > 0) {
                    shortScope = shortScope.substring(slashIndex + 1);
                }
                for (const [key, value] of Object.entries(item)) {
                    const fullKey = `${shortScope}/${key}`;
                    translation.contents[fullKey] = value;
                }
            }
            map.set(e.id, translation);
        });
        return map;
    }

    localize(key: string, defaultValue: string, ...args: string[]): string {
        const vscode = this.translations.get('vscode');
        let value = defaultValue;
        if (vscode) {
            const translation = vscode.contents[key];
            if (translation) {
                value = translation.replaceAll('&&', '');
            }
        }
        return this.format(value, ...args);
    }

    protected format(message: string, ...args: string[]): string {
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

    localizeVsCode(index: number, args: string[]): string {
        return '';
    }

}
