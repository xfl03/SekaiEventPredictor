import {readFileSync, writeFileSync} from 'fs';
import {EventData, EventRanking, SimpleRanking} from "./Struct";
import dateFormat from "dateFormat";

let dataFile = "data.json";
let csvFile = "out.csv";
let jsonFile = "out.json";

//Choose event
if (process.argv.length > 3) {
    const event = parseInt(process.argv[2]);
    const rank = parseInt(process.argv[3]);
    dataFile = `data/data_${event}_${rank}.json`;
    csvFile = `out/out_${event}_${rank}.csv`;
    jsonFile = `out/out_${event}_${rank}.json`;
}

//Time to string
let firstDay = 0;

function dateToString(date: Date): string {
    return "D" + (Math.floor((date.getTime() / 1000 / 3600 + 9) / 24) - firstDay) + dateFormat(date, " HH:MM");
}

//Get raw data
let eventData = JSON.parse(readFileSync(dataFile, 'utf8')) as EventData;
let scores = eventData.data.eventRankings;
console.log(scores.length);

//Process time and sort
scores.forEach(it => it.timestamp = new Date(it.timestamp.valueOf()));
scores = scores.sort((a, b) => a.timestamp.valueOf() - b.timestamp.valueOf());

//Add begin data
let begin = {} as EventRanking;
begin.timestamp = new Date(scores[0].timestamp.valueOf());
begin.timestamp.setHours(14, 0, 0, 0);
begin.score = 0;
scores.push(begin);
firstDay = Math.floor(begin.timestamp.getTime() / 3600 / 1000 / 24);

scores = scores.sort((a, b) => a.timestamp.valueOf() - b.timestamp.valueOf());

//Correct end data time
let dt = scores[scores.length - 1].timestamp.getTime() - scores[scores.length - 2].timestamp.getTime()
if (dt > 32 * 60 * 1000) {
    scores[scores.length - 1].timestamp = new Date(scores[scores.length - 2].timestamp.getTime());
    scores[scores.length - 1].timestamp.setHours(20, 0, 0, 0);
}

//Remove illegal data
scores = scores.filter(it => it.timestamp.getMinutes() == 0 || it.timestamp.getMinutes() == 30)

//Fix miss data
let retObj: SimpleRanking[] = [];
scores.forEach((it, i) => {
    if (i > 0) {
        let pre = scores[i - 1];
        let delta = Math.round((it.timestamp.valueOf() - pre.timestamp.valueOf()) / 1000 / 1800);
        if (delta !== 1) {
            console.log("MISS " + (delta - 1) + " between " + dateToString(pre.timestamp) + " and " + dateToString(it.timestamp));

            let deltaPT = Math.round((it.score - pre.score) / delta);
            for (let d = 1; d < delta; ++d) {
                let midTime = new Date(pre.timestamp.getTime() + d * 30 * 60 * 1000);
                retObj.push({
                    time: midTime,
                    pt: delta > 3 ? 0 : pre.score + d * deltaPT
                });
            }
        }
    }

    retObj.push({
        time: it.timestamp,
        pt: it.score
    });
});

//Save CSV
let outCSV = "T,PT\r\n";
retObj.forEach(it => {
    outCSV += dateToString(it.time) + "," + it.pt + "\r\n"
})
//writeFileSync(csvFile, outCSV);

//Gen day PT
let dayPT: number[] = [];
let PT: number[] = [];
retObj.forEach(it => {
    if (it.time.getHours() === 23 && it.time.getMinutes() === 0) dayPT.push(it.pt);
    PT.push(it.pt);
})
let outJson = {
    beginTime: retObj[0].time,
    lastTime: retObj[retObj.length - 1].time,
    lastScore: retObj[retObj.length - 1].pt,
    dayScores: dayPT,
    halfHourScores: PT
}
writeFileSync(jsonFile, JSON.stringify(outJson, null, 4));
