var adapter = require("../lib/haro-fs.js"),
	haro = require("haro"),
	fs = require("fs"),
	Promise = require("es6-promise").Promise,
	deferred = require("tiny-defer"),
	path = require("path"),
	data = [{guid: "abc", yay: true}, {guid: "def", yay: false}],
	config = {key: "guid", logging: false, adapters: {fs: {directory: "/tmp", iv: ""}}, versioning: false};

function clone (arg) {
	return JSON.parse(JSON.stringify(arg));
}

exports["get - datastore"] = {
	setUp: function (done) {
		var self = this,
			deferreds, fp;

		this.data = clone(data);
		this.store = haro(null, config);
		this.store.register("fs", adapter);

		fp = path.join(this.store.adapters.fs.directory, this.store.id);
		deferreds = this.data.map(function (i) {
			var defer = deferred();

			fs.writeFile(fp + "_" + i[self.store.key] + ".json", JSON.stringify(i, null, 0), function (e) {
				if (e) {
					defer.reject(e);
				} else {
					defer.resolve(true);
				}
			});

			return defer.promise;
		});

		Promise.all(deferreds).then(function () {
			done();
		}, function (e) {
			done(e);
		});
	},
	test: function (test) {
		var self = this;

		test.expect(2);
		test.equal(this.store.total, 0, "Should be 0");
		this.store.load("fs").then(function () {
			test.equal(self.store.total, 2, "Should be 2");
			test.done();
		}, function (e) {
			console.log(e.stack);
			test.done();
		});
	}
};

exports["get - record"] = {
	setUp: function (done) {
		var defer = deferred();

		this.data = clone(data);
		this.store = haro(null, config);
		this.store.register("fs", adapter);

		fp = path.join(this.store.adapters.fs.directory, this.store.id);
		fs.writeFile(fp + "_" + this.data[0][this.store.key] + ".json", JSON.stringify(this.data[0], null, 0), function (e) {
			if (e) {
				defer.reject(e);
			} else {
				defer.resolve(true);
			}
		});

		defer.promise.then(function () {
			done();
		}, function (e) {
			done(e);
		});
	},
	test: function (test) {
		var self = this,
			fp = path.join(this.store.adapters.fs.directory, this.store.id + "_" + this.data[0].guid + ".json"),
			result = JSON.parse(fs.readFileSync(fp));

		test.expect(3);
		test.equal(this.store.total, 0, "Should be 0");
		test.equal(result.guid, this.data[0].guid, "Should match");
		this.store.load("fs", result.guid).then(function () {
			test.equal(self.store.total, 1, "Should be 1");
			return self.store.unload("fs");
		}, function () {
			test.done();
		}).then(function () {
			test.done();
		}, function () {
			test.done();
		});
	}
};

exports["set - datastore"] = {
	setUp: function (done) {
		this.data = clone(data);
		this.store = haro(null, config);
		this.store.register("fs", adapter);
		this.store.id = 'verify';
		done();
	},
	test: function (test) {
		var self = this;

		test.expect(2);
		test.equal(this.store.total, 0, "Should be 0");
		this.store.batch(this.data, "set").then(function () {
			test.equal(self.store.total, 2, "Should be 2");
			return self.store.save("fs");
		}, function (e) {
			throw e;
		}).then(function () {
			return self.store.unload("fs");
		}, function (e) {
			throw e;
		}).then(function () {
			test.done();
		}, function () {
			test.done();
		});
	}
};

exports["set - record"] = {
	setUp: function (done) {
		var self = this,
			deferreds, fp;

		this.data = clone(data);
		this.store = haro(null, config);
		this.store.register("fs", adapter);

		fp = path.join(this.store.adapters.fs.directory, this.store.id);
		deferreds = this.data.map(function (i) {
			var defer = deferred();

			fs.writeFile(fp + "_" + i[self.store.key] + ".json", JSON.stringify(i, null, 0), function (e) {
				if (e) {
					defer.reject(e);
				} else {
					defer.resolve(true);
				}
			});

			return defer.promise;
		});

		Promise.all(deferreds).then(function () {
			done();
		}, function (e) {
			done(e);
		});
	},
	test: function (test) {
		var self = this;

		test.expect(2);
		test.equal(this.store.total, 0, "Should be 0");
		this.store.load("fs").then(function () {
			test.equal(self.store.total, 2, "Should be 2");
			return self.store.set(null, {guid: "ghi", yay: true});
		}, function (e) {
			test.done(e);
		}).then(function () {
			test.done();
		}, function (e) {
			console.log(e.stack);
			test.done(e);
		});
	}
};

exports["remove - record"] = {
	setUp: function (done) {
		var self = this,
			deferreds, fp;

		this.data = clone(data);
		this.store = haro(null, config);
		this.store.id = "remove";
		this.store.register("fs", adapter);

		fp = path.join(this.store.adapters.fs.directory, this.store.id);
		deferreds = this.data.map(function (i) {
			var defer = deferred();

			fs.writeFile(fp + "_" + i[self.store.key] + ".json", JSON.stringify(i, null, 0), function (e) {
				if (e) {
					defer.reject(e);
				} else {
					defer.resolve(true);
				}
			});

			return defer.promise;
		});

		Promise.all(deferreds).then(function () {
			done();
		}, function (e) {
			done(e);
		});
	},
	test: function (test) {
		var self = this;

		test.expect(3);
		test.equal(this.store.total, 0, "Should be 0");
		this.store.load("fs").then(function () {
			test.equal(self.store.total, 2, "Should be 2");
			return self.store.del("abc");
		}, function (e) {
			test.done(e);
		}).then(function () {
			test.equal(self.store.total, 1, "Should be 1");
			test.done();
		}, function (e) {
			console.log(e.stack);
			test.done(e);
		});
	}
};