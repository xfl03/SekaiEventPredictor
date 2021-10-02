import { readFileSync, writeFileSync } from "fs";
import * as redis from "redis";
// import { execSync } from "child_process";
import axios from "axios";
import { predictAll } from "./predict";

async function downloadModel() {
  let response = await axios.get(
    `https://${process.env.MINIO_END_POINT}/${process.env.MINIO_BUCKET}/predict_models_marathon.json`,
    {
      headers: {
        "user-agent": "Mozilla",
      },
    }
  );
  writeFileSync(
    process.env.IS_SERVERLESS ? "/tmp/predict_models_marathon.json" : "predict_models_marathon.json",
    JSON.stringify(response.data),
    "utf-8"
  );
  
  response = await axios.get(
    `https://${process.env.MINIO_END_POINT}/${process.env.MINIO_BUCKET}/predict_models_cheerful_carnival.json`,
    {
      headers: {
        "user-agent": "Mozilla",
      },
    }
  );
  writeFileSync(
    process.env.IS_SERVERLESS ? "/tmp/predict_models_cheerful_carnival.json" : "predict_models_cheerful_carnival.json",
    JSON.stringify(response.data),
    "utf-8"
  );
}

async function main() {
  const client = redis.createClient(process.env.REDIS_URL);

  await downloadModel();
  await predictAll();

  let outJson = JSON.parse(
    readFileSync(
      process.env.IS_SERVERLESS ? "/tmp/out-predict.json" : "out-predict.json",
      "utf-8"
    )
  );
  for (const r in outJson) {
    let pre = outJson[r];
    client.set(`predict-${r}`, pre.toString());
  }
  client.set(`predict-ts`, new Date().getTime());
}

export async function serverless(params) {
  process.env.REDIS_URL = params.REDIS_URL;
  process.env.MINIO_END_POINT = params.MINIO_END_POINT;
  process.env.MINIO_BUCKET = params.MINIO_BUCKET;
  process.env.IS_SERVERLESS = params.IS_SERVERLESS;

  await main();
  return {status: "Finished"};
}

require.main === module && main();
