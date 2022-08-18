import axios from "axios";
import { EventData, EventRanking } from "./Struct";
import { readFileSync, writeFileSync } from "fs";
import HttpsProxyAgent from 'https-proxy-agent';

let agent = HttpsProxyAgent('http://localhost:1087');

let proxy = false;
let debug = process.env.IS_DEBUG || false;
let event = 9;
let days = 8;
let eventStartTime = 0;
//let lastDayEnd = 0;
let eventType = "marathon";

let debugJson: Record<string, any> = {
    ranks: {}
};

async function updateEvent() {
    const response = await axios.get(
        `https://strapi.sekai.best/sekai-current-event`, {
        httpsAgent: proxy ? agent : null,
    }
    );
    //console.log(response)
    //console.log(response.data);
    event = response.data.eventId;
    eventType = response.data.eventJson.eventType;
    eventStartTime = response.data.eventJson.startAt;
    days = Math.floor(
        (response.data.eventJson.aggregateAt - response.data.eventJson.startAt) /
        1000 /
        3600 /
        24
    );
    let eventDayNow = Math.floor(
        (Date.now() - (response.data.eventJson.startAt - 15 * 3600 * 1000)) /
        1000 /
        3600 /
        24
    );
    if (eventDayNow > days) eventDayNow = days;
    console.log(`Current event ${event}(${eventType}), ${eventDayNow}/${days} days`);

    debugJson["eventType"] = eventType;
    debugJson["days"] = days;
    debugJson["eventDayNow"] = eventDayNow;
    debugJson["eventStartTime"] = eventStartTime;
    debugJson["predictTime"] = Date.now();
}

const ranks = [100, 200, 300, 400, 500, 1000, 2000, 3000, 4000, 5000, 10000, 20000, 30000, 40000, 50000, 100000];
//const ranks = [100, 200, 300, 500, 1000, 2000, 3000, 5000, 10000, 20000, 30000, 50000, 100000];
//const ranks = [100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000];
//const ranks = [1000, 5000, 10000];

function getHalfTime(time: Date) {
    let half =
        (time.getUTCHours() + 9) * 2 + (time.getUTCMinutes() === 0 ? 0 : 1);
    return half >= 48 ? half - 48 : half;
}

function getHalfTimeFromBegin(time: Date) {
    return Math.round((time.getTime() - eventStartTime) / (30 * 60 * 1000));
}

async function getScores(rank: number) {
    let response = await axios.get(
        `https://api.sekai.best/event/${event}/rankings/graph?rank=${rank}`, {
        httpsAgent: proxy ? agent : null,
    }
    );
    let data = response.data as EventData;
    let scores = data.data.eventRankings;

    //Process illegal data (Multi array)
    if (scores.length > 0 && Array.isArray(scores[0])) {
        return [];
    }

    //Process illegal data (Incorrect event)
    if (
        scores.length > 0 &&
        (scores[0].eventId !== event || scores[0].rank !== rank)
    ) {
        return [];
    }

    //Process time and sort
    scores.forEach((it) => {
        if (it.timestamp === undefined) console.log(it);
    });
    scores.forEach((it) => (it.timestamp = new Date(it.timestamp.valueOf())));

    //Remove illegal data
    scores = scores.filter(
        (it) =>
            it.timestamp.getUTCMinutes() === 0 || it.timestamp.getUTCMinutes() === 30
    );
    scores = scores.sort((a, b) => a.timestamp.valueOf() - b.timestamp.valueOf());

    //console.log(`Got Data: ${rank}`)

    return scores;
}

function processDayScores(obj: EventRanking[], model: any, rank: number) {
    let dayPT: number[] = [];
    for (let i = 0; i <= 15; ++i) {
        dayPT.push(0);
    }

    //console.log(new Date(eventStartTime))
    obj.forEach((it, i) => {
        let day = Math.floor(
            (it.timestamp.getTime() - (eventStartTime - 15 * 3600 * 1000)) /
            1000 /
            3600 /
            24
        );

        //console.log(it.timestamp);
        //console.log(day)

        if (it.timestamp.getUTCHours() === 15 && it.timestamp.getUTCMinutes() === 0) {
            dayPT[day - 1] = it.score;
        }

        if (i >= 1 && day >= 1 && dayPT[day - 1] === 0) {
            let pre = obj[i - 1];
            let lastDayEndTime = new Date(eventStartTime - 15 * 3600 * 1000 + day * 24 * 3600 * 1000);
            //Ensure pre is in past day
            if(lastDayEndTime.getTime()<pre.timestamp.getTime()) return;
            //console.log(pre.timestamp)
            //console.log(getHalfTime(pre.timestamp))
            let percentPre = model["dayPeriod"][rank][getHalfTime(pre.timestamp)];
            let percentNow = model["dayPeriod"][rank][getHalfTime(it.timestamp)];
            //console.log(percentPre);
            //console.log(percentNow);
            let scorePerDay = (it.score - pre.score) / (percentNow+1-percentPre);
            //console.log(scorePerDay)
            let averageScore = scorePerDay * (1-percentPre);
            //console.log(averageScore)
            dayPT[day - 1] = averageScore + pre.score;
        }
    });
    return dayPT;
}

function processToday(obj: EventRanking[]): number[] {
    let start = 0;
    //console.log(new Date(eventStartTime));
    obj.forEach((it, i) => {
        if (
            it.timestamp.getUTCHours() === 15 &&
            it.timestamp.getUTCMinutes() === 0
        ) {
            start = i;
        }
    });
    let today = [];
    for (let i = 0; i <= 48; ++i) today.push(0);

    let lastTime = 0;
    for (let i = start; i < obj.length; ++i) {
        let it = obj[i];
        let halfTime = getHalfTime(it.timestamp);
        if (
            i > 0 &&
            it.timestamp.getTime() - obj[i - 1].timestamp.getTime() > 24 * 3600 * 1000
        )
            return []; //Illeaga data(cross day data)
        if (halfTime < lastTime) return []; //Illeaga data(cross day data)
        today[halfTime] = it.score - obj[start].score;
        //console.log(`today ${getHalfTime(it.timestamp)} ${it.score}`)
        lastTime = halfTime;
    }
    return today;
}

function processLast(today: number[], last: number): number[] {
    let count = 0;
    let lastToday = today.slice();
    for (let i = 47; i >= 0; --i) {
        if (count >= last) lastToday[i] = 0;
        if (lastToday[i] !== 0) count++;
    }
    return lastToday;
}

function getLSE(today: number[], target: number[], predict: number) {
    let sum = 0;

    today.forEach((it, i) => {
        if (it === 0 || it === undefined || target.length <= i) return;
        let precent = it / predict - target[i];
        sum += precent * precent;
    });

    return sum;
}

function processLSE(today: number[], target: number[]) {
    let l = 1,
        r = 33333333,
        mid = Math.floor((l + r) / 2);
    while (l < r) {
        let midL = getLSE(today, target, mid - 1);
        let midR = getLSE(today, target, mid);
        if (midL === midR) return mid;
        else if (midL < midR) r = mid - 1;
        else l = mid + 1;
        mid = Math.round((l + r) / 2);
        //console.log(`${l} ${mid} ${r}`);
    }
    return mid;
}

async function predict(rank: number) {
    console.log()
    //Debug Info
    let debugInfo = {
        scores: [] as number[],
        firstUsefulDay: 0,
        lastDayEnd: 0,
        dayScores: [] as number[],
        scorePerNormalDay: 0,
        todayScore: 0,
        lastDayScore: 0,
        result: 0,
    };
    for (let i = 0; i < days * 48 + 12; ++i) {
        debugInfo.scores.push(0);
    }

    //Model
    const model = JSON.parse(
        readFileSync(
            process.env.IS_SERVERLESS
                ? `/tmp/predict_models_${eventType}.json`
                : `predict_models_${eventType}.json`,
            "utf-8"
        )
    );
    //Get scores
    let scores = await getScores(rank);
    if (scores.length === 0) {
        console.log(`T${rank} Cannot predict: No data`);
        return 0;
    }
    scores.forEach(it => {
        debugInfo.scores[getHalfTimeFromBegin(it.timestamp)] = it.score;
    })

    //Get day score
    let day = processDayScores(scores, model, rank);
    let firstUsefulDay = 0;
    let lastDayEnd = 0;
    day.forEach((it, i) => {
        if (firstUsefulDay === 0 && it > 0) {
            firstUsefulDay = i + 1;
        }
        if (it > 0) {
            lastDayEnd = i + 1;
        }
    })
    if (firstUsefulDay <= 0) {
        console.log(`T${rank} Cannot predict: Event just started in a day`);
        return 0;
    }
    debugInfo.firstUsefulDay = firstUsefulDay;
    if (debug) console.log(`firstUsefulDay:${firstUsefulDay}`);
    debugInfo.dayScores = day;
    if (debug) console.log(`day:${day}`);

    //Get today score
    if (debug) console.log(`lastDayEnd:${lastDayEnd}`);
    let todayBeginScore = day[lastDayEnd - 1];
    if (debug) console.log(`todayBeginScore:${todayBeginScore}`);
    let todayScores = processToday(scores);
    if (debug) console.log(`todayScores:${todayScores}`);
    let halfTime =
        todayScores.length === 0
            ? 0
            : getHalfTime(scores[scores.length - 1].timestamp);

    /*if(rank===50000) {
          todayScores.forEach(it=>console.log(it))
          model["lastDayPeriod"][rank].forEach(it=>console.log(it))
      }*/

    //Get predict
    let isLastDay = lastDayEnd === days;
    if (debug) console.log(`lastEndDay:${lastDayEnd}`);
    debugInfo.lastDayEnd=lastDayEnd;
    if (!isLastDay) {
        //Not last day
        let day0 = day[firstUsefulDay - 1];
        if (debug) console.log(`day0:${day0}`);
        let todayProcess = model["dayPeriod"][rank][halfTime];
        if (debug) console.log(`todayProcess:${todayProcess}`);

        //Predict by today data
        let todayScore =
            halfTime === 0 ? 0 : processLSE(todayScores, model["dayPeriod"][rank]);
        if (debug) console.log(`todayScore:${todayScore}`);
        debugInfo.todayScore = todayScore;

        //Weighted mean
        let scorePerNormalDay =
            (todayBeginScore - day0 + todayScore * todayProcess) /
            (lastDayEnd - firstUsefulDay + todayProcess);
        if (debug) console.log(`scorePerNormalDay:${scorePerNormalDay}`);
        debugInfo.scorePerNormalDay = scorePerNormalDay;
        let scoreNormalDays = scorePerNormalDay * (days - 1);
        if (debug) console.log(`scoreNormalDays:${scoreNormalDays}`);

        //Calculate last day
        if (debug) console.log(`lastDayRate:${model["lastDay"][rank][days]}`);
        let lastDayScore =
            (scoreNormalDays / (1 - model["lastDay"][rank][days])) *
            model["lastDay"][rank][days];
        if (debug) console.log(`lastDayScore:${lastDayScore}`);
        debugInfo.lastDayScore = lastDayScore;

        //Calculate predict result
        let result = Math.round(
            day[0] + scoreNormalDays / (1 - model["lastDay"][rank][days])
        );
        debugInfo.result = result;
        debugJson.ranks[rank] = debugInfo;
        return result;
    } else {
        if (debug) console.log(todayBeginScore);
        //Last day
        let todayProcess = model["lastDayPeriod"][rank][halfTime];

        //Predict by today data
        let todayScoreNowPredict =
            halfTime === 0
                ? 0
                : processLSE(todayScores, model["lastDayPeriod"][rank]);
        if (debug) console.log("Now Predict:" + todayScoreNowPredict);

        //Predict by last hours data
        let todayScoreLastPredict =
            halfTime <= 2
                ? todayScoreNowPredict
                : processLSE(processLast(todayScores, 2), model["lastDayPeriod"][rank]);
        if (debug) console.log("Last Predict:" + todayScoreLastPredict);

        //Weighted mean for today's predict
        let todayScoreTodayPredict =
            todayScoreLastPredict * todayProcess +
            todayScoreNowPredict * (1 - todayProcess);

        //Predict by past days
        let todayScorePastPredict =
            ((todayBeginScore - day[0]) / (1 - model["lastDay"][rank][days])) *
            model["lastDay"][rank][days];
        if (debug) console.log("Past Predict:" + todayScorePastPredict);

        //Weighted mean for last day predict
        let todayScore =
            todayScoreTodayPredict * Math.min(1, todayProcess * 2) +
            todayScorePastPredict * Math.max(0, 1 - todayProcess * 2);

        let result = Math.round(todayBeginScore + todayScore);
        debugInfo.result = result;
        debugJson.ranks[rank] = debugInfo;
        return result;
    }
}

export async function predictAll(begin: number = 0) {
    await updateEvent();
    let outJson: Record<string, any> = {};
    let count = 0;
    for (const r of ranks) {
        if (r < begin) continue;
        let pre = await predict(r);
        if (pre > 0) {
            console.log(`T${r} ${pre}`);
            if (debug) console.log("");
            outJson[r] = pre;
            count++;
        }
    }

    if (count > 0) {
        writeFileSync(
            process.env.IS_SERVERLESS ? "/tmp/out-predict.json" : "out-predict.json",
            JSON.stringify(outJson)
        );
    }

    if (debug) {
        writeFileSync("predict-debug.json", JSON.stringify(debugJson));
        writeFileSync("../data-card-view/data/predict-debug.json", JSON.stringify(debugJson));
    }
}

