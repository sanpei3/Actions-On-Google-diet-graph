// $Id$

// Copyright (C) 2018 Yoshiro MIHIRA
// For license information, see LICENSE.txt

'use strict';

const rp = require("request-promise-native");

// If you use node.js 8.10 and later, you must to set enviroment variable on lambda console
process.env.TZ = "Asia/Tokyo";


// Import the appropriate service and chosen wrappers
const {
    dialogflow,
    BasicCard,
    Button,
} = require('actions-on-google')

// Create an app instance
const app = dialogflow();

function isNoon(date) {
    var hour = new Date(date).getHours().toString();
    if (hour >= 5 && hour < 15) {
	return true;
    } else {
	return false;
    }
}


function updateDiet(weight, accessToken, conv) {

    var date = Date.now();
    var year = new Date(date).getFullYear().toString();
    var month = (new Date(date).getMonth() + 1).toString();
    var day = new Date(date).getDate().toString();
    var hour = new Date(date).getHours().toString();
    var message = null;
    var server_error_message = '記録に失敗しました。体重グラフのサーバが不調な可能性があります時間を置いてから試みてください';

    var options = {
        method: 'POST',
        uri: "https://diet.dyndns.org/",
        form: {
            'year': year,
            'month': month,
            'day': day,
            'hour': hour,
            'weight': weight,
            'comment': "",
            'cmd': "user",
            'mode': "input"
        },
        headers: {
            'Authorization': "Bearer " + accessToken,
        },
    };

    var options_check_accesstion = {
        method: 'GET',
        uri: "https://diet.dyndns.org/?cmd=oa2_isvalid",
        headers: {
	    'Authorization': "Bearer " + accessToken,
        },
    };
    // check access Token
    return rp(options_check_accesstion).then((response) => {
        if (response == '{"isValid":false}') {
	    const message = "利用するために体重グラフでのアカウントのリンク設定をしてください。";
	    conv.close(message);
        }
	var options_get_prev_weight = {
            method: 'GET',
            uri: "http://diet.dyndns.org/?cmd=weight_prev&count=10",
            headers: {
		'Authorization': "Bearer " + accessToken,
            },
	};

	return rp(options_get_prev_weight).then((response) => {
	    var res = JSON.parse(response);

	    var date = Date.now();
	    var noonFlag = isNoon(date);
	    var prevWeight = 0;
	    var prevDiff = 0;
	    var prevDays = 0;
	    var prevHours = 0;
	    var oneDay = 60*60*24;
	    var diffMessage = "";

	    res.data.some(function(val, index) {
		if (isNoon(val.timestamp*1000) == noonFlag) {
		    prevDiff = val.diff;
		    prevDays = parseInt(prevDiff / oneDay);
		    prevHours = parseInt((prevDiff % oneDay) / 60 / 60);

		    if (!(prevDays == 0 && prevHours == 0)) {
			prevWeight = val.weight;
			return true;
		    }
		}
	    });
	    if (prevWeight != 0) {
		var diffWeight = Math.round((weight - prevWeight)*10) * 100;
		if (prevDays > 0) {
		    var diffMessage = prevDays +"日前から"
		} else {
		    var diffMessage = prevHours+ "時間前から"
		}
		if (diffWeight != 0) {
		    if (diffWeight > 0) {
			diffMessage = diffMessage + diffWeight +"g増えました。";
		    } else {
			diffMessage = diffMessage + diffWeight * (-1) +"g減りました。";
		    }
		} else {
		    diffMessage = diffMessage + "変化はありませんでした。";
		}
	    }
	    return rp(options).then((response) => {
		if (response.match(/<p>ログアウトまたはタイムアウトしました。<\/p>/)) {
		    const message = "アカウントリンクの有効期限が切れているようです。アカウントリンクを再設定してください";
		    conv.close(message);
		}
		else if (response.match(/登録しました。<br>/)) {
		    message = weight + 'kg で記録しました。'+ diffMessage;
		    conv.close(message);
		    conv.close(new BasicCard({
			title: '体重グラフ',
			subtitle: 'グラフで確認しませんか?',
			buttons: new Button({
			    title: '体重グラフへ',
			    url: "https://diet.dyndns.org/?cmd=user",
			}),
			display: 'CROPPED'
		    }));
		}
		else {
		    conv.close(server_error_message);
		}
	    }, (error) => {
		conv.close(server_error_message);
	    });
	}, (error) => {
	    conv.close(server_error_message);
	});
    });
    conv.close(server_error_message);
}

function convertDotNumberStringToDotNumber(s, maxNumberOfDigit) {
    let dotWeight = Number(s);
    if (!isNaN(dotWeight)) {
        for (var i = 1; i <= maxNumberOfDigit; i++) {
            var p = Math.pow(10, i);
            if (dotWeight < p) {
                return dotWeight / p;
            }
        }
        return -1;
    }
    return 0;
}


app.intent('weight', (conv, { weight, dot_number }) => {
    var body = "";
    var accessToken = null;
    if (conv == null) {
        console.error('Unable to get body. Error JSON:', conv.body);
        const message = "不正なリクエストです。終了します。";
	conv.close(message);
    }

    weight = Number(weight);
    if (conv.user.access.token == null) {
        const message = "利用するために体重グラフでのアカウントのリンク設定をしてください。";
	conv.close(message);
    } else {
	accessToken = conv.user.access.token;
    }
    if (weight == undefined) {
        const message = 'すみません、聞き取れませんでした。もう一度、体重を教えてください。';
	conv.ask(message);
    }
    else {
        if (dot_number != undefined) {
	    var dotNumber = convertDotNumberStringToDotNumber(dot_number, 1);
	    if (dotNumber == -1) {
		const message = '小数点以下は一桁までの対応です。もう一度、体重を教えてください。';
		conv.ask(message);
            } else {
		weight = weight + dotNumber;
	    }
	}
        if (1 <= weight && weight <= 600) {
            return updateDiet(weight, accessToken, conv);
        }
        else {
            const message = '600キログラム以下に対応しています。もう一度、体重を教えてください。';
	    conv.ask(message);
        }
    }
})


exports.handler = app
