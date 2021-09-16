import {readFileSync, writeFileSync, existsSync} from 'fs';
import {OutRanking} from "./Struct";

const TARGET_EVENT_TYPE = process.argv.length > 2 ? process.argv[2] : "marathon";
const ranks = [50, 100, 200, 300, 400, 500, 1000, 2000, 3000, 4000, 5000, 10000, 20000, 30000, 40000, 50000, 100000];
let events = 8;
if (existsSync(`lastEndedEventId`)) {
    events = parseInt(readFileSync(`lastEndedEventId`, 'utf-8'))
}
let eventData = JSON.parse(readFileSync(`events.json`, 'utf-8')) as Array<any>

let dayModel = {};
let lastModel = {};
let lastDayModel = {};
ranks.forEach(it => {
    console.log(`T${it}`);
    let daySum = [];
    let dayCount = [];
    for (let t = 0; t <= 48; ++t) {
        daySum.push(0);
        dayCount.push(0);
    }

    let lastDaySum = [];
    let lastDayCount = [];
    for (let t = 0; t <= 42; ++t) {
        lastDaySum.push(0);
        lastDayCount.push(0);
    }

    let lastSum = [];
    let lastCount = [];
    for (let t = 0; t <= 10; ++t) {
        lastSum.push(0);
        lastCount.push(0);
    }

    //Process all event data, skip first event
    for (let i = 2; i <= events; ++i) {
        if (i === 18) continue;//Skip first cheerful carnival
        let eventType = eventData.filter(it => it.id === i)[0].eventType;
        if (eventType !== TARGET_EVENT_TYPE) {
            continue;
        }
        let data = JSON.parse(readFileSync(`out/out_${i}_${it}.json`, 'utf-8')) as OutRanking
        let percents = [0];
        let days = data.dayScores.length;
        for (let j = 1; j < days; ++j) {
            percents.push((data.dayScores[j] - data.dayScores[0]) / (data.lastScore - data.dayScores[0]))
            //percents.push(data.dayScores[j] / data.lastScore * 100)
        }
        percents.push(1);

        let delta = [];
        for (let j = 1; j < percents.length; ++j) {
            delta.push(percents[j] - percents[j - 1])
        }
        //if (days === 8) {
        console.log(i + " " + days + " " + JSON.stringify(delta));
        //}
        let lastDay = delta[delta.length - 1];
        if (lastDay > 0 && lastDay < 1) {
            lastSum[days] += lastDay;
            lastCount[days]++;
            //console.log(lastCount[days])
        }

        for (let d = 1; d <= days; ++d) {
            let halfHours = d === days ? 42 : 48;
            let t0 = d * 48 - 30;

            let dayStart = data.halfHourScores[t0];
            let dayEnd = data.halfHourScores[t0 + halfHours] - dayStart;
            if (dayStart === 0 || dayEnd === 0 ||
                dayStart === undefined || dayEnd === undefined ||
                isNaN(dayStart) || isNaN(dayEnd)) {
                console.log(`ERROR while processing DAY${d}`)
                continue
            }
            for (let t = 0; t <= halfHours; ++t) {
                let score = data.halfHourScores[t0 + t];
                if (score === 0) continue

                if (d === days) {
                    lastDaySum[t] += (score - dayStart) / dayEnd;
                    if (isNaN(lastDaySum[t])) {
                        console.log(`${score} ${dayStart} ${dayEnd}`)
                    }
                    lastDayCount[t]++;
                } else {
                    daySum[t] += (score - dayStart) / dayEnd;
                    dayCount[t]++;
                }
            }
        }
    }

    let dayPercents = []
    for (let t = 0; t <= 48; ++t) {
        dayPercents.push(daySum[t] / dayCount[t])
        //console.log(daySum[t] / dayCount[t] * 100)
    }
    dayModel[it] = dayPercents;


    let lastDayPercents = []
    for (let t = 0; t <= 42; ++t) {
        lastDayPercents.push(lastDaySum[t] / lastDayCount[t])
        //console.log(lastDaySum[t] / lastDayCount[t] * 100)
    }
    lastDayModel[it] = lastDayPercents;

    let lastPercents = []
    for (let t = 0; t <= 10; ++t) {
        if (lastCount[t] === 0) {
            lastPercents.push(0);
            continue;
        }
        //console.log(t+" "+lastCount[t])
        lastPercents.push(lastSum[t] / lastCount[t])
    }
    lastModel[it] = lastPercents;
})

let outModel = {
    dayPeriod: dayModel,
    lastDay: lastModel,
    lastDayPeriod: lastDayModel,
}

writeFileSync(`predict_models_${TARGET_EVENT_TYPE}.json`, JSON.stringify(outModel, null, 2))