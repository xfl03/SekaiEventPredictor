import axios from 'axios';
import {writeFileSync, existsSync, mkdirSync} from 'fs';
import {execSync} from 'child_process';
import {EventData} from "./Struct";
import HttpsProxyAgent from "https-proxy-agent";

let agent = HttpsProxyAgent('http://localhost:1090');

let proxy = true;
let events = 8;
const ranks = [50, 100, 200, 300, 400, 500, 1000, 2000, 3000, 4000, 5000, 10000, 20000, 30000, 40000, 50000, 100000];

if (!existsSync("data")) mkdirSync("data");
if (!existsSync("out")) mkdirSync("out");

async function updateEventId() {
    const response = await axios.get(`https://strapi.sekai.best/sekai-current-event`, {
        httpsAgent: proxy?agent:null,
    });
    let currentEvent = response.data.eventId;
    if (response.data.eventJson.rankingAnnounceAt > Date.now()) {
        console.log(`Event ${currentEvent} is running.`)
        currentEvent--;
    }

    console.log(`Last ended event: ${currentEvent}`);
    writeFileSync(`lastEndedEventId`, currentEvent.toString(), 'utf-8');
    events = currentEvent;
}

async function downloadData(eventId: number, rankId: number) {
    const response = await axios.get(`https://api.sekai.best/event/${eventId}/rankings/graph?rank=${rankId}`, {
        httpsAgent: proxy?agent:null,
    });
    let data = response.data as EventData;
    let scores = data.data.eventRankings;

    //Process illegal data (Multi array)
    if (scores.length > 0 && Array.isArray(scores[0])) {
        console.log(`ERROR while downloading ${eventId} ${rankId}`)
        return;
    }

    //Process illegal data (Incorrect event)
    if (scores.length > 0 && (scores[0].eventId !== eventId || scores[0].rank !== rankId)) {
        console.log(`ERROR while downloading ${eventId} ${rankId}`)
        return;
    }

    writeFileSync(`data/data_${eventId}_${rankId}.json`, JSON.stringify(response.data), 'utf-8');
    console.log(`Downloaded ${eventId} ${rankId}`)
}

async function downloadAllData() {
    await updateEventId();
    for (let i = 1; i <= events; ++i) {
        for (const it of ranks) {
            if (!existsSync(`data/data_${i}_${it}.json`)) {
                await downloadData(i, it).catch(e => console.log(`Failed to download: ${i} ${it}`))
            }
        }
    }
    processAllData()
}

function processAllData() {
    for (let i = 2; i <= events; ++i) {
        ranks.forEach(it => {
            if (existsSync(`data/data_${i}_${it}.json`) && !existsSync(`out/out_${i}_${it}.json`)) {
                execSync(`ts-node convert2csv.ts ${i} ${it}`)
                console.log(`Processed ${i} ${it}`)
            }
        })
    }
}

if (process.argv.length > 3) {
    const event = parseInt(process.argv[2]);
    const rank = parseInt(process.argv[3]);
    downloadData(event, rank).then(it => execSync(`ts-node convert2csv.ts ${event} ${rank}`))
} else {
    downloadAllData()
}