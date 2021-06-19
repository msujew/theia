/********************************************************************************
 * Copyright (C) 2018 TypeFox and others.
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

import { ConsoleSession } from '@theia/console/lib/browser/console-session';
import { ConsoleOptions, ConsoleWidget } from '@theia/console/lib/browser/console-widget';
import { AbstractViewContribution, bindViewContribution, Widget, WidgetFactory, WidgetManager } from '@theia/core/lib/browser';
import { ContextKey, ContextKeyService } from '@theia/core/lib/browser/context-key-service';
import { TabBarToolbarContribution, TabBarToolbarRegistry } from '@theia/core/lib/browser/shell/tab-bar-toolbar';
import { Command, CommandRegistry } from '@theia/core/lib/common/command';
import { Severity } from '@theia/core/lib/common/severity';
import { inject, injectable, interfaces } from '@theia/core/shared/inversify';
import * as React from '@theia/core/shared/react';
import { DebugConsoleManager } from './debug-console-manager';
import { DebugConsoleSession } from './debug-console-session';
import { ConsoleWidgetProvider, DebugConsoleWidget } from './debug-console-widget';

export type InDebugReplContextKey = ContextKey<boolean>;
export const InDebugReplContextKey = Symbol('inDebugReplContextKey');

export namespace DebugConsoleCommands {
    const DEBUG_CONSOLE_CATEGORY = 'Debug';
    export const CLEAR: Command = {
        id: 'debug.console.clear',
        category: DEBUG_CONSOLE_CATEGORY,
        label: 'Clear Console',
        iconClass: 'clear-all'
    };
}

@injectable()
export class DebugConsoleContribution extends AbstractViewContribution<DebugConsoleWidget> implements TabBarToolbarContribution {

    @inject(WidgetManager)
    protected readonly widgetManager: WidgetManager;

    @inject(DebugConsoleManager)
    protected readonly debugConsoleManager: DebugConsoleManager;

    constructor() {
        super({
            widgetId: DebugConsoleWidget.ID,
            widgetName: DebugConsoleContribution.options.title!.label!,
            defaultWidgetOptions: {
                area: 'bottom'
            },
            toggleCommandId: 'debug:console:toggle',
            toggleKeybinding: 'ctrlcmd+shift+y'
        });
    }
    id: string;
    label?: string | undefined;
    iconClass?: string | undefined;

    registerCommands(commands: CommandRegistry): void {
        super.registerCommands(commands);
        commands.registerCommand(DebugConsoleCommands.CLEAR, {
            isEnabled: widget => this.withWidget(widget, () => true),
            isVisible: widget => this.withWidget(widget, () => true),
            execute: widget => this.withWidget(widget, () => {
                this.clearConsole();
            }),
        });
    }

    registerToolbarItems(toolbarRegistry: TabBarToolbarRegistry): void {
        toolbarRegistry.registerItem({
            id: 'debug-console-severity',
            render: widget => this.renderSeveritySelector(widget),
            isVisible: widget => this.withWidget(widget, () => true),
            // onDidChange: (listener, thisArgs, disposables) => this.activeConsoleSession?.onSelectionChange(listener, thisArgs, disposables)
        });

        toolbarRegistry.registerItem({
            id: 'debug-console-selector',
            render: widget => this.renderDebugConsoleSelector(widget),
            isVisible: widget => this.withWidget(widget, () => this.debugConsoleManager.all.length > 1),
            // onDidChange: this.onSelectionChange
        });

        toolbarRegistry.registerItem({
            id: DebugConsoleCommands.CLEAR.id,
            command: DebugConsoleCommands.CLEAR.id,
            tooltip: 'Clear Console',
            priority: 0,
        });
    }

    static options: ConsoleOptions = {
        id: 'debug-console',
        title: {
            label: 'Debug Console',
            iconClass: 'theia-debug-console-icon'
        },
        input: {
            uri: DebugConsoleSession.uri,
            options: {
                autoSizing: true,
                minHeight: 1,
                maxHeight: 10
            }
        }
    };

    static create(parent: interfaces.Container): DebugConsoleWidget {
        const inputFocusContextKey = parent.get<InDebugReplContextKey>(InDebugReplContextKey);
        const child = DebugConsoleWidget.createContainer(parent, {
            ...DebugConsoleContribution.options,
            inputFocusContextKey
        });
        const widget = child.get(DebugConsoleWidget);
        return widget;
    }

    static bindContribution(bind: interfaces.Bind): void {
        bind(ConsoleWidgetProvider).toProvider(context => (session: ConsoleSession) => {
            const widget = context.container.get(ConsoleWidget);
            widget.session = session;
            return Promise.resolve(widget);
        });
        bind(DebugConsoleManager).toSelf().inSingletonScope();
        bind(InDebugReplContextKey).toDynamicValue(({ container }) =>
            container.get(ContextKeyService).createKey('inDebugRepl', false)
        ).inSingletonScope();
        bindViewContribution(bind, DebugConsoleContribution);
        bind(TabBarToolbarContribution).toService(DebugConsoleContribution);
        bind(WidgetFactory).toDynamicValue(({ container }) => ({
            id: DebugConsoleWidget.ID,
            createWidget: () => DebugConsoleContribution.create(container)
        }));
    }

    protected renderSeveritySelector(widget: Widget | undefined): React.ReactNode {
        const severityElements: React.ReactNode[] = [];
        Severity.toArray().forEach(s => severityElements.push(<option value={s} key={s}>{s}</option>));
        // const selectedValue = Severity.toString(this.activeConsoleSession?.severity || Severity.Ignore);

        return <select
            className='theia-select'
            id={'debugConsoleSeverity'}
            key={'debugConsoleSeverity'}
            value={undefined}
            onChange={this.changeSeverity}
        >
            {severityElements}
        </select>;
    }

    protected renderDebugConsoleSelector(widget: Widget | undefined): React.ReactNode {
        const availableConsoles: React.ReactNode[] = [];
        this.debugConsoleManager.all.forEach(e => {
            availableConsoles.push(<option value={e.id} key={e.id}>{e.label}</option>);
        });
        return <select
            className='theia-select'
            id='debugConsoleSelector'
            key='debugConsoleSelector'
            value={undefined}
            onChange={this.changeDebugConsole}
        >
            {availableConsoles}
        </select>;
    }

    protected changeDebugConsole = (event: React.ChangeEvent<HTMLSelectElement>) => {
        const id = event.target.value;
        const session = this.debugConsoleManager.get(id);
        this.debugConsoleManager.selectedSession = session;
    };

    protected changeSeverity = (event: React.ChangeEvent<HTMLSelectElement>) => {
        // if (this.activeConsoleSession) {
        //     this.activeConsoleSession.severity = Severity.fromValue(event.target.value);
        // }
    };

    protected withWidget<T>(widget: Widget | undefined = this.tryGetWidget(), fn: (widget: ConsoleWidget) => T): T | false {
        if (widget instanceof ConsoleWidget && widget.id === DebugConsoleContribution.options.id) {
            return fn(widget);
        }
        return false;
    }

    /**
     * Clear the console widget.
     */
    protected async clearConsole(): Promise<void> {
        const widget = await this.widget;
        widget.clear();
    }

}
