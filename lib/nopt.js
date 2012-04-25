(function() {

	// info about each config option.
	var debug = function () {},
		system = require('system');

	window.nopt = {};
	window.nopt.nopt = nopt
	window.nopt.clean = clean

	window.nopt.typeDefs =
		{ String  : { type: String,  validate: validateString  }
		, Boolean : { type: Boolean, validate: validateBoolean }
		, Number  : { type: Number,  validate: validateNumber  }
		, Date    : { type: Date,    validate: validateDate    }
		}

	function nopt (types, shorthands, args, slice) {
		args = args || system.args
		types = types || {}
		shorthands = shorthands || {}
		if (typeof slice !== "number") slice = 2

		debug(types, shorthands, args, slice)

		args = args.slice(slice)
		var data = {}
			, key
			, remain = []
			, cooked = args
			, original = args.slice(0)

		parse(args, data, remain, types, shorthands)
		// now data is full
		clean(data, types, window.nopt.typeDefs)
		data.argv = {remain:remain,cooked:cooked,original:original}
		data.argv.toString = function () {
			return this.original.map(JSON.stringify).join(" ")
		}
		return data
	}

	function clean (data, types, typeDefs) {
		typeDefs = typeDefs || window.nopt.typeDefs
		var remove = {}
			, typeDefault = [false, true, null, String, Number]

		Object.keys(data).forEach(function (k) {
			if (k === "argv") return
			var val = data[k]
				, isArray = Array.isArray(val)
				, type = types[k]
			if (!isArray) val = [val]
			if (!type) type = typeDefault
			if (type === Array) type = typeDefault.concat(Array)
			if (!Array.isArray(type)) type = [type]

			debug("val=%j", val)
			debug("types=", type)
			val = val.map(function (val) {
				// if it's an unknown value, then parse false/true/null/numbers/dates
				if (typeof val === "string") {
					debug("string %j", val)
					val = val.trim()
					if ((val === "null" && ~type.indexOf(null))
							|| (val === "true" &&
								 (~type.indexOf(true) || ~type.indexOf(Boolean)))
							|| (val === "false" &&
								 (~type.indexOf(false) || ~type.indexOf(Boolean)))) {
						val = JSON.parse(val)
						debug("jsonable %j", val)
					} else if (~type.indexOf(Number) && !isNaN(val)) {
						debug("convert to number", val)
						val = +val
					} else if (~type.indexOf(Date) && !isNaN(Date.parse(val))) {
						debug("convert to date", val)
						val = new Date(val)
					}
				}

				if (!types.hasOwnProperty(k)) {
					return val
				}

				// allow `--no-blah` to set 'blah' to null if null is allowed
				if (val === false && ~type.indexOf(null) &&
						!(~type.indexOf(false) || ~type.indexOf(Boolean))) {
					val = null
				}

				var d = {}
				d[k] = val
				debug("prevalidated val", d, val, types[k])
				if (!validate(d, k, val, types[k], typeDefs)) {
					return remove
				}
				debug("validated val", d, val, types[k])
				return d[k]
			}).filter(function (val) { return val !== remove })

			if (!val.length) delete data[k]
			else if (isArray) {
				debug(isArray, data[k], val)
				data[k] = val
			} else data[k] = val[0]

			debug("k=%s val=%j", k, val, data[k])
		})
	}

	function validateString (data, k, val) {
		data[k] = String(val)
	}

	function validateNumber (data, k, val) {
		debug("validate Number %j %j %j", k, val, isNaN(val))
		if (isNaN(val)) return false
		data[k] = +val
	}

	function validateDate (data, k, val) {
		debug("validate Date %j %j %j", k, val, Date.parse(val))
		var s = Date.parse(val)
		if (isNaN(s)) return false
		data[k] = new Date(val)
	}

	function validateBoolean (data, k, val) {
		if (val instanceof Boolean) val = val.valueOf()
		else if (typeof val === "string") {
			if (!isNaN(val)) val = !!(+val)
			else if (val === "null" || val === "false") val = false
			else val = true
		} else val = !!val
		data[k] = val
	}

	function validate (data, k, val, type, typeDefs) {
		// arrays are lists of types.
		if (Array.isArray(type)) {
			for (var i = 0, l = type.length; i < l; i ++) {
				if (type[i] === Array) continue
				if (validate(data, k, val, type[i], typeDefs)) return true
			}
			delete data[k]
			return false
		}

		// an array of anything?
		if (type === Array) return true

		// NaN is poisonous.  Means that something is not allowed.
		if (type !== type) {
			debug("Poison NaN", k, val, type)
			delete data[k]
			return false
		}

		// explicit list of values
		if (val === type) {
			debug("Explicitly allowed %j", val)
			// if (isArray) (data[k] = data[k] || []).push(val)
			// else data[k] = val
			data[k] = val
			return true
		}

		// now go through the list of typeDefs, validate against each one.
		var ok = false
			, types = Object.keys(typeDefs)
		for (var i = 0, l = types.length; i < l; i ++) {
			debug("test type %j %j %j", k, val, types[i])
			var t = typeDefs[types[i]]
			if (t && type === t.type) {
				var d = {}
				ok = false !== t.validate(d, k, val)
				val = d[k]
				if (ok) {
					// if (isArray) (data[k] = data[k] || []).push(val)
					// else data[k] = val
					data[k] = val
					break
				}
			}
		}
		debug("OK? %j (%j %j %j)", ok, k, val, types[i])

		if (!ok) delete data[k]
		return ok
	}

	function parse (args, data, remain, types, shorthands) {
		debug("parse", args, data, remain)

		var key = null;

		for (var i = 0; i < args.length; i ++) {
			var arg = args[i]
			debug("arg", arg)

			if (arg.match(/^-{2,}$/)) {
				// done with keys.
				// the rest are args.
				remain.push.apply(remain, args.slice(i + 1))
				args[i] = "--"
				break
			}
			if (arg.charAt(0) === "-") {
				if (arg.indexOf("=") !== -1) {
					var v = arg.split("=")
					arg = v.shift()
					v = v.join("=")
					args.splice.apply(args, [i, 1].concat([arg, v]))
				}
				// see if it's a shorthand
				// if so, splice and back up to re-parse it.
				arg = arg.replace(/^-+/, "")
				var no = false
				while (arg.toLowerCase().indexOf("no-") === 0) {
					no = !no
					arg = arg.substr(3)
				}

				var isArray = types[arg] === Array ||
					Array.isArray(types[arg]) && types[arg].indexOf(Array) !== -1

				var val
					, la = args[i + 1]

				var isBool = no ||
					types[arg] === Boolean ||
					Array.isArray(types[arg]) && types[arg].indexOf(Boolean) !== -1 ||
					(la === "false" &&
					 (types[arg] === null ||
						Array.isArray(types[arg]) && ~types[arg].indexOf(null)))

				if (isBool) {
					// just set and move along
					val = !no
					// however, also support --bool true or --bool false
					if (la === "true" || la === "false") {
						val = JSON.parse(la)
						la = null
						if (no) val = !val
						i ++
					}

					// also support "foo":[Boolean, "bar"] and "--foo bar"
					if (Array.isArray(types[arg]) && la) {
						if (~types[arg].indexOf(la)) {
							// an explicit type
							val = la
							i ++
						} else if ( la === "null" && ~types[arg].indexOf(null) ) {
							// null allowed
							val = null
							i ++
						} else if ( !la.match(/^-{2,}[^-]/) &&
												!isNaN(la) &&
												~types[arg].indexOf(Number) ) {
							// number
							val = +la
							i ++
						} else if ( !la.match(/^-[^-]/) && ~types[arg].indexOf(String) ) {
							// string
							val = la
							i ++
						}
					}

					if (isArray) (data[arg] = data[arg] || []).push(val)
					else data[arg] = val

					continue
				}

				if (la && la.match(/^-{2,}$/)) {
					la = undefined
					i --
				}

				val = la === undefined ? true : la
				if (isArray) (data[arg] = data[arg] || []).push(val)
				else data[arg] = val

				i ++
				continue
			}
			remain.push(arg)
		}
	}

})();