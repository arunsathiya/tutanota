// @flow
import type {NativeImage} from 'electron'
import {app, Menu, MenuItem, nativeImage, Tray} from 'electron'
import path from 'path'
import {lang} from "../misc/LanguageViewModel"
import type {DesktopConfigHandler} from './DesktopConfigHandler.js'
import type {WindowManager} from "./DesktopWindowManager.js"
import type {DesktopNotifier} from "./DesktopNotifier.js"
import {neverNull} from "../api/common/utils/Utils";

let icon: NativeImage

export class DesktopTray {
	_conf: DesktopConfigHandler;
	_wm: WindowManager;
	_notifier: DesktopNotifier;

	_tray: ?Tray;

	constructor(config: DesktopConfigHandler, notifier: DesktopNotifier) {
		this._conf = config
		this._notifier = notifier
		this.getIcon()
		app.on('will-quit', (e: Event) => {
			if (this._tray) {
				this._tray.destroy()
				this._tray = null
			}
		})
	}

	/**
	 * linux env: DESKTOP_SESSION XDG_SESSION_DESKTOP XDG_CURRENT_DESKTOP to detect WM
	 */
	update(): void {
		if (!this._conf.getDesktopConfig('runAsTrayApp')) {
			return
		}
		if (process.platform === 'darwin') { // we use the dock on MacOs
			app.dock.setMenu(this._getMenu())
			if (!app.dock.isVisible()) {
				app.dock.show()
			}
		} else {
			if (!this._tray) {
				this._tray = new Tray(this.getIcon())
				this._tray.on('click', ev => {
					this._wm.getLastFocused(true)
				})
			}
			// OK, we just created one if it wasn't there
			neverNull(this._tray).setContextMenu(this._getMenu())
		}
	}

	getIcon(): NativeImage {
		return DesktopTray.getIcon(this._conf.get('iconName'))
	}

	static getIcon(iconName: string): NativeImage {
		if (icon) {
			return icon
		} else if (process.platform === 'darwin') {
			icon = nativeImage.createFromPath(path.join((process: any).resourcesPath, `icons/${iconName}.icns`))
		} else if (process.platform === 'win32') {
			icon = nativeImage.createFromPath(path.join((process: any).resourcesPath, `icons/${iconName}`))
		} else {
			icon = nativeImage.createFromPath(path.join((process: any).resourcesPath, `icons/${iconName}`))
		}
		return icon
	}

	_getMenu(): Menu {
		const m = new Menu()
		m.append(new MenuItem({
			label: lang.get("openNewWindow_action"), click: () => {
				this._wm.newWindow(true)
			}
		}))
		if (this._wm.getAll().length > 0) {
			m.append(new MenuItem({type: 'separator'}))
			this._wm.getAll().forEach(w => {
				let label = w.getTitle()
				if (this._notifier.hasNotificationsForWindow(w)) {
					label = "• " + label
				} else {
					label = label + "  "
				}
				m.append(new MenuItem({
					label: label,
					click: () => w.show()
				}))
			})
		}
		if (process.platform !== 'darwin') {
			m.append(new MenuItem({type: 'separator'}))
			m.append(new MenuItem({
				label: lang.get("quit_action"),
				accelerator: "CmdOrCtrl+Q",
				click: app.quit
			}))
		}
		return m
	}

	setWindowManager(wm: WindowManager) {
		this._wm = wm
	}
}
