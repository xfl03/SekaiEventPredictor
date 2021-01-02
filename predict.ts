import axios from 'axios';
import {EventData, EventRanking} from "./Struct";
import {readFileSync} from "fs";

const event = 9;
const days = 8;
const ranks = [100, 500, 1000, 5000, 10000, 50000, 100000];

function getHalfTime(time: Date) {
    let half = (time.getHours() + 1) * 2 + (time.getMinutes() === 0 ? 0 : 1)
    return half > 48 ? half - 48 : half;
}

//Model
const model = JSON.parse(readFileSync("model.json", "utf-8"));

async function getScores(rank: number) {
    let response = await axios.get(`https://api.sekai.best/event/${event}/rankings/graph?rank=${rank}`);
    let data = response.data as EventData;
    let scores = data.data.eventRankings;

    //Process time and sort
    scores.forEach(it => it.timestamp = new Date(it.timestamp.valueOf()));
    scores = scores.sort((a, b) => a.timestamp.valueOf() - b.timestamp.valueOf());

    //Remove illegal data
    scores = scores.filter(it => it.timestamp.getMinutes() == 0 || it.timestamp.getMinutes() == 30)

    return data.data.eventRankings;
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
    console.log(`T${rank}`)

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

    //Get predict
    let isLastDay = day.length === days;
    if (!isLastDay) {
        //Not last day
        let todayScore = processLSE(todayScores, model["dayPeriod"][rank]);
        let scorePerNormalDay = (todayBeginScore - day[0] + todayScore) / day.length;
        let scoreBeforeLastDay = day[0] + scorePerNormalDay * (days - 1);
        return Math.round(scoreBeforeLastDay / (1 - model["lastDay"][rank][days]));
    } else {
        //Last day
        let todayScore = processLSE(todayScores, model["lastDayPeriod"][rank]);
        return Math.round(todayBeginScore + todayScore);
    }
}

async function predictAll() {
    for (const r of ranks) {
        console.log(await predict(r));
    }
}

predictAll()