/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { deepStrictEqual, fail } from 'assert';
import { IShellLaunchConfig, ITerminalProfile, TerminalLocation } from 'vs/platform/terminal/common/terminal';
import { TerminalService } from 'vs/workbench/contrib/terminal/browser/terminalService';
import { URI } from 'vs/base/common/uri';
import { TestInstantiationService } from 'vs/platform/instantiation/test/common/instantiationServiceMock';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { ContextKeyService } from 'vs/platform/contextkey/browser/contextKeyService';
import { TestConfigurationService } from 'vs/platform/configuration/test/common/testConfigurationService';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { TestLifecycleService, TestTerminalEditorService, TestTerminalGroupService, TestTerminalInstanceService, TestTerminalProfileService } from 'vs/workbench/test/browser/workbenchTestServices';
import { ITerminalEditorService, ITerminalGroupService, ITerminalInstance, ITerminalInstanceService, ITerminalService } from 'vs/workbench/contrib/terminal/browser/terminal';
import { ILifecycleService } from 'vs/workbench/services/lifecycle/common/lifecycle';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { TestThemeService } from 'vs/platform/theme/test/common/testThemeService';
import { ITerminalProfileService } from 'vs/workbench/contrib/terminal/common/terminal';
import { IDialogService } from 'vs/platform/dialogs/common/dialogs';
import { TestDialogService } from 'vs/platform/dialogs/test/common/testDialogService';
import { IRemoteAgentService } from 'vs/workbench/services/remote/common/remoteAgentService';
import { TestRemoteAgentService } from 'vs/workbench/services/remote/test/common/testServices';

class TestTerminalService extends TerminalService {
	convertProfileToShellLaunchConfig(shellLaunchConfigOrProfile?: IShellLaunchConfig | ITerminalProfile, cwd?: string | URI): IShellLaunchConfig {
		return this._convertProfileToShellLaunchConfig(shellLaunchConfigOrProfile, cwd);
	}
}

suite.only('Workbench - TerminalService', () => {
	let instantiationService: TestInstantiationService;
	let terminalService: TestTerminalService;
	let configurationService: TestConfigurationService;
	let dialogService: TestDialogService;

	setup(async () => {
		dialogService = new TestDialogService();
		configurationService = new TestConfigurationService({
			terminal: {
				integrated: {
					fontWeight: 'normal'
				}
			}
		});

		instantiationService = new TestInstantiationService();
		instantiationService.stub(IConfigurationService, configurationService);
		instantiationService.stub(IContextKeyService, instantiationService.createInstance(ContextKeyService));
		instantiationService.stub(ILifecycleService, new TestLifecycleService());
		instantiationService.stub(IThemeService, new TestThemeService());
		instantiationService.stub(ITerminalEditorService, new TestTerminalEditorService());
		instantiationService.stub(ITerminalGroupService, new TestTerminalGroupService());
		instantiationService.stub(ITerminalInstanceService, new TestTerminalInstanceService());
		instantiationService.stub(ITerminalProfileService, new TestTerminalProfileService());
		instantiationService.stub(IRemoteAgentService, new TestRemoteAgentService());
		instantiationService.stub(IRemoteAgentService, 'getConnection', null);
		instantiationService.stub(IDialogService, dialogService);

		terminalService = instantiationService.createInstance(TestTerminalService);
		instantiationService.stub(ITerminalService, terminalService);
	});

	suite('convertProfileToShellLaunchConfig', () => {
		test('should return an empty shell launch config when undefined is provided', () => {
			deepStrictEqual(terminalService.convertProfileToShellLaunchConfig(), {});
			deepStrictEqual(terminalService.convertProfileToShellLaunchConfig(undefined), {});
		});
		test('should return the same shell launch config when provided', () => {
			deepStrictEqual(
				terminalService.convertProfileToShellLaunchConfig({}),
				{}
			);
			deepStrictEqual(
				terminalService.convertProfileToShellLaunchConfig({ executable: '/foo' }),
				{ executable: '/foo' }
			);
			deepStrictEqual(
				terminalService.convertProfileToShellLaunchConfig({ executable: '/foo', cwd: '/bar', args: ['a', 'b'] }),
				{ executable: '/foo', cwd: '/bar', args: ['a', 'b'] }
			);
			deepStrictEqual(
				terminalService.convertProfileToShellLaunchConfig({ executable: '/foo' }, '/bar'),
				{ executable: '/foo', cwd: '/bar' }
			);
			deepStrictEqual(
				terminalService.convertProfileToShellLaunchConfig({ executable: '/foo', cwd: '/bar' }, '/baz'),
				{ executable: '/foo', cwd: '/baz' }
			);
		});
		test('should convert a provided profile to a shell launch config', () => {
			deepStrictEqual(
				terminalService.convertProfileToShellLaunchConfig({
					profileName: 'abc',
					path: '/foo',
					isDefault: true
				}),
				{
					args: undefined,
					color: undefined,
					cwd: undefined,
					env: undefined,
					executable: '/foo',
					icon: undefined,
					name: undefined
				}
			);
			const icon = URI.file('/icon');
			deepStrictEqual(
				terminalService.convertProfileToShellLaunchConfig({
					profileName: 'abc',
					path: '/foo',
					isDefault: true,
					args: ['a', 'b'],
					color: 'color',
					env: { test: 'TEST' },
					icon
				} as ITerminalProfile, '/bar'),
				{
					args: ['a', 'b'],
					color: 'color',
					cwd: '/bar',
					env: { test: 'TEST' },
					executable: '/foo',
					icon,
					name: undefined
				}
			);
		});
		test('should respect overrideName in profile', () => {
			deepStrictEqual(
				terminalService.convertProfileToShellLaunchConfig({
					profileName: 'abc',
					path: '/foo',
					isDefault: true,
					overrideName: true
				}),
				{
					args: undefined,
					color: undefined,
					cwd: undefined,
					env: undefined,
					executable: '/foo',
					icon: undefined,
					name: 'abc'
				}
			);
		});
	});

	suite('safeDisposeTerminal', () => {
		test('should not show prompt when confirmOnKill is never', async () => {
			configurationService.setUserConfiguration('terminal.integrated.confirmOnKill', 'never');
			await new Promise<void>(r => {
				terminalService.safeDisposeTerminal({
					target: TerminalLocation.Editor,
					hasChildProcesses: true,
					dispose: () => r()
				} as Partial<ITerminalInstance> as any);
			});
			await new Promise<void>(r => {
				terminalService.safeDisposeTerminal({
					target: TerminalLocation.Panel,
					hasChildProcesses: true,
					dispose: () => r()
				} as Partial<ITerminalInstance> as any);
			});
		});
		test('should not show prompt when any terminal editor is closed (handled by editor itself)', async () => {
			configurationService.setUserConfiguration('terminal.integrated.confirmOnKill', 'editor');
			await new Promise<void>(r => {
				terminalService.safeDisposeTerminal({
					target: TerminalLocation.Editor,
					hasChildProcesses: true,
					dispose: () => r()
				} as Partial<ITerminalInstance> as any);
			});
			configurationService.setUserConfiguration('terminal.integrated.confirmOnKill', 'always');
			await new Promise<void>(r => {
				terminalService.safeDisposeTerminal({
					target: TerminalLocation.Editor,
					hasChildProcesses: true,
					dispose: () => r()
				} as Partial<ITerminalInstance> as any);
			});
		});
		test('should not show prompt when confirmOnKill is editor and panel terminal is closed', async () => {
			configurationService.setUserConfiguration('terminal.integrated.confirmOnKill', 'editor');
			await new Promise<void>(r => {
				terminalService.safeDisposeTerminal({
					target: TerminalLocation.Panel,
					hasChildProcesses: true,
					dispose: () => r()
				} as Partial<ITerminalInstance> as any);
			});
		});
		test('should show prompt when confirmOnKill is panel and panel terminal is closed', async () => {
			configurationService.setUserConfiguration('terminal', { integrated: { confirmOnKill: 'panel' } });
			configurationService.onDidChangeConfigurationEmitter.fire({ affectsConfiguration: () => true } as any);
			// No child process cases
			dialogService.setConfirmResult({ confirmed: false });
			await new Promise<void>(r => {
				terminalService.safeDisposeTerminal({
					target: TerminalLocation.Panel,
					hasChildProcesses: false,
					dispose: () => r()
				} as Partial<ITerminalInstance> as any);
			});
			dialogService.setConfirmResult({ confirmed: true });
			await new Promise<void>(r => {
				terminalService.safeDisposeTerminal({
					target: TerminalLocation.Panel,
					hasChildProcesses: false,
					dispose: () => r()
				} as Partial<ITerminalInstance> as any);
			});
			// Child process cases
			dialogService.setConfirmResult({ confirmed: false });
			await terminalService.safeDisposeTerminal({
				target: TerminalLocation.Panel,
				hasChildProcesses: true,
				dispose: () => fail()
			} as Partial<ITerminalInstance> as any);
			dialogService.setConfirmResult({ confirmed: true });
			await new Promise<void>(r => {
				terminalService.safeDisposeTerminal({
					target: TerminalLocation.Panel,
					hasChildProcesses: true,
					dispose: () => r()
				} as Partial<ITerminalInstance> as any);
			});
		});
		test('should show prompt when confirmOnKill is always and panel terminal is closed', async () => {
			configurationService.setUserConfiguration('terminal', { integrated: { confirmOnKill: 'always' } });
			configurationService.onDidChangeConfigurationEmitter.fire({ affectsConfiguration: () => true } as any);
			// No child process cases
			dialogService.setConfirmResult({ confirmed: false });
			await new Promise<void>(r => {
				terminalService.safeDisposeTerminal({
					target: TerminalLocation.Panel,
					hasChildProcesses: false,
					dispose: () => r()
				} as Partial<ITerminalInstance> as any);
			});
			dialogService.setConfirmResult({ confirmed: true });
			await new Promise<void>(r => {
				terminalService.safeDisposeTerminal({
					target: TerminalLocation.Panel,
					hasChildProcesses: false,
					dispose: () => r()
				} as Partial<ITerminalInstance> as any);
			});
			// Child process cases
			dialogService.setConfirmResult({ confirmed: false });
			await terminalService.safeDisposeTerminal({
				target: TerminalLocation.Panel,
				hasChildProcesses: true,
				dispose: () => fail()
			} as Partial<ITerminalInstance> as any);
			dialogService.setConfirmResult({ confirmed: true });
			await new Promise<void>(r => {
				terminalService.safeDisposeTerminal({
					target: TerminalLocation.Panel,
					hasChildProcesses: true,
					dispose: () => r()
				} as Partial<ITerminalInstance> as any);
			});
		});
	});
});
