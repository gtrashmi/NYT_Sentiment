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
var fs =require('fs');
var sklearn = require('scikit-learn');
var inspect = require('inspect-stream');
var arrayify = require('arrayify-merge.s');
var slice = require('slice-flow.s');

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

var mostPop = function(offset, callback) {
  request({method: 'GET', uri: 'http://api.nytimes.com/svc/mostpopular/v2/mostviewed/all-sections/30?api-key=316c0ea67fc13baeaa824914ebf812f5:16:71413601&offset='+offset, jar: true},   function (error, response, body) {
  	if (!error && response.statusCode == 200) {
  		console.log('NYT Popularity offset '+offset);
  		var obj = JSON.parse(body);
  		RESULTS = RESULTS.concat(obj.results);
  		callback();
  	} else throw error;
  });
};

// Extract content of articles
var extractContent = function(i, results, articles) {

  request({method: 'GET', uri: results[i].url, jar: true}, function (error, response, body) {
	  if (!error && response.statusCode == 200) {
		  var str = body;    
		  var $ = cheerio.load(str);
		  $('p').append(' ');
		  articles[i] = $('p').text();
		
		  console.log('GET '+i+'/'+results.length+' : '+results[i].url);
		
		  if(i == results.length-1) rankBySentiment(results, articles);

		  else extractContent(i+1, results, articles);
	  }
  });
};
	
// Useful function to sort an array according to a key in its objects
function sortByKey(array, key) {
    return array.sort(function(a, b) {
	var x = a[key], y = b[key];
	return ((x < y) ? -1 : ((x > y) ? 1 : 0));
    });
}
	
// Rank a list of articles according to the sentiment analysis
var rankBySentiment = function(results, articles) {
	var ranked = [];
	var table = "<table border=1><tr><td>Popularity rank</td><td>Sentiment rank</td><td>Sentiment score</td><td>Article URL</td></tr>";
	for(var i in articles){
		sentiment(articles[i], function (err, result) {
		
			console.log('P = '+i+', S = '+result.score);
			articles[i]={
				text:articles[i],
				popularityRank:i,
				sentimentRank:result.score
			};

			if(i ==	articles.length-1){
				ranked = sortByKey(articles, 'sentimentRank');
				for(var a in ranked) table+= "<tr><td>"+ranked[a].popularityRank+"</td><td>"+a+"</td><td>"+ranked[a].sentimentRank+"</td><td>"+results[ranked[a].popularityRank].url+"</td></tr>";
				table += "</table>";
				RES.send(table);
			}
		});
	}
};

app.get('/sentiment/:offset', function(req, res) {

  var offset = req.params.offset;
  RES = res;
  RESULTS = [];

	var functionstring = 'mostPop(0,';
	for(var i=20 ; i!=offset ; i+=20) functionstring += 'function(){mostPop('+i+',';
	functionstring += 'function(){extractContent(0,RESULTS,[]);';
	for(var i=20 ; i!=offset ; i+=20) functionstring += '})';
	functionstring += '});';
	
	console.log(functionstring);
	eval(functionstring);
	
	
});

var webExtractText = function(i,results,filename){
  var recursive = false;
  if(filename) recursive = true;
	if(typeof filename ==undefined){
	  filename = 'test.txt';
	  recursive = true;
	}
  request({method: 'GET', uri: 'http://access.alchemyapi.com/calls/url/URLGetTextSentiment?apikey=b57c92ce1fc89990843684e3ef445cba23c89b33&outputMode=json&url=' + results[i].url, jar: true}, function (error, response, body) {
	  if (!error && response.statusCode == 200) {
	    console.log('Request '+articles2.length+'/'+results.length+' OK');
    /*	var temp = JSON.parse(body);
	    var feeling =JSON.
	    console.log(feeling);*/
	    var json = JSON.parse(body);
	    //alscores[i] = json.docSentiment.score;
	
	    if(json.docSentiment)
		    articles2[i]={
			    popularityRank:i,
			    sentimentRank:json.docSentiment.score*1000000,
				url: results[i].url
		    };
	    else
      	articles2[i]={
			    popularityRank:0,
			    sentimentRank:0,
				url: ''
		    };
	

	    if(recursive && i != results.length-1) webExtractText(i+1,results,filename);
	    else if(recursive || (articles2.length == results.length && !ALCHEMY_STOP)){
	      ALCHEMY_STOP = true;
	      var ranked = [];
    		var table = "<table border=1><tr><td>Popularity rank</td><td>Alchemy rank</td><td>Alchemy score</td><td>Article URL</td></tr>";
    		ranked = sortByKey(articles2, 'sentimentRank');
		    for(var a in ranked) table+= "<tr><td>"+ranked[a].popularityRank+"</td><td>"+a+"</td><td>"+ranked[a].sentimentRank+"</td><td>"+results[ranked[a].popularityRank].url+"</td></tr>";
		    table += "</table>";
		    
		    
		    var x = [], y = [];
		    for(var a in ranked){
		      x.push(ranked[a].popularityRank);
		      y.push(ranked[a].sentimentRank);
		    }
		    
		    /*
		    RES.send('<style>'
        +'text {'
            +'font: 12px sans-serif;'
        +'}'
        +'svg {'
            +'display: block;'
        +'}'
        +'html, body, #chart1, svg {'
            +'margin: 0px;'
            +'padding: 0px;'
            +'height: 100%;'
            +'width: 100%;'
        +'}'
    +'</style><div id="chart1"></div>'
    +table+'<script src="https://cdnjs.cloudflare.com/ajax/libs/d3/3.5.2/d3.min.js" charset="utf-8"></script>'
    +'<script src="http://nvd3.org/assets/js/nv.d3.js"></script><script>var x='+JSON.stringify(x)+',y='+JSON.stringify(y)+';');
    */
	console.log('Just before the file creation');
	modelCreation(articles2,filename);
    RES.send(table);
	    }
	    //res.end(body);
	  }
	  else
	  {
		  console.log('Bad request');
		  console.log(response.statusCode)
	  }
  });

};


app.get('/alchemy/:offset', function(req, res) {

  var offset = req.params.offset;
  RES = res;
  RESULTS = [];
  ALCHEMY_STOP = false;
  articles2 = [];
  

	var functionstring = 'mostPop(0,';
	for(var i=20 ; i!=offset ; i+=20) functionstring += 'function(){mostPop('+i+',';
	functionstring += 'function(){for(var i in RESULTS) webExtractText(i,RESULTS);';
	for(var i=20 ; i!=offset ; i+=20) functionstring += '})';
	functionstring += '});';
	
	console.log(functionstring);
	eval(functionstring);
	
	
});

var articles2 = [];
var clf;

app.get('/alchemysentiment/', function(req, res) {

	// GET most viewed articles in JSON format from NYT API
	request({method: 'GET', uri: 'http://api.nytimes.com/svc/mostpopular/v2/mostviewed/all-sections/1?api-key=316c0ea67fc13baeaa824914ebf812f5:16:71413601', jar: true}, function (error, response, body) {
			if (!error && response.statusCode == 200) {
				console.log('Request was good');
				var obj = JSON.parse(body);
				//extractUrl(0,obj);
				for(var i in obj.results) webExtractText(i,obj);
				//webKeywordSentiment(0,obj);
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
	
	var webExtractText = function(i,obj){
		console.log('We are in the sentiment function');
		
		request({method: 'GET', uri: 'http://access.alchemyapi.com/calls/url/URLGetTextSentiment?apikey=b57c92ce1fc89990843684e3ef445cba23c89b33&outputMode=json&url=' + obj.results[i].url, jar: true}, function (error, response, body) {
			if (!error && response.statusCode == 200) {
				console.log('Request was good');

			/*	var temp = JSON.parse(body);
				var feeling =JSON.
				console.log(feeling);*/
				var json = JSON.parse(body);
				//alscores[i] = json.docSentiment.score;
				
				if(json.docSentiment)
  				articles2[i]={
  					popularityRank:i,
  					sentimentRank:json.docSentiment.score*1000000,
					url:obj.results[i].url
  				};
  			else
  		  	articles2[i]={
  					popularityRank:0,
  					sentimentRank:0,
					url:null
  				};
				
				
				
				if(articles2.length == obj.results.length){
				  var ranked = [];
      		var table = "<table border=1><tr><td>Popularity rank</td><td>Alchemy rank</td><td>Alchemy score</td><td>Article URL</td></tr>";
      		ranked = sortByKey(articles2, 'sentimentRank');
					for(var a in ranked) table+= "<tr><td>"+ranked[a].popularityRank+"</td><td>"+a+"</td><td>"+ranked[a].sentimentRank+"</td><td>"+obj.results[ranked[a].popularityRank].url+"</td></tr>";
					table += "</table>";
					console.log('We go trough here');
					modelCreation(articles2);
					res.send(table);
				}
				//res.end(body);
			}
			else
			{
				console.log('Bad request');
				console.log(response.statusCode)
			}
		});
		
	};
	
	var webKeywordSentiment = function(i,obj){
		console.log('We are in the sentiment function');
		
		request({method: 'GET', uri: 'http://access.alchemyapi.com/calls/url/URLGetRankedKeywords?apikey=b57c92ce1fc89990843684e3ef445cba23c89b33&outputMode=json&keywordExtractMode=strict&sentiment=1&url=' + obj.results[i].url, jar: true}, function (error, response, body) {
			if (!error && response.statusCode == 200) {
				console.log('Request was good');
				res.end(body);
			}
			else
			{
				console.log('Bad request');
				console.log(response.statusCode)
			}
		});
		
	};
	
});

app.get('/alchemyOnCrawled/:folder', function(req, res) {

	var folder = req.params.folder;
	console.log(typeof folder);
	console.log(folder);
	ALCHEMY_STOP = false;
	RES = res;
	articles2 = [];
	fs.readFile('Request_Responses/'+ folder +'/1Dviewed.txt','utf8',function(err,data){
		if(err){
			console.log('Not read');
			throw err;
		}
		else{
			console.log('File read');
			//console.log(typeof data);
			var popularList = JSON.parse(data);
			webExtractText(0,popularList.results, folder + '.txt');
			//modelCreation(articles2,'try.txt');
			//res.end(data);
		}
	});
});

var modelCreation = function(Articles, filename){
	console.log('Creation of file');
	var file = fs.openSync(filename,'w');
	console.log(Articles.length.toString());
	var data ="";
	for(var i =0; i < (Articles.length-1);i++){
		data = data + Articles[i].popularityRank + " " + Articles[i].sentimentRank + " " + Articles[i].url +  "\r\n";
	}
	fs.writeSync(file,data);
}

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
