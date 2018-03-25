// $Id$

// Copyright (C) 2018 Yoshiro MIHIRA
// For license information, see LICENSE.txt

'use strict';

const rp = require("request-promise");

process.env.TZ = "Asia/Tokyo";

const build_callback_data = (message) => {
    const json = {
        speech: message,
        displayText: message
    };

    return JSON.stringify(json);
};

function updateDiet(weight, accessToken, callback) {

    var date = Date.now();
    var year = new Date(date).getFullYear().toString();
    var month = (new Date(date).getMonth() +1).toString();
    var day = new Date(date).getDate().toString();
    var hour = new Date(date).getHours().toString();
    var message = null;
    
    var options = {
        method: 'POST',
	uri: "https://diet.dyndns.org/",
	form: {
	    'year' : year,
	    'month' : month,
	    'day' : day,
	    'hour' : hour,
	    'weight' : weight,
	    'comment' : "",
	    'cmd' : "user",
	    'mode' : "input"
	},
        headers: {
            'Authorization': "Bearer " + accessToken, 
        },
    };
    
    rp(options).then((response) => {
	//self.attributes['serverError'] = 0;
	message = weight + 'kg で記録しました。';
	callback(null, {
            "statusCode": 200, 
            "body": build_callback_data(message)
        });
    }, (error) => {
        message = '記録に失敗しました。体重グラフのサーバが不調な可能性があります時間を置いてから試みてください';
        callback(null, {
            "statusCode": 200, 
            "body": build_callback_data(message)
        });
	
    });
}

exports.handler = (event, context, callback) => {
    var body = "";
    var weight = null;
    var accessToken = null;
    if(event.body == null) {
        console.error('Unable to get body. Error JSON:', event);
        const message = "不正なリクエストです。終了します。";
        callback(null, {
            "statusCode": 200, 
            "body": build_callback_data(message)
        });
    }

    body = JSON.parse(event.body);
    weight = Number(body.result.parameters.weight);
    accessToken = body.originalRequest.data.user.accessToken;

    if (accessToken == null) {
        const message = "利用するために体重グラフでのアカウントのリンク設定をしてください。";
        callback(null, {
            "statusCode": 200, 
            "body": build_callback_data(message)
        });
    }
    
    if (weight == undefined) {
        const message = 'すいません、聞き取れませんでした。もう一度、体重を教えてください。';
        callback(null, {
            "statusCode": 200, 
            "body": build_callback_data(message)
        });
    } else {
        if ( 1 <= weight && weight <= 600 ) {
            updateDiet(weight, accessToken, callback);
            return;
        } else {
            const message = '600キログラム以下に対応しています。もう一度、体重を教えてください。';
            callback(null, {
		"statusCode": 200, 
		"body": build_callback_data(message)
            });
	}
    }
};
