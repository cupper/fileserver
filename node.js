var HTTP = require("http");
var MIME = require("mime");
var URL = require("url");
var FS = require("fs");

var INDEX_PAGE = '/';
var ROOT_DIRECTORY = "/~";

/*
 * Keeps handlers for GET, PUT, DELETE methonds 
 */
var METHODS = {};

/*
 * Setup the folder for file server
 */
var STORAGE = process.argv[2];
try {
  function badStorage() {
    console.log("Couldn't start file server for folder: " + STORAGE);
    process.exit(1);
  }
  if (!FS.statSync(STORAGE).isDirectory()) {
    badStorage(STORAGE);
  }
} catch (error) {
  badStorage(STORAGE);
}

function methodNotAlloved(name) {
  return "Method " + name + " not allowed";
}

function urlToPath(url) {
  var path = URL.parse(url).pathname;
  return STORAGE + decodeURIComponent(path);
}

function returnIndexPage(response) {
  FS.readFile("index.html", "utf8", function (error, text) {
    if (error) {
      response.end("Sorry can't find index page: " + error.toString());
    } else {
      response.end(text);
    }
  });
}

HTTP.createServer(function (request, response) {
  var method = request.method;
  console.log("[" + method + "] " + request.url);
  function respond(code, body, type) {
    if (!type) {
      type = "text/plain";
    }
    response.writeHead(code, {"Conten-Type": type});
    if (body && body.pipe) {
      body.pipe(response);
    } else {
      response.end(body);
    }
  }

  if (request.url === INDEX_PAGE) {
    returnIndexPage(response);
  } else if (request.url === ROOT_DIRECTORY) {
    METHODS.GET(STORAGE, respond, request);
  } else if (METHODS.hasOwnProperty(method)) {
    METHODS[method](urlToPath(request.url), respond, request);
  } else {
    respond(405, methodNotAlloved(method));
  }
}).listen(8000);

// Define Methods
function isFileNotExist(error) {
  return error && error.code === "ENOENT";
}

METHODS.GET = function (path, respond) {
  FS.stat(path, function (error, stats) {
    if (isFileNotExist(error)) {
      respond(404, "File not found");
    } else if (error) {
      respond(500, error.toString());
    } else if (stats.isDirectory()) {
      FS.readdir(path, function (error, files) {
        if (error) {
          respond(500, error.toString());
        } else {
          respond(200, files.join("<br>"));
        }
      });
    } else {
      respond(200, FS.createReadStream(path), MIME.lookup(path));
    }
  });
};

function respondErrorOrNothing(respond) {
  return function (error) {
    if (error) {
      respond(500, error.toString());
    } else {
      respond(204);
    }
  };
}

METHODS.DELETE = function (path, respond) {
  FS.stat(path, function (error, stats) {
    if (isFileNotExist(error)) {
      respond(204);
    } else if (error) {
      respond(500, error.toString());
    } else if (stats.isDirectory()) {
      FS.rmdir(path, respondErrorOrNothing(respond));
    } else {
      FS.unlink(path, respondErrorOrNothing(respond));
    }
  });
};

METHODS.PUT = function (path, respond, request) {
  var outStream = FS.createWriteStream(path);
  outStream.on("error", function (error) {
    respond(500, error.toString());
  });
  outStream.on("finish", function () {
    respond(204);
  });
  request.pipe(outStream);
};
