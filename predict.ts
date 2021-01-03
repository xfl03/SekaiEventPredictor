import axios from 'axios';
import {EventData, EventRanking} from "./Struct";
import {readFileSync} from "fs";

const event = 9;
const days = 8;
const ranks = [100, 500, 1000, 5000, 10000, 50000, 100000];

function getHalfTime(time: Date) {
    let half = (time.getHours() + 1) * 2 + (time.getMinutes() === 0 ? 0 : 1)
    return half >= 48 ? half - 48 : half;
}

//Model
const model = JSON.parse(readFileSync("model.json", "utf-8"));

async function getScores(rank: number) {
    let response = await axios.get(`https://api.sekai.best/event/${event}/rankings/graph?rank=${rank}`);
    let data = response.data as EventData;
    let scores = data.data.eventRankings;

    //Process time and sort
    scores.forEach(it => it.timestamp = new Date(it.timestamp.valueOf()));

    //Remove illegal data
    scores = scores.filter(it => it.timestamp.getMinutes() == 0 || it.timestamp.getMinutes() == 30)
    scores = scores.sort((a, b) => a.timestamp.valueOf() - b.timestamp.valueOf());

    //console.log(`Got Data: ${rank}`)

    return scores;
}

function processDayScores(obj: EventRanking[]) {
    let dayPT: number[] = [];
    obj.forEach(it => {
        if (it.timestamp.getHours() === 23 && it.timestamp.getMinutes() === 0) dayPT.push(it.score);
    })
    return dayPT;
}

function processToday(obj: EventRanking[]): number[] {
    let start = 0;
    obj.forEach((it, i) => {
        if (it.timestamp.getHours() === 23 && it.timestamp.getMinutes() === 0) start = i;
    })
    let today = [];
    for (let i = 0; i <= 48; ++i) today.push(0);
    for (let i = start; i < obj.length - 1; ++i) {
        let it = obj[i];
        today[getHalfTime(it.timestamp)] = it.score - obj[start].score;
    }
    return today;
}

function getLSE(today: number[], target: number[], predict: number) {
    let sum = 0;
    today.forEach((it, i) => {
        if (it === 0) return
        let precent = it / predict - target[i];
        sum += precent * precent;
    })
    return sum;
}

function processLSE(today: number[], target: number[]) {
    let l = 1, r = 33333333, mid = Math.floor((l + r) / 2);
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

    //Get scores
    let scores = await getScores(rank);

    //Get day score
    let day = processDayScores(scores);
    if (day.length === 0) {
        console.log(`Cannot predict: Event just started in a day`)
        return
    }
    if (day.length < Math.floor(scores.length / 48)) {
        console.log(`Cannot predict: Data missing`)
        return
    }

    //Get today score
    let todayBeginScore = day[day.length - 1];
    let todayScores = processToday(scores);
    let halfTime = getHalfTime(scores[scores.length - 1].timestamp);

    //Get predict
    let isLastDay = day.length === days;
    if (!isLastDay) {
        //Not last day
        let todayProcess = model["dayPeriod"][rank][halfTime];
        //Predict by today data
        let todayScore = halfTime === 0 ? 0 : processLSE(todayScores, model["dayPeriod"][rank]);
        //Weighted mean
        let scorePerNormalDay = (todayBeginScore - day[0] + todayScore * todayProcess) / (day.length - 1 + todayProcess);
        let scoreNormalDays = scorePerNormalDay * (days - 1);
        return Math.round(day[0] + scoreNormalDays / (1 - model["lastDay"][rank][days]));
    } else {
        //Last day
        let todayProcess = model["lastDayPeriod"][rank][halfTime];
        //Predict by past days
        let todayScorePastPredict = (todayBeginScore - day[0]) / (1 - model["lastDay"][rank][days]) * model["lastDay"][rank][days];
        //Predict by today data
        let todayScoreNowPredict = processLSE(todayScores, model["lastDayPeriod"][rank]);
        //Weighted mean
        let todayScore = todayScoreNowPredict * todayProcess + todayScorePastPredict * (1 - todayProcess);
        return Math.round(todayBeginScore + todayScore);
    }
}

async function predictAll() {
    for (const r of ranks) {
        let pre = await predict(r);
        console.log(`T${r} ${pre}`)
    }
}

predictAll()
