/**
 * File system persistent storage adapter for Harō
 *
 * @author Jason Mulligan <jason.mulligan@avoidwork.com>
 * @copyright 2015 Jason Mulligan <jason.mulligan@avoidwork.com>
 * @license BSD-3-Clause
 * @link https://github.com/avoidwork/haro-fs
 * @version 1.0.0
 */
"use strict";

var Promise = require("es6-promise").Promise;
var deferred = require("tiny-defer");
var fs = require("fs");
var mkdirp = require("mkdirp");
var path = require("path");
var tmp = require("os").tmpdir();
var cipher = require("tiny-cipher");
var empty = "";

function filename(prefix, key) {
	return prefix + "_" + key + ".json";
}

function prepare(iv, arg) {
	return iv !== empty ? cipher(arg, true, iv) : JSON.stringify(arg, null, 0);
}

function dir(fp) {
	var defer = deferred();

	mkdirp(fp, function (e) {
		if (e) {
			defer.reject(e);
		} else {
			defer.resolve(true);
		}
	});

	return defer.promise;
}

function delFile(fp) {
	var defer = deferred();

	fs.unlink(fp, function (e) {
		if (e) {
			defer.reject(e);
		} else {
			defer.resolve(true);
		}
	});

	return defer.promise;
}

function files(fp, prefix) {
	var defer = deferred(),
	    regex = new RegExp("^" + prefix);

	fs.readdir(fp, function (e, args) {
		var results = undefined;

		if (e) {
			defer.reject(e);
		} else {
			results = args.filter(function (i) {
				return regex.test(i);
			});
			defer.resolve(results);
		}
	});

	return defer.promise;
}

function isDir(fp) {
	var defer = deferred();

	fs.exists(fp, function (exists) {
		if (!exists) {
			defer.resolve(false);
		} else {
			fs.stat(fp, function (e, stats) {
				if (e) {
					defer.reject(e);
				} else {
					defer.resolve(stats.isDirectory());
				}
			});
		}
	});

	return defer.promise;
}

function readFile(fp, iv) {
	var defer = deferred();

	fs.readFile(fp, { encoding: "utf8" }, function (e, data) {
		var ldata = undefined;

		if (e) {
			defer.reject(e);
		} else {
			if (iv !== empty) {
				try {
					ldata = cipher(data, false, iv);
				} catch (err) {
					return defer.reject(err);
				}
			} else {
				ldata = data;
			}

			try {
				defer.resolve(JSON.parse(ldata));
			} catch (err) {
				defer.reject(err);
			}
		}
	});

	return defer.promise;
}

function read(fp, prefix, iv) {
	var defer = deferred();

	isDir(fp).then(function (d) {
		var deferreds = undefined;

		if (d) {
			files(fp, prefix).then(function (args) {
				deferreds = args.map(function (i) {
					return readFile(path.join(fp, i), iv);
				});

				Promise.all(deferreds).then(function (result) {
					defer.resolve(result);
				}, function (e) {
					defer.reject(e);
				});
			}, function (e) {
				defer.reject(e);
			});
		} else {
			readFile(fp, iv).then(function (arg) {
				defer.resolve(arg);
			}, function (e) {
				defer.reject(e);
			});
		}
	}, function (e) {
		defer.reject(e);
	});

	return defer.promise;
}

function upsert(fp, arg) {
	var defer = deferred();

	fs.writeFile(fp, arg, function (e) {
		if (e) {
			defer.reject(e);
		} else {
			defer.resolve(true);
		}
	});

	return defer.promise;
}

function write(fp, prefix, key, iv, data) {
	var defer = deferred();

	isDir(fp).then(function (d) {
		var deferreds = undefined;

		if (d) {
			deferreds = data.map(function (i) {
				return upsert(path.join(fp, filename(prefix, i[key])), prepare(iv, JSON.stringify(i, null, 0)));
			});

			Promise.all(deferreds).then(function () {
				defer.resolve(true);
			}, function (e) {
				defer.reject(e);
			});
		} else {
			upsert(fp, prepare(iv, JSON.stringify(data, null, 0))).then(function () {
				defer.resolve(true);
			}, function (e) {
				defer.reject(e);
			});
		}
	}, function (e) {
		defer.reject(e);
	});

	return defer.promise;
}

function del(fp, prefix) {
	var defer = deferred();

	isDir(fp).then(function (d) {
		if (d) {
			files(fp, prefix).then(function (args) {
				var deferreds = args.map(function (i) {
					return delFile(path.join(fp, i));
				});

				Promise.all(deferreds).then(function () {
					defer.resolve(true);
				}, function (e) {
					defer.reject(e);
				});
			}, function (e) {
				defer.reject(e);
			});
		} else {
			delFile(fp).then(function () {
				defer.resolve(true);
			}, function (e) {
				defer.reject(e);
			});
		}
	}, function (e) {
		defer.reject(e);
	});

	return defer.promise;
}

function adapter(store, op, key, data) {
	var defer = deferred(),
	    record = key !== undefined,
	    iv = store.adapters.fs.iv || empty,
	    fpDir = store.adapters.fs.directory || tmp,
	    prefix = store.id,
	    lkey = record ? filename(prefix, key) : empty;

	dir(fpDir).then(function () {
		if (op === "get") {
			read(path.join(fpDir, lkey), prefix, iv).then(function (result) {
				defer.resolve(result);
			}, function (e) {
				defer.reject(e);
			});
		} else if (op === "remove") {
			del(path.join(fpDir, lkey), prefix).then(function () {
				defer.resolve(true);
			}, function (e) {
				defer.reject(e);
			});
		} else if (op === "set") {
			write(path.join(fpDir, lkey), prefix, store.key, iv, record ? data : store.toArray()).then(function () {
				defer.resolve(true);
			}, function (e) {
				defer.reject(e);
			});
		}
	}, function (e) {
		defer.reject(e);
	});

	return defer.promise;
}

module.exports = adapter;
