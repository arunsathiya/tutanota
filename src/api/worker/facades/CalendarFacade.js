//@flow

import {erase, setup} from "../EntityWorker"
import {assertWorkerOrNode} from "../../Env"
import {createUserAlarmInfo} from "../../entities/sys/UserAlarmInfo"
import type {LoginFacade} from "./LoginFacade"
import {neverNull} from "../../common/utils/Utils"
import {findAllAndRemove, removeAll} from "../../common/utils/ArrayUtils"
import {elementIdPart, HttpMethod, isSameId, listIdPart} from "../../common/EntityFunctions"
import {generateEventElementId, getEventStart, isLongEvent} from "../../common/utils/CommonCalendarUtils"
import {loadAll, serviceRequestVoid} from "../../worker/EntityWorker"
import {PushIdentifierTypeRef} from "../../entities/sys/PushIdentifier"
import {encryptKey, resolveSessionKey} from "../crypto/CryptoFacade"
import {createAlarmServicePost} from "../../entities/sys/AlarmServicePost"
import {SysService} from "../../entities/sys/Services"
import {aes128RandomKey} from "../crypto/Aes"
import {createAlarmNotification} from "../../entities/sys/AlarmNotification"
import {OperationType} from "../../common/TutanotaConstants"
import {createNotificationSessionKey} from "../../entities/sys/NotificationSessionKey"
import {_TypeModel as PushIdentifierTypeModel} from "../../entities/sys/PushIdentifier"
import {bitArrayToUint8Array} from "../crypto/CryptoUtils"

assertWorkerOrNode()

export class CalendarFacade {

	_loginFacade: LoginFacade;

	constructor(loginFacade: LoginFacade) {
		this._loginFacade = loginFacade
	}

	createCalendarEvent(groupRoot: CalendarGroupRoot, event: CalendarEvent, alarmInfo: ?AlarmInfo, oldEvent: ?CalendarEvent, oldUserAlarmInfo: ?UserAlarmInfo): Promise<void> {
		const user = this._loginFacade.getLoggedInUser()
		const userAlarmInfoListId = neverNull(user.alarmInfoList).alarms
		let p = Promise.resolve()
		const alarmNotifications: Array<AlarmNotification> = []
		// delete old calendar event
		if (oldEvent) {
			p = erase(oldEvent).then(() => {
				// delete old alarm
				if (oldUserAlarmInfo) {

					const alarmNotification = Object.assign(createAlarmNotification(), {
						alarmInfo: oldUserAlarmInfo.alarmInfo,
						repeatRule: null,
						deviceSessionKeys: [],
						operation: OperationType.DELETE
					})

					alarmNotifications.push(alarmNotification)
					return erase(oldUserAlarmInfo)
				}
			})
		}

		return p
			.then(() => {
				if (alarmInfo) {
					const newAlarm = createUserAlarmInfo()
					newAlarm._ownerGroup = user.userGroup.group
					newAlarm.alarmInfo = alarmInfo
					const alarmNotification = Object.assign(createAlarmNotification(), {
						alarmInfo,
						repeatRule: event.repeatRule,
						deviceSessionKeys: [],
						operation: OperationType.CREATE,
						summary: event.summary,
						eventStart: event.startTime
					})
					alarmNotifications.push(alarmNotification)

					return setup(userAlarmInfoListId, newAlarm)
				}
			})
			.then(newUserAlarmElementId => {
				findAllAndRemove(event.alarmInfos, (userAlarmInfoId) => isSameId(userAlarmInfoListId, listIdPart(userAlarmInfoId)))
				if (newUserAlarmElementId) {
					event.alarmInfos.push([userAlarmInfoListId, newUserAlarmElementId])
				}
				const listId = event.repeatRule || isLongEvent(event) ? groupRoot.longEvents : groupRoot.shortEvents
				event._id = [listId, generateEventElementId(event.startTime.getTime())]
				return setup(listId, event)
			})
			.then(() => this._sendAlarmNotifications(alarmNotifications))
	}

	_sendAlarmNotifications(alarmNotifications: Array<AlarmNotification>): Promise<void> {
		return loadAll(PushIdentifierTypeRef, neverNull(this._loginFacade.getLoggedInUser().pushIdentifierList).list)
			.then((pushIdentifierList) => {
				const notificationSessionKey = aes128RandomKey()
				return Promise
					.map(pushIdentifierList, identifier => {
						return resolveSessionKey(PushIdentifierTypeModel, identifier).then(pushIdentifierSk => {
							if (pushIdentifierSk) {
								const pushIdentifierSessionEncSessionKey = encryptKey(pushIdentifierSk, notificationSessionKey)
								return {identifierId: identifier._id, pushIdentifierSessionEncSessionKey}
							} else {
								return null
							}
						})
					})
					.then(maybeEncSessionKeys => {
						const encSessionKeys = maybeEncSessionKeys.filter(Boolean)
						for (let notification of alarmNotifications) {
							notification.deviceSessionKeys = encSessionKeys.map(esk => {
								return Object.assign(createNotificationSessionKey(), {
									pushIdentifier: esk.identifierId,
									pushIdentifierSessionEncSessionKey: esk.pushIdentifierSessionEncSessionKey
								})
							})
						}

						const requestEntity = createAlarmServicePost()
						requestEntity.alarmNotifications = alarmNotifications
						return serviceRequestVoid(SysService.AlarmService, HttpMethod.POST, requestEntity, null, notificationSessionKey)
					})
			})
	}
}

