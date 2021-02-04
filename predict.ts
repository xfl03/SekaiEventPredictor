import axios from "axios";
import { EventData, EventRanking } from "./Struct";
import { readFileSync, writeFileSync } from "fs";

let event = 9;
let days = 8;

async function updateEvent() {
  const response = await axios.get(
    `https://strapi.sekai.best/sekai-current-event`
  );
  //console.log(response.data);
  event = response.data.eventId;
  days = Math.floor(
    (response.data.eventJson.aggregateAt - response.data.eventJson.startAt) /
      1000 /
      3600 /
      24
  );
  console.log(`Current event ${event}, +${days} days`);
}

//const ranks = [100, 200, 300, 400, 500, 1000, 2000, 3000, 4000, 5000, 10000, 20000, 30000, 40000, 50000, 100000];
//const ranks = [100, 200, 300, 500, 1000, 2000, 3000, 5000, 10000, 20000, 30000, 50000, 100000];
const ranks = [100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000];

//const ranks = [100, 500, 1000, 5000, 10000, 50000, 100000];

function getHalfTime(time: Date) {
  let half =
    (time.getUTCHours() + 9) * 2 + (time.getUTCMinutes() === 0 ? 0 : 1);
  return half >= 48 ? half - 48 : half;
}

//Model
let model;

async function getScores(rank: number) {
  let response = await axios.get(
    `https://api.sekai.best/event/${event}/rankings/graph?rank=${rank}`
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

function processDayScores(obj: EventRanking[]) {
  let dayPT: number[] = [];
  obj.forEach((it) => {
    if (it.timestamp.getUTCHours() === 15 && it.timestamp.getUTCMinutes() === 0)
      dayPT.push(it.score);
  });
  return dayPT;
}

function processToday(obj: EventRanking[]): number[] {
  let start = 0;
  obj.forEach((it, i) => {
    if (it.timestamp.getUTCHours() === 15 && it.timestamp.getUTCMinutes() === 0)
      start = i;
  });
  let today = [];
  for (let i = 0; i <= 48; ++i) today.push(0);
  for (let i = start; i < obj.length; ++i) {
    let it = obj[i];
    today[getHalfTime(it.timestamp)] = it.score - obj[start].score;
    //console.log(`today ${getHalfTime(it.timestamp)} ${it.score}`)
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
  //Get scores
  let scores = await getScores(rank);
  if (scores.length === 0) {
    console.log(`T${rank} Cannot predict: No data`);
    return 0;
  }

  //Get day score
  let day = processDayScores(scores);
  if (day.length === 0) {
    console.log(`T${rank} Cannot predict: Event just started in a day`);
    return 0;
  }
  if (day.length < Math.floor(scores.length / 48)) {
    console.log(`T${rank} Cannot predict: Data missing`);
    return 0;
  }

  //Get today score
  let todayBeginScore = day[day.length - 1];
  let todayScores = processToday(scores);
  let halfTime = getHalfTime(scores[scores.length - 1].timestamp);

  /*if(rank===50000) {
        todayScores.forEach(it=>console.log(it))
        model["lastDayPeriod"][rank].forEach(it=>console.log(it))
    }*/

  //Get predict
  let isLastDay = day.length === days;
  if (!isLastDay) {
    //Not last day
    let todayProcess = model["dayPeriod"][rank][halfTime];
    //Predict by today data
    let todayScore =
      halfTime === 0 ? 0 : processLSE(todayScores, model["dayPeriod"][rank]);
    //console.log(todayScore);
    //Weighted mean
    let scorePerNormalDay =
      (todayBeginScore - day[0] + todayScore * todayProcess) /
      (day.length - 1 + todayProcess);
    //console.log(scorePerNormalDay);
    let scoreNormalDays = scorePerNormalDay * (days - 1);
    //console.log(scoreNormalDays);
    return Math.round(
      day[0] + scoreNormalDays / (1 - model["lastDay"][rank][days])
    );
  } else {
    //console.log(todayBeginScore);
    //Last day
    let todayProcess = model["lastDayPeriod"][rank][halfTime];

    //Predict by today data
    let todayScoreNowPredict =
      halfTime === 0
        ? 0
        : processLSE(todayScores, model["lastDayPeriod"][rank]);
    //console.log("Now Predict:" + todayScoreNowPredict);
    //Predict by last hours data
    let todayScoreLastPredict =
      halfTime <= 2
        ? todayScoreNowPredict
        : processLSE(processLast(todayScores, 2), model["lastDayPeriod"][rank]);
    //console.log("Last Predict:" + todayScoreLastPredict);
    //Weighted mean for today's predict
    let todayScoreTodayPredict =
      todayScoreLastPredict * todayProcess +
      todayScoreNowPredict * (1 - todayProcess);

    //Predict by past days
    let todayScorePastPredict =
      ((todayBeginScore - day[0]) / (1 - model["lastDay"][rank][days])) *
      model["lastDay"][rank][days];
    //console.log("Past Predict:" + todayScorePastPredict);

    //Weighted mean for last day predict
    let todayScore =
      todayScoreTodayPredict * Math.min(1, todayProcess * 2) +
      todayScorePastPredict * Math.max(0, 1 - todayProcess * 2);
    return Math.round(todayBeginScore + todayScore);
  }
}

export async function predictAll() {
  await updateEvent();
  model = JSON.parse(readFileSync(process.env.IS_SERVERLESS ? "/tmp/predict_models.json" : "predict_models.json", "utf-8"));
  let outJson = {};
  let count = 0;
  for (const r of ranks) {
    let pre = await predict(r);
    if (pre > 0) {
      console.log(`T${r} ${pre}`);
      outJson[r] = pre;
      count++;
    }
  }

  if (count > 0) {
    writeFileSync(process.env.IS_SERVERLESS ? "/tmp/out-predict.json" : "out_predict.json", JSON.stringify(outJson));
  }
}

require.main === module && predictAll();
