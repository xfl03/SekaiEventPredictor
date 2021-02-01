import {readFileSync, writeFileSync} from "fs";
import * as redis from "redis";
import {execSync} from "child_process";
import axios from "axios";

const client = redis.createClient(process.env.REDIS_URL);

async function downloadModel(){
    const response = await axios.get(`https://${process.env.MINIO_END_POINT}/${process.env.MINIO_BUCKET}/predict_models.json`);
    writeFileSync("predict_models.json", JSON.stringify(response.data), 'utf-8');
}

async function main() {
    await downloadModel();
    execSync("ts-node predict.ts");

    let outJson = JSON.parse(readFileSync("out-predict.json", "utf-8"));
    for (const r of outJson) {
        let pre = outJson[r];
        client.set(`predict-${r}`, pre.toString);
    }
}

export function serverless() {
    main();
    return "Finished";
}

main()
