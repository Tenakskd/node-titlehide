var url = require('url');
var querystring = require('querystring');
var express = require('express');
var Unblocker = require('unblocker');
var Transform = require('stream').Transform;
var youtube = require('unblocker/examples/youtube/youtube.js')

var app = express();

var google_analytics_id = process.env.GA_ID || null;

function addGa(html) {
    if (google_analytics_id) {
        var ga = [
            "<script type=\"text/javascript\">",
            "var _gaq = []; // overwrite the existing one, if any",
            "_gaq.push(['_setAccount', '" + google_analytics_id + "']);",
            "_gaq.push(['_trackPageview']);",
            "(function() {",
            "  var ga = document.createElement('script'); ga.type = 'text/javascript'; ga.async = true;",
            "  ga.src = ('https:' == document.location.protocol ? 'https://ssl' : 'http://www') + '.google-analytics.com/ga.js';",
            "  var s = document.getElementsByTagName('script')[0]; s.parentNode.insertBefore(ga, s);",
            "})();",
            "</script>"
        ].join("\n");
        html = html.replace("</body>", ga + "\n\n</body>");
    }
    return html;
}

function googleAnalyticsMiddleware(data) {
    if (data.contentType == 'text/html') {
        data.stream = data.stream.pipe(new Transform({
            decodeStrings: false,
            transform: function(chunk, encoding, next) {
                this.push(addGa(chunk.toString()));
                next();
            }
        }));
    }
}

function fixTitle(html) {
    const fixedTitle = "<title>scratch入門！</title>";
    return html.replace(/<title>.*<\/title>/, fixedTitle);
}

function titleMiddleware(data) {
    if (data.contentType == 'text/html') {
        data.stream = data.stream.pipe(new Transform({
            decodeStrings: false,
            transform: function(chunk, encoding, next) {
                this.push(fixTitle(chunk.toString())); // タイトルを固定
                next();
            }
        }));
    }
}

var unblockerConfig = {
    prefix: '/proxy/',
    requestMiddleware: [
        youtube.processRequest
    ],
    responseMiddleware: [
        googleAnalyticsMiddleware,
        titleMiddleware // タイトル固定用のミドルウェア
    ]
};

var unblocker = new Unblocker(unblockerConfig);

app.use(unblocker);

app.use('/', express.static(__dirname + '/public'));

app.get("/no-js", function(req, res) {
    var site = querystring.parse(url.parse(req.url).query).url;
    res.redirect(unblockerConfig.prefix + site);
});

const port = process.env.PORT || process.env.VCAP_APP_PORT || 8080;

app.listen(port, function() {
    console.log(`node unblocker process listening at http://localhost:${port}/`);
}).on("upgrade", unblocker.onUpgrade);
