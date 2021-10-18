// $Id$

// Copyright (C) 2018 Yoshiro MIHIRA
// For license information, see LICENSE.txt

'use strict';

const rp = require("request-promise-native");
const timeout = 5 * 1000;

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
    const server_error_message = '記録に失敗しました。体重グラフのサーバが不調な可能性があります時間を置いてから試みてください。詳しくは体重グラフのウェブページを参照ください。';
    const daysYomi = [
	" 一日",
	"二日",
	"三日",
	"四日",
	"五日",
	"六日",
	"七日",
	"八日",
	"九日",
	"十日",
    ];

    var options = {
        method: 'POST',
        uri: "https://diet.dyndns.org/",
	timeout: timeout,
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
	timeout: timeout,
        headers: {
	    'Authorization': "Bearer " + accessToken,
        },
    };
    // check access Token
    return rp(options_check_accesstion).then((response) => {
        if (response == '{"isValid":false}') {
	    const message = "利用するために体重グラフでのアカウントのリンク設定をしてください。";
	    conv.close(message);
	    return;
        }
	var options_get_prev_weight = {
            method: 'GET',
            uri: "http://diet.dyndns.org/?cmd=weight_prev&count=10",
	    timeout: timeout,
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

	    if (res.data != undefined) {
		res.data.some(function(val, index) {
		    if (isNoon(val.timestamp*1000) == noonFlag) {
			prevDiff = val.diff;
			prevDays = parseInt(prevDiff / oneDay);
			prevHours = parseInt((prevDiff % oneDay) / 60 / 60);
			if (!(prevDays == 0 && prevHours == 0) &&
			    !(prevDays == 0 && prevHours <= 12)) {
			    prevWeight = val.weight;
			    return true;
			}
		    }
		});
	    }
	    if (prevWeight != 0) {
		var diffWeight = Math.round((weight - prevWeight)*10) * 100;
		if (Math.abs(diffWeight) >= 10*1000) {
		    const message = weight +"kgと前回から10kg以上の変化があります、もう一度、体重を教えてください。";
		    conv.ask(message);
		    return;
		}
		if (prevHours > 12) {
		    prevHours = 0;
		    prevDays = prevDays + 1;
		}
		if (prevDays <= 10) {
		    var diffMessage = daysYomi[prevDays - 1] +"前から"
		} else{
		    var diffMessage = prevDays + "前から"
		}
		if (diffWeight != 0) {
		    if (diffWeight > 0) {
			diffMessage = diffMessage + diffWeight +"グラム増えました。";
		    } else {
			diffMessage = diffMessage + diffWeight * (-1) +"グラム減りました。";
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
    }, (error) => {
	conv.close(server_error_message);
    });
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
	return;
    }

    weight = Number(weight);
    if (conv.user.access.token == null) {
        const message = "利用するために体重グラフでのアカウントのリンク設定をしてください。";
	conv.close(message);
	return;
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
	if (200 <= weight && weight < 1000) {
	    // 十桁目が0かを判断
	    // h = Hundreds place
	    var h = parseInt(weight / 100);
	    // t = Tens place
	    var t = weight - h * 100;
	    if (t < 10) {
		t = t * 10;
		t = Math.round(t);
		t = t / 10;
		weight = h * 10 + t;
	    }
	}
        if (1 <= weight && weight < 200) {
            return updateDiet(weight, accessToken, conv);
        }
        else {
            const message = '200キログラム以下に対応しています。もう一度、体重を教えてください。';
	    conv.ask(message);
        }
    }
})


exports.handler = app
