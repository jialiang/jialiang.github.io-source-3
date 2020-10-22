const { src, dest, series, task, watch } = require("gulp");
const autoprefixer = require("gulp-autoprefixer");
const concat = require("gulp-concat");
const ejs = require("gulp-ejs");
const embed = require("gulp-embed");
const fs = require("fs");
const inlineBase64 = require("gulp-inline-base64");
const prettier = require("gulp-prettier");
const rename = require("gulp-rename");
const removeHtmlComments = require("gulp-remove-html-comments");
const sass = require("gulp-sass");
const sassInlineSvg = require("gulp-sass-inline-svg");
const size = require("gulp-size");
const marked = require("marked");
const merge = require("merge-stream");

marked.setOptions({
  breaks: true,
  gfm: true,
  headerIds: false,
});

const compileHTML = () =>
  src("./src/*.ejs")
    .pipe(
      ejs({
        md: (str) =>
          marked(str).replace(
            /<a href="http/gi,
            '<a target="_blank" rel="noreferrer noopener" href="http'
          ),
      })
    )
    .pipe(
      rename((path) => ({
        ...path,
        extname: ".html",
      }))
    )
    .pipe(removeHtmlComments())
    .pipe(dest("dist"));

const compileCSS = () =>
  src("./src/**/*.scss")
    .pipe(
      sass({
        includePaths: "./bin",
      })
    )
    .pipe(
      inlineBase64({
        baseDir: "./src/",
        maxSize: 20 * 1024,
      })
    )
    .pipe(autoprefixer())
    .pipe(concat("index.css"))
    .pipe(dest("./dist"));

const compileSVG = (done) => {
  src("./src/images/*.svg")
    .pipe(rename({ dirname: "" }))
    .pipe(
      sassInlineSvg({
        destDir: "./bin",
      })
    )
    .on("finish", () => {
      // For some reason, needed to prevent access errors on next task
      fs.readFile("./bin/_sass-inline-svg-data.scss", "utf-8", done);
    });
};

const embedHTML = () => src("./dist/*.html").pipe(embed()).pipe(dest("./dist"));

const prettyAll = () =>
  src("./dist/*.{html,css}").pipe(prettier()).pipe(dest("./dist"));

const reportHTMLSize = () =>
  src("./dist/*.html")
    .pipe(size({ title: "Original", gzip: false, showFiles: true }))
    .pipe(size({ title: "Gzipped", gzip: true, showFiles: true }));

const copyStatic = () => {
  const stream1 = src("./src/images/*.{jpg,png,webp}").pipe(
    dest("./dist/images")
  );
  const stream2 = src("./src/static/*").pipe(dest("./dist"));

  return merge(stream1, stream2);
};

const build = series(
  compileSVG,
  compileHTML,
  compileCSS,
  embedHTML,
  prettyAll,
  reportHTMLSize
);

task("build", build);

task("report-production-size", () => {
  const options = {
    WEBP: "./dist/images/*-780.webp",
    SVG: "./src/images/*.svg",
    WOFF2: "./dist/*.woff2",
    PNG: "./dist/images/*.png",
    CSS: "./dist/*.css",
    HTML: "./dist/*.html",
    TOTAL: ["./dist/**/*.{html,woff2}", "./dist/**/*-780.webp"],
  };
  const results = {};
  const task = Object.keys(options).map((key) => {
    return (done) => {
      const s = size({ title: key, gzip: true, showFiles: false });
      return src(options[key])
        .pipe(s)
        .on("end", () => {
          let size = parseInt(s.size, 10);

          if (key === "CSS") size -= results.SVG.size + results.PNG.size;
          if (key === "HTML")
            size -= results.CSS.size + results.SVG.size + results.PNG.size;

          results[key] = {
            size,
          };
          done();
        });
    };
  });

  task.push((done) => {
    Object.keys(results).forEach((key) => {
      results[key].percent = Math.round(
        (results[key].size / results.TOTAL.size) * 100
      );
      results[key].size = Math.round(results[key].size / 1000);
    });
    console.log("\n");
    console.log(JSON.stringify(results, null, 2));
    done();
  });

  return series(...task)();
});

exports.default = () => {
  watch(
    ["./src/images/*.{jpg,png}", "./src/static/*"],
    { ignoreInitial: false },
    copyStatic
  );
  watch("./src/**/*.{ejs,scss,svg}", { ignoreInitial: false }, build);
};
