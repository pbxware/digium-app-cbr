var app = require('app');

app.init();

// Include some utilities:
var util = require('util');

var screen = require('screen');

var wnd = null;

var onforeground_called = false;

// If app is already running it has true value:
var instantiated = false;

// Runtime gathered weather data:
var currency_data = {};

// Timer id of weather update request timeout
var timeout_request = null;

// 1min:
var DATA_ERROR_UPDATE_INT = 60000;

// 4h:
var DATA_UPDATE_INT = 14400000;

// Just a little workaround for IDE:
function endForegroundMonitor () {
	onforeground_called	= false;
}

// Parse xml weather data to object:

function parseCurrencyData (response) {
	var data = {}, nodes, l, i;

	var parser = new DOMParser();

	try {
		var doc = parser.parseFromString(response, 'application/xml');

		data.date = doc.getElementsByTagName('ValCurs')[0].getAttribute('Date');

		nodes = doc.getElementsByTagName('Valute');

		l = nodes.length;

		for (i = 0; i < l; i++) {
			// USD:
			if ('R01235' == nodes[i].getAttribute('ID')) {
				data.usd = nodes[i].getElementsByTagName('Value')[0].childNodes[0].nodeValue;
			}
			// EUR:
			if ('R01239' == nodes[i].getAttribute('ID')) {
				data.eur = nodes[i].getElementsByTagName('Value')[0].childNodes[0].nodeValue;
			}
		}
	}
	catch(e) {
		data = {error:true};
	}

	return data;
}

// Refresh widget contents on the idle display:
function idleRefresh () {
	if (currency_data.hasOwnProperty('today') &&
			currency_data.hasOwnProperty('tomorrow'))
	{
		wnd[0].label = 'Курсы валют от ЦБ';
		wnd[1].label = 'Сегодня:';
		wnd[2].label = currency_data.tomorrow.date + ' :';

		var diff = parseFloat(currency_data.tomorrow.usd.replace(',', '.')) -
			parseFloat(currency_data.today.usd.replace(',', '.'));

		wnd[4].label = currency_data.today.usd;
		wnd[5].label = diff.toFixed(4);
		wnd[6].label = currency_data.tomorrow.usd;

		diff = parseFloat(currency_data.tomorrow.eur.replace(',', '.')) -
			parseFloat(currency_data.today.eur.replace(',', '.'));

		wnd[8].label = currency_data.today.eur;
		wnd[9].label = diff.toFixed(4);
		wnd[10].label = currency_data.tomorrow.eur;
	}
}

// Function to finalize "get weather request"
function getCurrencyCb (data, today) {
	if (data.hasOwnProperty('error') && data.error) {
		wnd[0].label = 'Повторный запрос данных...';
		setTimeout(updateCurrencyData, DATA_ERROR_UPDATE_INT);
	}
	else {
		if (today)
			currency_data.today = data;
		else
			currency_data.tomorrow = data;

		idleRefresh();
	}
}

function padZeros(num, pad_count) {
	var s_num = num.toString();
	var s_off = s_num.length - 1;
	var result = [];
	var i, j;

	for (i = 0; i < pad_count; i++) {
		j = s_off - i;
		if ('undefined' !== typeof  s_num[j])
			result.push(s_num[j]);
		else
			result.push("0");
	}

	return result.reverse().join("");
}

// Get weather data from Gismeteo:
function getCurrency (cb) {
	wnd[0].label = 'Обновление данных ЦБ...';

	var currentDate = new Date();

	var request = new NetRequest();

	var date_req = padZeros(currentDate.getDate(), 2) + '.' +
		padZeros(currentDate.getMonth() + 1, 2) + '.' +
		currentDate.getFullYear();

	request.open('GET', 'http://www.cbr.ru/scripts/XML_daily.asp?date_req=' + date_req, true);

	request.onreadystatechange = function () {
		if (4 == request.readyState) {
			if (200 == request.status)
				cb(parseCurrencyData(request.responseText), true);
			else
				setTimeout(updateCurrencyData, DATA_ERROR_UPDATE_INT);
		}
	};

	request.send();

	var nextDate = new Date(currentDate.getTime() + 86410000);

	date_req = padZeros(nextDate.getDate(), 2) + '.' +
		padZeros(nextDate.getMonth() + 1, 2) + '.' +
		nextDate.getFullYear();

	// make second (sync) request for tomorrow data:

	var rq = new NetRequest();

	rq.open('GET', 'http://www.cbr.ru/scripts/XML_daily.asp?date_req=' + date_req, true);

	rq.onreadystatechange = function () {
		if (4 == rq.readyState) {
			if (200 == rq.status)
				cb(parseCurrencyData(rq.responseText), false);
			else
				setTimeout(updateCurrencyData, DATA_ERROR_UPDATE_INT);
		}
	};

	rq.send();

	clearTimeout(timeout_request);

	timeout_request = setTimeout(
		updateCurrencyData,
		DATA_UPDATE_INT
	);
}

// Function for usage in setTimeout func:
function updateCurrencyData () {
	getCurrency(getCurrencyCb);
}

// Idle window initialization and reference store;
function initialize () {
	var cursor = 0;

	wnd = digium.app.idleWindow;

	wnd.hideBottomBar = true;

	var header = new Text(0, Text.LINE_HEIGHT * cursor++, wnd.w, Text.LINE_HEIGHT);

	header.align(Widget.CENTER);

	wnd.add(header);

	if ('D70' == digium.phoneModel) {
		wnd.add(new Text(35, Text.LINE_HEIGHT * cursor, 50, Text.LINE_HEIGHT));
		wnd.add(new Text(125, Text.LINE_HEIGHT * cursor++, wnd.w - 125, Text.LINE_HEIGHT));

		wnd.add(new Text(0, Text.LINE_HEIGHT * cursor, 35, Text.LINE_HEIGHT, 'USD'));
		wnd.add(new Text(35, Text.LINE_HEIGHT * cursor, 50, Text.LINE_HEIGHT, '?'));
		wnd.add(new Text(85, Text.LINE_HEIGHT * cursor, 50, Text.LINE_HEIGHT));
		wnd.add(new Text(135, Text.LINE_HEIGHT * cursor++, 50, Text.LINE_HEIGHT));
		wnd.add(new Text(0, Text.LINE_HEIGHT * cursor, 35, Text.LINE_HEIGHT, 'EUR'));
		wnd.add(new Text(35, Text.LINE_HEIGHT * cursor, 50, Text.LINE_HEIGHT, '?'));
		wnd.add(new Text(85, Text.LINE_HEIGHT * cursor, 50, Text.LINE_HEIGHT));
		wnd.add(new Text(135, Text.LINE_HEIGHT * cursor, 50, Text.LINE_HEIGHT));
	}
	else {
		wnd.add(new Text(25, Text.LINE_HEIGHT * cursor, 40, Text.LINE_HEIGHT));
		wnd.add(new Text(98, Text.LINE_HEIGHT * cursor++, wnd.w - 98, Text.LINE_HEIGHT));
		wnd.add(new Text(0, Text.LINE_HEIGHT * cursor, 25, Text.LINE_HEIGHT, 'USD'));
		wnd.add(new Text(25, Text.LINE_HEIGHT * cursor, 40, Text.LINE_HEIGHT, '?'));
		wnd.add(new Text(65, Text.LINE_HEIGHT * cursor, 40, Text.LINE_HEIGHT));
		wnd.add(new Text(105, Text.LINE_HEIGHT * cursor++, 40, Text.LINE_HEIGHT));
		wnd.add(new Text(0, Text.LINE_HEIGHT * cursor, 25, Text.LINE_HEIGHT, 'EUR'));
		wnd.add(new Text(25, Text.LINE_HEIGHT * cursor, 40, Text.LINE_HEIGHT, '?'));
		wnd.add(new Text(65, Text.LINE_HEIGHT * cursor, 40, Text.LINE_HEIGHT));
		wnd.add(new Text(105, Text.LINE_HEIGHT * cursor, 40, Text.LINE_HEIGHT));
	}

	digium.app.exitAfterBackground = false;

	digium.event.observe({
		'eventName'	: 'digium.app.start',
		'callback'	: function () {
			setTimeout(function(){instantiated = true;}, 2000);
		}
	});

	digium.event.observe({
		'eventName'	: 'digium.app.idle_screen_show',
		'callback'	: function () {
			if (digium.app.idleWindowShown)
				idleRefresh();
		}
	});

	digium.event.observe({
		'eventName'	: 'digium.app.foreground',
		'callback'	: function () {
			// Stopping recursive call when error message box
			// should be shown by calling digium.foreground()
			if (onforeground_called) return ;

			onforeground_called = true;

			if (!instantiated) {
				digium.background();
				instantiated = true;
				endForegroundMonitor();
			}
			else {
				digium.app.exitAfterBackground = true;
				digium.background();
			}
		}
	});
}

// Initialize:
initialize();

// Start app main cycle:
updateCurrencyData();