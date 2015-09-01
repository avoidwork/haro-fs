"use strict";

const Promise = require("es6-promise").Promise;
const deferred = require("tiny-defer");
const fs = require("fs");
const mkdirp = require("mkdirp");
const path = require("path");
const tmp = require("os").tmpdir();
const cipher = require("tiny-cipher");
const empty = "";

function filename (prefix, key) {
	return prefix + "_" + key + ".json";
}

function prepare (iv, arg) {
	return iv !== empty ? cipher(arg, true, iv) : JSON.stringify(arg, null, 0);
}

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

function delFile (fp) {
	let defer = deferred();

	fs.unlink(fp, function (e) {
		if (e) {
			defer.reject(e);
		} else {
			defer.resolve(true);
		}
	});

	return defer.promise;
}

function files (fp, prefix) {
	let defer = deferred(),
		regex = new RegExp("^" + prefix);

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

function readFile (fp, iv) {
	let defer = deferred();

	fs.readFile(fp, {encoding: "utf8"}, function (e, data) {
		let ldata;

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

function read (fp, prefix, iv) {
	let defer = deferred();

	isDir(fp).then(function (d) {
		let deferreds;

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

function upsert (fp, arg) {
	let defer = deferred();

	fs.writeFile(fp, arg, function (e) {
		if (e) {
			defer.reject(e);
		} else {
			defer.resolve(true);
		}
	});

	return defer.promise;
}


function write (fp, prefix, key, iv, data) {
	let defer = deferred();

	isDir(fp).then(function (d) {
		let deferreds;

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

function del (fp, prefix) {
	let defer = deferred();

	isDir(fp).then(function (d) {
		if (d) {
			files(fp, prefix).then(function (args) {
				let deferreds = args.map(function (i) {
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

function adapter (store, op, key, data) {
	let defer = deferred(),
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
