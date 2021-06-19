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

// import '../../src/browser/style/output.css';
import { Container, inject, injectable, interfaces, postConstruct } from '@theia/core/shared/inversify';
import { toArray } from '@theia/core/shared/@phosphor/algorithm';
import { IDragEvent } from '@theia/core/shared/@phosphor/dragdrop';
import { Disposable, DisposableCollection } from '@theia/core/lib/common/disposable';
import { Message, BaseWidget, DockPanel, Widget, MessageLoop } from '@theia/core/lib/browser';
import { DebugConsoleManager } from './debug-console-manager';
import { DebugSession } from '../debug-session';
import { ConsoleOptions, ConsoleWidget } from '@theia/console/lib/browser/console-widget';
import { DebugConsoleSession } from './debug-console-session';

export const ConsoleWidgetProvider = Symbol('ConsoleWidgetProvider');

@injectable()
export class DebugConsoleWidget extends BaseWidget {

    static readonly ID = 'debugConsoleWidget';

    @inject(DebugConsoleManager)
    protected readonly debugConsoleManager: DebugConsoleManager;

    @inject(ConsoleWidgetProvider)
    protected readonly consoleWidgetProvider: (session: DebugConsoleSession) => Promise<ConsoleWidget>;

    protected readonly consoleContainer: DockPanel;
    protected readonly toDisposeOnSelectedChannelChanged = new DisposableCollection();

    constructor() {
        super();
        this.id = DebugConsoleWidget.ID;
        this.title.label = 'Debug Console';
        this.title.caption = 'Debug Console';
        this.title.iconClass = 'fa fa-flag';
        this.title.closable = true;
        this.addClass('theia-output');
        this.node.tabIndex = 0;
        this.consoleContainer = new NoopDragOverDockPanel({ spacing: 0, mode: 'multiple-document' });
        this.consoleContainer.addClass('editor-container');
        this.consoleContainer.node.tabIndex = -1;
    }

    static createContainer(parent: interfaces.Container, options: ConsoleOptions): Container {
        const child = ConsoleWidget.createContainer(parent, options);
        child.bind(DebugConsoleWidget).toSelf();
        return child;
    }

    @postConstruct()
    protected init(): void {
        this.toDispose.pushAll([
            this.debugConsoleManager.onSelectedSessionChanged(() => this.refreshConsoleWidget()),
            this.toDisposeOnSelectedChannelChanged
        ]);
        this.refreshConsoleWidget();
        this.debugConsoleManager.onSessionAdded(session => {
            if (!this.debugConsoleManager.selectedSession) {
                this.debugConsoleManager.selectedSession = session;
            }
        });
    }

    protected async refreshConsoleWidget({ preserveFocus }: { preserveFocus: boolean } = { preserveFocus: false }): Promise<void> {
        const { selectedSession } = this;
        const consoleWidget = this.consoleWidget;
        if (selectedSession && consoleWidget) {
            // If the input is the current one, do nothing.
            // const model = (editorWidget.editor as MonacoEditor).getControl().getModel();
            // if (model && model.uri.toString() === selectedChannel.id) {
            //     if (!preserveFocus) {
            //         this.activate();
            //     }
            //     return;
            // }
        }
        this.toDisposeOnSelectedChannelChanged.dispose();
        const widget = await this.createConsoleWidget();
        if (widget) {
            this.consoleContainer.addWidget(widget);
            this.toDisposeOnSelectedChannelChanged.push(Disposable.create(() => widget.close()));
            if (selectedSession) {
                this.toDisposeOnSelectedChannelChanged.push(selectedSession.on('output', () => this.revealLastLine()));
            }
            if (!preserveFocus) {
                this.activate();
            }
            this.revealLastLine();
        }
    }

    protected onAfterAttach(message: Message): void {
        super.onAfterAttach(message);
        Widget.attach(this.consoleContainer, this.node);
        this.toDisposeOnDetach.push(Disposable.create(() => Widget.detach(this.consoleContainer)));
    }

    protected onActivateRequest(message: Message): void {
        super.onActivateRequest(message);
        // if (this.editor) {
        //     this.editor.focus();
        // } else {
        //     this.node.focus();
        // }
    }

    protected onResize(message: Widget.ResizeMessage): void {
        super.onResize(message);
        MessageLoop.sendMessage(this.consoleContainer, Widget.ResizeMessage.UnknownSize);
        for (const widget of toArray(this.consoleContainer.widgets())) {
            MessageLoop.sendMessage(widget, Widget.ResizeMessage.UnknownSize);
        }
    }

    protected onAfterShow(msg: Message): void {
        super.onAfterShow(msg);
        this.onResize(Widget.ResizeMessage.UnknownSize); // Triggers an editor widget resize. (#8361)
    }

    clear(): void {
        if (this.consoleWidget) {
            this.consoleWidget.clear();
        }
    }

    selectAll(): void {
        // const editor = this.editor;
        // if (editor) {
        //     const model = editor.getControl().getModel();
        //     if (model) {
        //         const endLine = model.getLineCount();
        //         const endCharacter = model.getLineMaxColumn(endLine);
        //         editor.getControl().setSelection(new monaco.Range(1, 1, endLine, endCharacter));
        //     }
        // }
    }

    protected revealLastLine(): void {
        // const editor = this.editor;
        // if (editor) {
        //     const model = editor.getControl().getModel();
        //     if (model) {
        //         const lineNumber = model.getLineCount();
        //         const column = model.getLineMaxColumn(lineNumber);
        //         editor.getControl().revealPosition({ lineNumber, column }, monaco.editor.ScrollType.Smooth);
        //     }
        // }
    }

    private get selectedSession(): DebugSession | undefined {
        return this.debugConsoleManager.selectedSession;
    }

    private async createConsoleWidget(): Promise<ConsoleWidget | undefined> {
        const widget = await this.consoleWidgetProvider(new DebugConsoleSession(this.selectedSession));
        return widget;
    }

    private get consoleWidget(): ConsoleWidget | undefined {
        for (const widget of toArray(this.consoleContainer.children())) {
            if (widget instanceof ConsoleWidget) {
                return widget;
            }
        }
        return undefined;
    }
}

/**
 * Customized `DockPanel` that does not allow dropping widgets into it.
 * Intercepts `'p-dragover'` events, and sets the desired drop action to `'none'`.
 */
class NoopDragOverDockPanel extends DockPanel {

    constructor(options?: DockPanel.IOptions) {
        super(options);
        NoopDragOverDockPanel.prototype['_evtDragOver'] = (event: IDragEvent) => {
            event.preventDefault();
            event.stopPropagation();
            event.dropAction = 'none';
        };
    }

}
