import { readFileSync, writeFileSync } from "fs";

const ranks = [50, 100, 200, 300, 400, 500, 1000, 2000, 3000, 4000, 5000, 10000, 20000, 30000, 40000, 50000, 100000];

const model = JSON.parse(
  readFileSync(
    "predict_models.json",
    "utf-8"
  )
);

ranks.forEach(rank => {
  let lastDay9 = model["lastDay"][rank][9];
  let lastDay10 = lastDay9 / (1 + (1 - lastDay9) / 9);
  console.log(lastDay9);
  console.log(lastDay10);
  console.log();
  
  model["lastDay"][rank][10] = lastDay10;
});

writeFileSync("predict_models.json", JSON.stringify(model, null, 2))
