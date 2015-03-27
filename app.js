var express = require('express');
var sentiment = require('sentiment');
var http = require('follow-redirects').http;
var request = require('request');
var path = require('path');
var cheerio = require('cheerio');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var alchemyApi = require('alchemy-api');
var alchemy = new alchemyApi('b57c92ce1fc89990843684e3ef445cba23c89b33');

var routes = require('./routes/index');
var users = require('./routes/users');


var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// uncomment after placing your favicon in /public
//app.use(favicon(__dirname + '/public/favicon.ico'));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', routes);
app.use('/users', users);




app.get('/hello', function(req, res) {
    res.send("Hello world.");
});

app.get('/testSentiment',
    function (req, res) {
        var response = "<HEAD>" +
          "<title>Twitter Sentiment Analysis</title>\n" +
          "</HEAD>\n" +
          "<BODY>\n" +
          "<P>\n" +
          "Welcome to the Twitter Sentiment Analysis app.  " +   
          "What phrase would you like to analzye?\n" +                
          "</P>\n" +
          "<FORM action=\"/testSentiment\" method=\"get\">\n" +
          "<P>\n" +
          "Enter a phrase to evaluate: <INPUT type=\"text\" name=\"phrase\"><BR>\n" +
          "<INPUT type=\"submit\" value=\"Send\">\n" +
          "</P>\n" +
          "</FORM>\n" +
          "</BODY>";
        var phrase = req.query.phrase;
        if (!phrase) {
            res.send(response);
        } else {
            sentiment(phrase, function (err, result) {
                response = 'sentiment(' + phrase + ') === ' + result.score;
                res.send(response);
            });
        }
    });

app.get('/sentiment/:apiPath', function(req, res) {

	// GET most viewed articles in JSON format from NYT API
	var apiReq = http.request({
		hostname: 'api.nytimes.com',
		//path: req.params.apiPath,
		path: '/svc/mostpopular/v2/mostviewed/all-sections/1?api-key=316c0ea67fc13baeaa824914ebf812f5:16:71413601',
		port: 80,
		method: 'GET',
		headers: {
			'Content-Type': 'application/json'
		}
	}, function(apiRes) {
		var output = '';
		console.log('API query: '+apiRes.statusCode);
		apiRes.setEncoding('utf8');

		apiRes.on('data', function (chunk) {
		    output += chunk;
		});

		apiRes.on('end', function() {
		    var obj = JSON.parse(output);
		    extractContent(0, obj, []);
		});
	} );
	
	// Extract content of articles
	//var articles = [];
	var extractContent = function(i, obj, articles) {
	
	request({method: 'GET', uri: obj.results[i].url, jar: true}, function (error, response, body) {
		if (!error && response.statusCode == 200) {
			var str = body;    
			var $ = cheerio.load(str);
			$('p').append(' ');
			articles[i] = $('p').text();
			
			console.log('GET '+obj.results[i].url);
			
			//if(i==0) res.end(articles[0]);
			//var dummy = document.createElement('div');
			//dummy.innerHTML = str;
			//var paragraphs = dummy.getElementsByTagName('p');
			//articles[i] = "";
			//for(var p in paragraphs) articles[i]+=p.innerHTML+' ';
			
			if(i == obj.results.length-1) rankBySentiment(obj, articles);
			//else if(articleRes.statusCode == 303) extractContent(i, obj);
			else extractContent(i+1, obj, articles);
		}
	})
	
/*
		var articleReq = http.request({
			hostname: 'www.nytimes.com',
		 	path: obj.results[i].url.split('.com')[1],
		 	port: 80,
		 	method: 'GET',
		 	headers: {
				'Content-Type': 'text/html'
			}
		 }, function(articleRes) {
		 	var output = '';
			console.log('Article query: www.nytimes.com'+obj.results[i].url.split('.com')[1]+' : '+articleRes.statusCode);
			articleRes.setEncoding('utf8');

			articleRes.on('data', function (chunk) {
			    output += chunk;
			});

			articleRes.on('end', function() {
			    var str = output.toString();
			    var $ = cheerio.load(str);
			    $('p').append(' ');
			    articles[i] = $('p').text();
			    if(i==0) console.log(str);
			    //var dummy = document.createElement('div');
			    //dummy.innerHTML = str;
			    //var paragraphs = dummy.getElementsByTagName('p');
			    //articles[i] = "";
			    //for(var p in paragraphs) articles[i]+=p.innerHTML+' ';
			    
			    if(i == obj.results.length-1) rankBySentiment(articles);
			    //else if(articleRes.statusCode == 303) extractContent(i, obj);
			    else extractContent(i+1, obj);
			});
		 });
		 articleReq.end();
		 
		 
*/
	};
	
	// Useful function to sort an array according to a key in its objects
	function sortByKey(array, key) {
	    return array.sort(function(a, b) {
		var x = a[key], y = b[key];
		return ((x < y) ? -1 : ((x > y) ? 1 : 0));
	    });
	}
	
	// Rank a list of articles according to the sentiment analysis
	var rankBySentiment = function(obj, articles) {
		var ranked = [];
		var table = "<table border=1><tr><td>Popularity rank</td><td>Sentiment rank</td><td>Article URL</td></tr>";
		for(var i in articles){
			sentiment(articles[i], function (err, result) {
			
				console.log('P = '+i+', S = '+result.score);
				articles[i]={
					text:articles[i],
					popularityRank:i,
					sentimentRank:result.score
				};
				
			
				//table += "<tr><td>"+i+"</td><td>"+result.score+"</td><td>"+obj.results[i].url+"</td></tr>";
				
				if(i ==	articles.length-1){
					ranked = sortByKey(articles, 'sentimentRank');
					for(var a in ranked) table+= "<tr><td>"+ranked[a].popularityRank+"</td><td>"+a+"</td><td>"+obj.results[ranked[a].popularityRank].url+"</td></tr>";
					table += "</table>";
					res.send(table);
				}
			});
		}
	};
	
	apiReq.end();
});


app.get('/alchemysentiment/', function(req, res) {

	// GET most viewed articles in JSON format from NYT API
	request({method: 'GET', uri: 'http://api.nytimes.com/svc/mostpopular/v2/mostviewed/all-sections/1?api-key=316c0ea67fc13baeaa824914ebf812f5:16:71413601', jar: true}, function (error, response, body) {
			if (!error && response.statusCode == 200) {
				console.log('Request was good');
				var obj = JSON.parse(body);
				extractUrl(2,obj);
			}
			else
			{
				console.log('Bad request');
				console.log(response.statusCode)
			}
		});
	var extractUrl = function(i,obj){
	
		console.log('We are in the sentiment function');
		console.log(obj.results[i].url);
		alchemy.sentiment('html',obj.results[i].url,function(err,response){
			if(err) {
				throw err;
			}
			console.log('Good Request');
			console.log("Sentiment: " + response["docSentiment"]["type"]);
			res.end("Sentiment: " + response["docSentiment"]["type"] + " \nScore: " + response["docSentiment"]["score"]);
		});
	};
	
});

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
      message: err.message,
      error: err
    });
  });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: {}
  });
});


module.exports = app;
