import { predictAll } from "./predict";

if (process.argv.length === 3) {
    predictAll(parseInt(process.argv[2]))
} else {
    predictAll()
}
