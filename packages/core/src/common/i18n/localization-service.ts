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
export const localizationId = 'localizationId';
export const LocalizationProvider = Symbol('LocalizationProvider');

export interface Localization {
    languageId: string;
    languageName?: string;
    localizedLanguageName?: string;
    translations: Translation[];
}

export interface Translation {
    id: string;
    version: string;
    contents: { [bundle: string]: { [key: string]: string } }
}

export interface LocalizationInfo {
    id: string;
    value: string;
    args?: (string | LocalizationInfo)[];
}

export namespace LocalizationInfo {
    export function localize(label: string | LocalizationInfo, service?: LocalizationService): string {
        if (typeof label === 'string') {
            return label;
        } else {
            const content = service ? service.localize(label.id, label.value) : label.value;
            if (label.args) {
                // content = format(content, ...label.args.map(arg => localize(arg, service)));
            }
            return content;
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

    static languageId: string = 'en';

    @inject(LocalizationProvider)
    protected localizationProvider: LocalizationProvider;

    protected localization: Localization;

    @postConstruct()
    protected async init(): Promise<void> {
        this.localizationProvider.setCurrentLanguage(LocalizationService.languageId);
        this.localization = await this.localizationProvider.loadLocalization(LocalizationService.languageId);
    }

    localize(key: string, defaultValue: string, ...args: string[]): string {
        // let value = defaultValue;
        // const translation = this.localization.translations[key];
        // if (translation) {
        //     value = translation.replaceAll('&&', '');
        // }
        // return LocalizationInfo.format(value, ...args);
        return defaultValue;
    }
}
