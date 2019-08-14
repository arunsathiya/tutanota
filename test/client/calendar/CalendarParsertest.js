//@flow

import o from "ospec/ospec.js"
import {parseDuration, parseProperty, parseTime, propertySequenceParser} from "../../../src/calendar/CalendarParser"
import {ParserError, StringIterator} from "../../../src/misc/parsing"

o.spec("CalendarParser", function () {
	o.spec("propertySequenceParser", function () {
		o("simple value", function () {
			o(propertySequenceParser(new StringIterator("DTSTART:20190531T083000Z"))).deepEquals(["DTSTART", null, ":", "20190531T083000Z"])
		})
		o("simple value, property parameter", function () {
			o(propertySequenceParser(new StringIterator("DTSTART;VALUE=DATE:20190607")))
				.deepEquals([
					"DTSTART",
					[";", [["VALUE", "=", "DATE"]]],
					":",
					"20190607"
				])
		})
		o("simple value, multiple property parameters", function () {
			o(propertySequenceParser(new StringIterator("DTSTART;VALUE=DATE;ANOTHER=VALUE:20190607"))).deepEquals([
				"DTSTART",
				[";", [["VALUE", "=", "DATE"], ["ANOTHER", "=", "VALUE"]]],
				":",
				"20190607"
			])
		})

		o("key-value value", function () {
			o(propertySequenceParser(new StringIterator("RRULE:FREQ=WEEKLY;BYDAY=SA"))).deepEquals([
				"RRULE",
				null,
				":",
				[["FREQ", "=", "WEEKLY"], ["BYDAY", "=", "SA"]]
			])
		})
	})

	o.spec("parseProperty", function () {
		o("simple value", function () {
			o(parseProperty("DTSTART:20190531T083000Z")).deepEquals({name: "DTSTART", params: {}, value: "20190531T083000Z"})
		})
		o("simple value, property parameter", function () {
			o(parseProperty("DTSTART;VALUE=DATE:20190607"))
				.deepEquals({
					name: "DTSTART",
					params: {"VALUE": "DATE"},
					value: "20190607"
				})
		})
		o("value with colon", function () {
			o(parseProperty("DTSTART:https://stuff")).deepEquals({name: "DTSTART", params: {}, value: "https://stuff"})
		})
		o("value with semicolon", function () {
			o(parseProperty("DTSTART:some\\;things")).deepEquals({name: "DTSTART", params: {}, value: "some;things"})
		})
	})

	o("parseDuraion", function () {
		o(parseDuration("PT3H15M")).deepEquals({positive: true, day: undefined, hour: 3, minute: 15, week: undefined})
		o(parseDuration("-PT3H15M")).deepEquals({positive: false, day: undefined, hour: 3, minute: 15, week: undefined})
		o(parseDuration("P60DT15M05S")).deepEquals({positive: true, day: 60, hour: undefined, minute: 15, week: undefined})
		o(parseDuration("P8W")).deepEquals({positive: true, day: undefined, hour: undefined, minute: undefined, week: 8})

		o(() => parseDuration("P8W15M")).throws(Error)
	})

	o("parseTime", function () {
		o(parseTime("20180115T214000Z", "Europe/Berlin")).deepEquals(new Date(Date.UTC(2018, 0, 15, 21, 40, 0)))
		o(() => parseTime("20180015T214000Z", "Europe/Berlin")).throws(ParserError)
	})
})