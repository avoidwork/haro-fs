"use strict";

const Promise = require("es6-promise").Promise;
const deferred = require("tiny-defer");
const fs = require("fs");
const mkdirp = require("mkdirp");
const path = require("path");
const tmp = require("os").tmpdir();
const cipher = require("tiny-cipher");
const none = "none";
const empty = "";

function dir (fp) {
	let defer = deferred();

	mkdirp(fp, function (e) {
		if (e) {
			defer.reject(e);
		} else {
			defer.resolve(true);
		}
	});

	return defer.promise;
}

function files (fp, key) {
	let defer = deferred(),
		regex = new RegExp("^" + key);

	fs.readdir(fp, function (e, args) {
		let results;

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

function isDir (fp) {
	let defer = deferred();

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

function readFile (fp, iv) {
	let defer = deferred();

	fs.readFile(fp, function (e, data) {
		let ldata;

		if (e) {
			defer.reject(e);
		} else {
			if (iv !== empty) {
				try {
					ldata = cipher(data, false, iv);
				} catch (e) {
					return defer.reject(e);
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

function read (fp, iv) {
	let defer = deferred();

	isDir(fp).then(function (dir) {
		let deferreds;

		if (dir) {
			files().then(function (args) {
				deferreds = args.map(function (i) {
					return readFile(i, iv);
				});

				Promise.all(deferreds).then(function (result) {
					defer.resolve(result);
				}, function (e) {
					defer.reject(e);
				})
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

function upsert (fp, arg) {
	let defer = deferred();

	fs.writeFile(fp, iv !== empty ? cipher(arg, true, iv) : JSON.stringify(arg, null, 0), function (e) {
		if (e) {
			defer.reject(e);
		} else {
			defer.resolve(true);
		}
	});

	return defer.promise;
}

function delFile (fp) {
	let defer = deferred();

	fs.unlinkFile(fp, function (e) {
		if (e) {
			defer.reject(e);
		} else {
			defer.resolve(true);
		}
	});

	return defer.promise;
}

function write (fp, iv, data) {
	let defer = deferred();

	isDir(fp).then(function (dir) {
		let deferreds;

		if (dir) {
			deferreds = data.map(function (i) {
				return upsert(fp, iv !== empty ? cipher(i, true, iv) : JSON.stringify(i, null, 0));
			});

			Promise.all(deferreds).then(function () {
				defer.resolve(true);
			}, function (e) {
				defer.reject(e);
			});
		} else {
			upsert(fp, iv !== empty ? cipher(data, true, iv) : JSON.stringify(data, null, 0)).then(function () {
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

function del (fp) {
	let defer = deferred();

	isDir(fp).then(function (dir) {
		if (dir) {
			files(fp).then(function (args) {
				let deferreds = args.map(function (i) {
					return delFile(i);
				});

				Promise.all(deferreds).then(function () {
					defer.resolve(true);
				}, function (e) {
					defer.reject(e);
				});
			}, function (e) {
				defer.reject(e);
			})
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

function adapter (store, op, key, data) {
	let defer = deferred(),
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
