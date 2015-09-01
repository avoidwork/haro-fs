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

var deferred = require("tiny-defer");
var fs = require("fs");
var mkdirp = require("mkdirp");
var path = require("path");
var tmp = require("os").tmpdir();
var cipher = require("tiny-cipher");
var none = "none";
var empty = "";

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

function isDir(fp) {
	var defer = deferred();

	fs.exists(fp, function (exists) {
		if (!exists) {
			defer.reject(new Error("Path not found"));
		} else {
			fs.lstat(fp, function (e, stats) {
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

function read(fp, enc, salt) {
	var defer = deferred();

	isDir(fp).then(function (dir) {
		if (dir) {} else {
			fs.readFile(fp, function (e, data) {
				var ldata = undefined;

				if (e) {
					defer.reject(e);
				} else {
					if (enc === none) {
						ldata = data;
					}

					try {
						defer.resolve(JSON.parse(ldata));
					} catch (err) {
						defer.reject(err);
					}
				}
			});
		}
	}, function (e) {
		defer.reject(e);
	});

	return defer.promise;
}

function write(fp, enc, salt, data) {
	var defer = deferred();

	isDir(fp).then(function (dir) {}, function (e) {
		defer.reject(e);
	});

	return defer.promise;
}

function del(fp) {
	var defer = deferred();

	isDir(fp).then(function (dir) {}, function (e) {
		defer.reject(e);
	});

	return defer.promise;
}

function adapter(store, op, key, data) {
	var defer = deferred(),
	    record = key !== undefined,
	    fpEnc = store.adapters.fs.encryption || none,
	    fpSalt = store.adapters.fs.salt || none,
	    fpDir = store.adapters.fs.directory || tmp,
	    prefix = store.id,
	    lkey = record ? prefix + "_" + key : empty;

	dir(fpDir).then(function () {
		if (op === "get") {
			read(path.join(fpDir, lkey), fpEnc, fpSalt).then(function (data) {
				defer.resolve(data);
			}, function (e) {
				defer.reject(e);
			});
		} else if (op === "remove") {
			del(path.join(fpDir, lkey)).then(function () {
				defer.resolve(true);
			}, function (e) {
				defer.reject(e);
			});
		} else if (op === "set") {
			write(path.join(fpDir, lkey), fpEnc, fpSalt, record ? data : store.toArray()).then(function () {
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
