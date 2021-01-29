import {readFileSync} from "fs";
import {execSync} from "child_process";
import {Client} from "minio";

const minioClient = new Client({
    endPoint: process.env.MINIO_END_POINT,
    useSSL: true,
    accessKey: process.env.MINIO_ACCESS_KEY,
    secretKey: process.env.MINIO_SECRET_KEY
});

const metaData = {
    'Content-Type': 'application/json'
}

async function main() {
    execSync("ts-node downloadData.ts")
    execSync("ts-node genModel.ts")

    minioClient.fPutObject(process.env.MINIO_BUCKET, "predict_models.json", "predict_models.json", metaData, function (err, etag) {
        if (err) return console.log(err)
        console.log('File uploaded successfully.')
    });
}