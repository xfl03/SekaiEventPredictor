# SekaiEventPredictor
Event predictor for game Project SEKAI.

## Usage 

### Init or Update
```sh
ts-node downloadData.ts
ts-node genModel.ts
```

### Predict
```sh
ts-node predict.ts
```

## Usage for Sekai Viewer

### Prepare
Notice: Minio example end point and key comes from [minio offical document](https://docs.min.io/docs/javascript-client-quickstart-guide.html).  
Environment variables:
- `REDIS_URL` Redis url for saving predict. Format:`redis://[user:password@]host[:port][/database][?option=value]`.
- `MINIO_END_POINT` Minio endPoint, which will be used to save predict model. Example:`play.min.io`.
- `MINIO_BUCKET` Minio bucket. Example:`europetrip`.
- `MINIO_ACCESS_KEY` Minio access key. Example:`Q3AM3UQ867SPQQA43P2F`.
- `MINIO_SECRET_KEY` Minio secret key. Example:`zuf+tfteSlswRu7BJ86wekitnifILbZam1KYY3TG`.

### Init or Update
```sh
ts-node updateForSekaiViewer.ts
```

### Predict
```sh
ts-node predictForSekaiViewer.ts
```
