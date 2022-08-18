const { src, dest } = require("gulp")

exports.default = function () {
  return src("./package.json").pipe(dest("./dist"))
}
