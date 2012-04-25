var page = require('webpage').create(),
	system = require('system'),
	fs = require('fs'),
	pageLoaded = false;

function terminalError(msg) {
	if (window.colors) {
		console.error('[' + colors.lred('TERMINAL ERROR', true) + '] ' + msg);
	}
	else {
		console.error('[TERMINAL ERROR] ' + msg);
	}
	phantom.exit(1);
}

['lib/termcolors.js', 'lib/nopt.js'].forEach(function(filepath) {
	if ( !phantom.injectJs( filepath ) ) {
		terminalError("Failed to load " + filepath);
	}
});

var opts = (function() {
	var opts = {
		'width': 500
	};

	var args = nopt.nopt({
		'width': Number,
		'in': String
	}, {}, system.args, 1);

	for (var x in args) {
		opts[x] = args[x];
	}

	return opts;
})();

var css = fs.open(opts['in'], 'r').read();

page.onLoadFinished = function(status) {
	console.log(page.evaluate(
		(function() {
			var css = CSS,
				opts = OPTS,
				style = document.createElement('style'),
				cssTexts;

			function toArray(arrayLike) {
				return Array.prototype.slice.call(arrayLike, 0);
			}

			function getType(obj) {
				return Object.prototype.toString.call(obj).slice(8, -1);
			}

			function rulesText(rules) {
				return toArray( rules ).map(function(rule) {
					return rule.cssText;
				}).join("");
			}

			style.appendChild( document.createTextNode(css) );

			document.body.appendChild(style);

			cssTexts = toArray( document.styleSheets[0].cssRules ).map( function(rule) {
				if ( rule instanceof CSSMediaRule ) {
					var minWidth = /min-width:\s*([\d\.]+)([\w%]+)/.exec( rule.media.mediaText ),
						maxWidth = /max-width:\s*([\d\.]+)([\w%]+)/.exec( rule.media.mediaText );

					// TODO: unit conversion

					if ( minWidth ) {
						minWidth[1] = Number( minWidth[1] );
						return opts.width > minWidth[1] ? rulesText( rule.cssRules ) : '';
					}
					if ( maxWidth ) {
						maxWidth[1] = Number( maxWidth[1] );
						return opts.width < maxWidth[1] ? rulesText( rule.cssRules ) : '';
					}
				}
				else {
					return rule.cssText;
				}
			});
			return cssTexts.join('');
		}).toString().replace( 'CSS', JSON.stringify(css) ).replace( 'OPTS', JSON.stringify(opts) )
	));
};

page.content = '<!doctype html>';