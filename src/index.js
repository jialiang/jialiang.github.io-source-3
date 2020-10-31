var stages = ["pause-intro-0", "pause-intro-1", "pause-leaves"];
var selectors = [".intro-0", ".intro-1 .square"];

function next(callback) {
  d.body.className = "js " + stages.join(" ");
  stages.shift();
  if (typeof callback === "function") callback();
}

loop(selectors, function (selector) {
  var elem = qs(selector);
  elem.addEventListener("animationend", function (e) {
    if (e.target !== elem) return;
    raf(next);
  });
});

next(raf.bind(window, next));
